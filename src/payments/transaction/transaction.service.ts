import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Transaction } from '../entities/transaction.entity';
import { Repository } from 'typeorm';
import { TransactionStatus } from 'src/common/enums/transaction.enums';

@Injectable()
export class TransactionService {
  constructor(
    @InjectRepository(Transaction)
    private txRepo: Repository<Transaction>,
  ) {}

  async findAll(
    participantId: string,
    pageNo = 1,
    pageSize = 20,
    status?: TransactionStatus, // Made optional
  ) {
    const qb = this.txRepo.createQueryBuilder('tx');

    // 1. Build Conditions
    qb.where('tx.participantId = :participantId', { participantId });
    if (status) {
      qb.andWhere('tx.status = :status', { status });
    }

    // 2. Add Pagination & Sorting
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

  async findOne(txId: string) {
    const tx = await this.txRepo.findOne({ where: { txId } });
    if (!tx) throw new NotFoundException(`Transaction ${txId} does not exist.`);
    return tx;
  }
}
