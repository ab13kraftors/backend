import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { RTP } from '../entities/rtp.entity';
import { Repository } from 'typeorm';
import { Transaction } from '../entities/transaction.entity';
import { CasService } from 'src/cas/cas.service';
import { RtpStatus } from 'src/common/enums/rtp.enums';
import {
  TransactionStatus,
  TransactionType,
} from 'src/common/enums/transaction.enums';
import { LedgerService } from 'src/ledger/ledger.service';

@Injectable()
export class RtpService {
  // Logger for RTP operations
  private readonly logger = new Logger(RtpService.name);

  constructor(
    // Inject RTP repository
    @InjectRepository(RTP) private rtpRepo: Repository<RTP>,

    // Inject Transaction repository
    @InjectRepository(Transaction) private txRepo: Repository<Transaction>,

    // Inject Ledger service for ledger transfers
    private ledgerService: LedgerService,

    // Inject CAS service for alias resolution
    private cas: CasService,
  ) {}

  // ================== initiate ==================
  // Creates a new Request-To-Pay record
  async initiate(participantId: string, dto: any) {
    // Determine expiry time from environment variable
    const expiryMs = Number(process.env.RTP_EXPIRY_MINUTES ?? 60) * 60 * 1000;

    const rtp = this.rtpRepo.create({
      ...dto,
      participantId,
      requesterAliasTypes: dto.requesterAliasType,
      status: RtpStatus.PENDING,
      expiresAt: new Date(Date.now() + expiryMs),
    });

    return this.rtpRepo.save(rtp);
  }

  // ================== approve ==================
  // Approves RTP request and performs payment
  async approve(rtpMsgId: string, debtorAccount: string) {
    const rtp = await this.rtpRepo.findOne({ where: { rtpMsgId } });

    if (!rtp) throw new NotFoundException('RTP not found');

    // Validate RTP status
    if (rtp.status !== RtpStatus.PENDING) {
      throw new BadRequestException(
        `RTP cannot be processed. Current status: ${rtp.status}`,
      );
    }

    // Check expiry
    if (new Date() > rtp.expiresAt) {
      await this.rtpRepo.update(rtpMsgId, { status: RtpStatus.EXPIRED });
      throw new BadRequestException('RTP request has expired');
    }

    // Resolve requester alias to financial address
    const creditor = await this.cas.resolveAlias(
      rtp.requesterAliasType,
      rtp.requesterAlias,
    );

    // Create transaction record
    const tx = this.txRepo.create({
      participantId: rtp.participantId,
      channel: TransactionType.RTP_PAYMENT,
      senderAlias: rtp.payerAlias,
      senderFinAddress: debtorAccount,
      receiverAlias: rtp.requesterAlias,
      receiverFinAddress: creditor.finAddress,
      amount: rtp.amount,
      currency: rtp.currency,
      status: TransactionStatus.INITIATED,
      reference: rtp.message,
    });

    const savedTx = await this.txRepo.save(tx);

    try {
      // Perform ledger transfer
      await this.ledgerService.postTransfer({
        txId: savedTx.txId,
        reference: savedTx.reference ?? `RTP-${rtpMsgId}`,
        participantId: rtp.participantId,
        postedBy: 'system',
        legs: [
          {
            finAddress: savedTx.senderFinAddress,
            amount: String(savedTx.amount),
            isCredit: true, // DEBIT — money leaving payer
            memo: `RTP payment to ${savedTx.receiverAlias}`,
          },
          {
            finAddress: savedTx.receiverFinAddress,
            amount: String(savedTx.amount),
            isCredit: false, // CREDIT — money arriving at requester
            memo: `RTP payment from ${savedTx.senderAlias}`,
          },
        ],
      });

      // Update transaction status
      savedTx.status = TransactionStatus.COMPLETED;

      // Update RTP status
      await this.rtpRepo.update(rtpMsgId, {
        status: RtpStatus.ACCEPTED,
        message: 'Payment completed successfully',
      });

      return await this.txRepo.save(savedTx);
    } catch (error) {
      // Mark transaction failed
      savedTx.status = TransactionStatus.FAILED;
      await this.txRepo.save(savedTx);

      // Update RTP with failure message
      await this.rtpRepo.update(rtpMsgId, {
        message: `Payment failed: ${error}`,
      });

      throw error;
    }
  }

  // ================== reject ==================
  // Rejects an RTP request
  async reject(rtpMsgId: string) {
    const rtp = await this.rtpRepo.findOne({ where: { rtpMsgId } });

    if (!rtp) throw new NotFoundException('RTP not found');

    // Ensure RTP is still pending
    if (rtp.status !== RtpStatus.PENDING) {
      throw new BadRequestException('RTP already processed');
    }

    this.logger.log(`RTP rejected by payer`, { rtpMsgId });

    return this.rtpRepo.update(rtpMsgId, {
      status: RtpStatus.REJECTED,
      message: 'Reject by the payer',
    });
  }

  // ================== findPendingByPayer ==================
  // Returns all pending RTP requests for a payer
  async findPendingByPayer(payerAlias: string) {
    return this.rtpRepo.find({
      where: {
        payerAlias,
        status: RtpStatus.PENDING,
      },
      order: { createdAt: 'DESC' },
    });
  }
}
