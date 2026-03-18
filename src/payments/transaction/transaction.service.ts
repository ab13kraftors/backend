import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Transaction } from './entities/transaction.entity';
import { EntityManager, Repository } from 'typeorm';
import {
  Currency,
  TransactionStatus,
  TransactionType,
} from 'src/common/enums/transaction.enums';
import { Cron } from '@nestjs/schedule';

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

  async createTx(manager, data: Partial<Transaction>) {
    const repo = manager ? manager.getRepository(Transaction) : this.txRepo;
    return repo.save(repo.create(data));
  }

  async updateTx(
    manager: EntityManager,
    txId: string,
    participantId: string,
    updates: Partial<Transaction>,
  ) {
    const repo = manager ? manager.getRepository(Transaction) : this.txRepo;
    const tx = await repo.findOne({ where: { txId, participantId } });

    if (!tx) throw new NotFoundException('Transaction not found');

    Object.assign(tx, updates);

    if (updates.status === TransactionStatus.COMPLETED) {
      tx.processedAt = new Date();
    }

    return repo.save(tx);
  }

  async findByExternalId(externalId: string, participantId: string) {
    return this.txRepo.findOne({
      where: { externalId, participantId },
    });
  }

  async fixStuckTransactions() {
    const timeout = new Date(Date.now() - 5 * 60 * 1000); // 5 min

    const stuck = await this.txRepo.find({
      where: { status: TransactionStatus.PROCESSING },
    });

    for (const tx of stuck) {
      if (!tx.journalId && tx.createdAt < timeout) {
        tx.status = TransactionStatus.FAILED;
        tx.failureReason = 'Timeout Incomplete Transaction';
        tx.processedAt = new Date();
        await this.txRepo.save(tx);
      }
    }
  }

  @Cron('*/2 * * * *') // every 2 minutes
  async handleStuckTxCron() {
    await this.fixStuckTransactions();
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
}
