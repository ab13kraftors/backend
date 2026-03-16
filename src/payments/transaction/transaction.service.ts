import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Transaction } from '../entities/transaction.entity';
import { Repository } from 'typeorm';
import {
  Currency,
  TransactionStatus,
  TransactionType,
} from 'src/common/enums/transaction.enums';

type FindAllParams = {
  participantId: string;
  pageNo?: number;
  pageSize?: number;
  status?: TransactionStatus;
  channel?: TransactionType;
  currency?: Currency;
  customerId?: string;
  finAddress?: string;
};

@Injectable()
export class TransactionService {
  constructor(
    @InjectRepository(Transaction)
    private readonly txRepo: Repository<Transaction>,
  ) {}

  async findAll(params: FindAllParams) {
    const {
      participantId,
      pageNo = 1,
      pageSize = 20,
      status,
      channel,
      currency,
      customerId,
      finAddress,
    } = params;

    const qb = this.txRepo.createQueryBuilder('tx');

    qb.where('tx.participantId = :participantId', { participantId });

    if (status) {
      qb.andWhere('tx.status = :status', { status });
    }

    if (channel) {
      qb.andWhere('tx.channel = :channel', { channel });
    }

    if (currency) {
      qb.andWhere('tx.currency = :currency', { currency });
    }

    if (customerId) {
      qb.andWhere('tx.customerId = :customerId', { customerId });
    }

    if (finAddress) {
      qb.andWhere(
        '(tx.senderFinAddress = :finAddress OR tx.receiverFinAddress = :finAddress)',
        { finAddress },
      );
    }

    qb.orderBy('tx.createdAt', 'DESC')
      .skip((pageNo - 1) * pageSize)
      .take(pageSize);

    const [data, total] = await qb.getManyAndCount();

    return {
      pageNo: Number(pageNo),
      pageSize: Number(pageSize),
      total,
      totalPages: Math.ceil(total / pageSize),
      data,
    };
  }

  async findOne(participantId: string, txId: string) {
    const tx = await this.txRepo.findOne({
      where: { txId, participantId },
    });

    if (!tx) {
      throw new NotFoundException(`Transaction ${txId} does not exist.`);
    }

    return tx;
  }
}
