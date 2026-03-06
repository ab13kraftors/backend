import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { RTP } from '../entities/rtp.entity';
import { Repository } from 'typeorm';
import { Transaction } from '../entities/transaction.entity';
import { CasService } from 'src/cas/cas.service';
import { RtpStatus } from 'src/common/enums/rtp.enums';
import { AliasType } from 'src/common/enums/alias.enums';
import {
  TransactionStatus,
  TransactionType,
} from 'src/common/enums/transaction.enums';

@Injectable()
export class RtpService {
  constructor(
    @InjectRepository(RTP) private rtpRepo: Repository<RTP>,
    @InjectRepository(Transaction) private txRepo: Repository<Transaction>,
    private cas: CasService,
  ) {}
  //   Request First
  async initiate(participantId: string, dto: any) {
    const rtp = this.rtpRepo.create({
      ...dto,
      participantId,
      status: RtpStatus.PENDING,
      expiresAt: new Date(Date.now() + 1 * 60 * 1000), //test
      //    expiresAt: new Date(Date.now() + 1 * 60 * 60 * 1000),
    });
    return this.rtpRepo.save(rtp);
  }

  //   Pay the request
  async approve(rtpMsgId: string, debtorAccount: string) {
    const rtp = await this.rtpRepo.findOne({ where: { rtpMsgId } });
    if (!rtp) throw new NotFoundException('RTP not found');

    if (rtp.status !== RtpStatus.PENDING) {
      throw new BadRequestException(
        `RTP cannot be processed. Current status: ${rtp.status}`,
      );
    }

    if (new Date() > rtp.expiresAt) {
      await this.rtpRepo.update(rtpMsgId, { status: RtpStatus.EXPIRED });
      throw new BadRequestException('RTP request has expired');
    }
    const creditor = await this.cas.resolveAlias(
      AliasType.MSISDN,
      rtp.requesterAlias,
    );

    const tx = this.txRepo.create({
      participantId: rtp.participantId,
      channel: TransactionType.RTP_PAYMENT,
      senderAlias: rtp.payerAlias,
      senderFinAddress: debtorAccount,
      receiverAlias: rtp.requesterAlias,
      receiverFinAddress: creditor.finAddress,
      amount: rtp.amount,
      currency: rtp.currency,
      status: TransactionStatus.COMPLETED,
      reference: rtp.message,
    });

    await this.rtpRepo.update(rtpMsgId, {
      status: RtpStatus.ACCEPTED,
      message: 'Accepted by the payer',
    });
    console.log('Accepted by the payer');
    return this.txRepo.save(tx);
  }

  async reject(rtpMsgId: string) {
    const rtp = await this.rtpRepo.findOne({ where: { rtpMsgId } });
    if (!rtp) throw new NotFoundException('RTP not found');

    if (rtp.status !== RtpStatus.PENDING) {
      throw new BadRequestException('RTP already processed');
    }
    console.log('Reject by the payer');
    return this.rtpRepo.update(rtpMsgId, {
      status: RtpStatus.REJECTED,
      message: 'Reject by the payer',
    });
  }
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
