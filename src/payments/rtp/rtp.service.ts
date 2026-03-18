import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import Decimal from 'decimal.js';

import { RTP } from './entities/rtp.entity';
import { Transaction } from '../transaction/entities/transaction.entity';
import { RtpInitiateDto } from './dto/rtp-initiate.dto';
import { RespondRtpDto } from './dto/rtp-respond.dto';

import { CasService } from 'src/cas/cas.service';
import { LedgerService } from 'src/ledger/ledger.service';
import { AccountsService } from 'src/accounts/accounts.service';
import { WalletService } from 'src/wallet/wallet.service';
import { CustomerService } from 'src/customer/customer.service';
import { PaymentsService } from '../payments.service';

import { RtpStatus } from 'src/common/enums/rtp.enums';
import {
  Currency,
  TransactionStatus,
  TransactionType,
} from 'src/common/enums/transaction.enums';

type ResolvedRtpSource = {
  sourceType: 'ACCOUNT' | 'WALLET';
  senderFinAddress: string;
  senderAlias: string;
  customerId: string;
  sourceAccountId?: string | null;
  sourceWalletId?: string | null;
};

@Injectable()
export class RtpService {
  private readonly logger = new Logger(RtpService.name);

  constructor(
    @InjectRepository(RTP)
    private readonly rtpRepo: Repository<RTP>,

    @InjectRepository(Transaction)
    private readonly txRepo: Repository<Transaction>,

    private readonly ledgerService: LedgerService,
    private readonly cas: CasService,
    private readonly accountsService: AccountsService,

    @Inject(forwardRef(() => WalletService))
    private readonly walletService: WalletService,

    @Inject(forwardRef(() => CustomerService))
    private readonly customerService: CustomerService,

    private readonly paymentsService: PaymentsService,
    private readonly dataSource: DataSource,
  ) {
    Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });
  }

  async initiate(participantId: string, dto: RtpInitiateDto) {
    const amount = new Decimal(dto.amount);
    if (amount.isNaN() || amount.lte(0)) {
      throw new BadRequestException('Invalid RTP amount');
    }

    const currency = dto.currency ?? Currency.SLE;
    if (currency !== Currency.SLE) {
      throw new BadRequestException('Only SLE currency is supported');
    }

    const expiryMs = Number(process.env.RTP_EXPIRY_MINUTES ?? 60) * 60 * 1000;

    const requester = await this.cas.resolveAlias(
      dto.requesterAliasType,
      dto.requesterAlias,
    );

    let payerFinAddress: string | undefined;
    try {
      const payer = await this.cas.resolveAlias(
        dto.payerAliasType ?? dto.requesterAliasType,
        dto.payerAlias,
      );
      payerFinAddress = payer.finAddress;
    } catch {
      payerFinAddress = undefined;
    }

    const rtp = this.rtpRepo.create({
      participantId,
      requesterAlias: dto.requesterAlias,
      requesterAliasType: dto.requesterAliasType,
      payerAlias: dto.payerAlias,
      payerAliasType: dto.payerAliasType,
      requesterFinAddress: requester.finAddress,
      payerFinAddress,
      amount: amount.toFixed(2),
      currency,
      message: dto.message,
      reference: dto.reference,
      status: RtpStatus.PENDING,
      expiresAt: new Date(Date.now() + expiryMs),
    });

    return this.rtpRepo.save(rtp);
  }

  async approve(participantId: string, dto: RespondRtpDto) {
    return this.dataSource.transaction('SERIALIZABLE', async (manager) => {
      const rtp = await manager.getRepository(RTP).findOne({
        where: { rtpMsgId: dto.rtpMsgId, participantId },
      });

      if (!rtp) {
        throw new NotFoundException('RTP not found');
      }

      if (rtp.status !== RtpStatus.PENDING) {
        throw new BadRequestException(
          `RTP cannot be processed. Current status: ${rtp.status}`,
        );
      }

      if (new Date() > rtp.expiresAt) {
        await this.updateStatus(
          manager,
          dto.rtpMsgId,
          RtpStatus.EXPIRED,
          undefined,
          undefined,
          'RTP request has expired',
        );
        throw new BadRequestException('RTP request has expired');
      }

      const creditorFinAddress =
        rtp.requesterFinAddress ||
        (
          await this.cas.resolveAlias(
            rtp.requesterAliasType,
            rtp.requesterAlias,
          )
        ).finAddress;

      const source = await this.resolveSource(participantId, dto, manager);

      if (source.senderFinAddress === creditorFinAddress) {
        throw new BadRequestException('Sender and receiver cannot be same');
      }

      if (source.sourceType === 'WALLET') {
        const wallet = await this.walletService.getWallet(
          source.sourceWalletId!,
          participantId,
        );

        if (!wallet) {
          throw new NotFoundException('Wallet not found');
        }

        await this.walletService.verifyPinWithLock(
          wallet,
          participantId,
          dto.pin,
        );
      } else {
        await this.customerService.verifyPin(
          source.customerId,
          participantId,
          dto.pin,
        );
      }

      await this.accountsService.assertFinAddressActive(
        source.senderFinAddress,
        manager,
      );
      await this.accountsService.assertFinAddressActive(
        creditorFinAddress,
        manager,
      );

      const amount = new Decimal(rtp.amount);
      const tx = manager.getRepository(Transaction).create({
        participantId: rtp.participantId,
        channel: TransactionType.RTP_PAYMENT,
        senderAlias: rtp.payerAlias,
        senderFinAddress: source.senderFinAddress,
        receiverAlias: rtp.requesterAlias,
        receiverFinAddress: creditorFinAddress,
        amount: Number(amount.toFixed(2)),
        currency: rtp.currency,
        status: TransactionStatus.INITIATED,
        reference:
          rtp.reference || rtp.message || `RTP Payment ${rtp.rtpMsgId}`,
        externalId:
          dto.idempotencyKey || this.paymentsService.generateReference(),
      });

      const savedTx = await manager.getRepository(Transaction).save(tx);

      try {
        const transferResult = await this.ledgerService.postTransfer(
          {
            txId: savedTx.txId,
            idempotencyKey: dto.idempotencyKey,
            reference: savedTx.reference ?? `RTP-${rtp.rtpMsgId}`,
            participantId: rtp.participantId,
            postedBy: 'rtp-service',
            currency: rtp.currency,
            legs: [
              {
                finAddress: savedTx.senderFinAddress,
                amount: amount.toFixed(2),
                isCredit: false,
                memo: `RTP payment to ${savedTx.receiverAlias}`,
              },
              {
                finAddress: savedTx.receiverFinAddress,
                amount: amount.toFixed(2),
                isCredit: true,
                memo: `RTP payment from ${savedTx.senderAlias}`,
              },
            ],
          },
          manager,
        );

        savedTx.status = TransactionStatus.COMPLETED;
        await manager.getRepository(Transaction).save(savedTx);

        await this.updateStatus(
          manager,
          dto.rtpMsgId,
          RtpStatus.ACCEPTED,
          savedTx.txId,
          undefined,
          undefined,
        );

        const [senderBalance, receiverBalance] = await Promise.all([
          this.ledgerService.getDerivedBalance(savedTx.senderFinAddress),
          this.ledgerService.getDerivedBalance(savedTx.receiverFinAddress),
        ]);

        return {
          status: 'success',
          rtpMsgId: rtp.rtpMsgId,
          txId: savedTx.txId,
          journalId: transferResult.journalId,
          senderFinAddress: savedTx.senderFinAddress,
          receiverFinAddress: savedTx.receiverFinAddress,
          senderBalance,
          receiverBalance,
        };
      } catch (error: any) {
        savedTx.status = TransactionStatus.FAILED;
        await manager.getRepository(Transaction).save(savedTx);

        await this.updateStatus(
          manager,
          dto.rtpMsgId,
          RtpStatus.FAILED,
          undefined,
          undefined,
          error?.message || 'RTP payment failed',
        );

        throw error;
      }
    });
  }

  async reject(participantId: string, rtpMsgId: string, reason?: string) {
    const rtp = await this.rtpRepo.findOne({
      where: { rtpMsgId, participantId },
    });

    if (!rtp) {
      throw new NotFoundException('RTP not found');
    }

    if (rtp.status !== RtpStatus.PENDING) {
      throw new BadRequestException('RTP already processed');
    }

    this.logger.log(`RTP rejected by payer ${rtp.payerAlias}`);

    await this.updateStatus(
      undefined,
      rtpMsgId,
      RtpStatus.REJECTED,
      undefined,
      reason || 'Rejected by payer',
      undefined,
    );

    return {
      status: 'success',
      rtpMsgId,
      rtpStatus: RtpStatus.REJECTED,
    };
  }

  async findPendingByPayer(participantId: string, payerAlias: string) {
    return this.rtpRepo.find({
      where: {
        participantId,
        payerAlias,
        status: RtpStatus.PENDING,
      },
      order: { createdAt: 'DESC' },
    });
  }

  private async resolveSource(
    participantId: string,
    dto: RespondRtpDto,
    manager: EntityManager,
  ): Promise<ResolvedRtpSource> {
    if (dto.sourceType === 'WALLET') {
      if (!dto.sourceWalletId) {
        throw new BadRequestException(
          'sourceWalletId is required for wallet source',
        );
      }

      const wallet = await this.walletService.getWallet(
        dto.sourceWalletId,
        participantId,
      );

      if (!wallet) {
        throw new NotFoundException('Wallet not found');
      }

      if (wallet.customerId !== dto.customerId) {
        throw new BadRequestException('Wallet does not belong to the customer');
      }

      return {
        sourceType: 'WALLET',
        senderFinAddress: wallet.finAddress,
        senderAlias: wallet.customerId,
        customerId: wallet.customerId,
        sourceWalletId: wallet.walletId,
        sourceAccountId: wallet.accountId,
      };
    }

    if (!dto.sourceFinAddress) {
      throw new BadRequestException(
        'sourceFinAddress is required for account source',
      );
    }

    await this.accountsService.assertFinAddressActive(
      dto.sourceFinAddress,
      manager,
    );

    return {
      sourceType: 'ACCOUNT',
      senderFinAddress: dto.sourceFinAddress,
      senderAlias: dto.customerId,
      customerId: dto.customerId,
      sourceAccountId: dto.sourceAccountId ?? null,
    };
  }

  private async updateStatus(
    manager: EntityManager | undefined,
    rtpMsgId: string,
    status: RtpStatus,
    approvedTxId?: string,
    rejectionReason?: string,
    failureReason?: string,
  ) {
    const repo = manager ? manager.getRepository(RTP) : this.rtpRepo;

    await repo.update(
      { rtpMsgId },
      {
        status,
        approvedTxId,
        rejectionReason,
        failureReason,
      },
    );
  }
}
