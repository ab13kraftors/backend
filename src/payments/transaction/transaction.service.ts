import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Transaction } from '../entities/transaction.entity';
import { Repository } from 'typeorm';
import { TransactionStatus } from 'src/common/enums/transaction.enums';

@Injectable()
export class TransactionService {
  constructor(
    // Inject Transaction repository
    @InjectRepository(Transaction)
    private txRepo: Repository<Transaction>,
  ) {}

  // ================== findAll ==================
  // Returns paginated list of transactions
  async findAll(
    participantId: string,
    pageNo = 1,
    pageSize = 20,
    status?: TransactionStatus,
  ) {
    // Create query builder
    const qb = this.txRepo.createQueryBuilder('tx');

    // Filter by participant
    qb.where('tx.participantId = :participantId', { participantId });

    // Optional filter by status
    if (status) {
      qb.andWhere('tx.status = :status', { status });
    }

    // Apply sorting and pagination
    qb.orderBy('tx.createdAt', 'DESC')
      .skip((pageNo - 1) * pageSize)
      .take(pageSize);

    const [data, total] = await qb.getManyAndCount();

    // Return paginated response
    return {
      pageNo: Number(pageNo),
      pageSize: Number(pageSize),
      total,
      totalPages: Math.ceil(total / pageSize),
      data,
    };
  }

  // ================== findOne ==================
  // Returns a specific transaction by ID
  async findOne(txId: string) {
    const tx = await this.txRepo.findOne({ where: { txId } });

    if (!tx) throw new NotFoundException(`Transaction ${txId} does not exist.`);

    return tx;
  }
}
