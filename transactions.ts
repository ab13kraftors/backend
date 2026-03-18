
/////////////////////////
// FILE: src/payments/transaction/transaction.controller.ts
/////////////////////////
import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { TransactionService } from './transaction.service';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import {
  Currency,
  TransactionStatus,
  TransactionType,
} from 'src/common/enums/transaction.enums';
import { Participant } from 'src/common/decorators/participant/participant.decorator';

@UseGuards(JwtAuthGuard)
@Controller('/api/fp/transactions')
export class TransactionController {
  constructor(private readonly txService: TransactionService) {}

  @Get()
  async findAll(
    @Participant() participantId: string,
    @Query('pageNo') pageNo: number = 1,
    @Query('pageSize') pageSize: number = 20,
    @Query('status') status?: TransactionStatus,
    @Query('channel') channel?: TransactionType,
    @Query('currency') currency?: Currency,
    @Query('customerId') customerId?: string,
    @Query('finAddress') finAddress?: string,
  ) {
    return this.txService.findAll({
      participantId,
      pageNo: Number(pageNo),
      pageSize: Number(pageSize),
      status,
      channel,
      currency,
      customerId,
      finAddress,
    });
  }

  @Get(':txId')
  async findOne(
    @Participant() participantId: string,
    @Param('txId') txId: string,
  ) {
    return this.txService.findOne(participantId, txId);
  }
}

/////////////////////////
// FILE: src/payments/transaction/transaction.module.ts
/////////////////////////
import { Module } from '@nestjs/common';
import { TransactionController } from './transaction.controller';
import { TransactionService } from './transaction.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Transaction } from './entities/transaction.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Transaction])],
  controllers: [TransactionController],
  providers: [TransactionService],
  exports: [TransactionService],
})
export class TransactionModule {}

/////////////////////////
// FILE: src/payments/transaction/transaction.service.ts
/////////////////////////
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Transaction } from './entities/transaction.entity';
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

  async createTx(manager, data: Partial<Transaction>) {
    const repo = manager ? manager.getRepository(Transaction) : this.txRepo;
    return repo.save(repo.create(data));
  }

  async updateTx(manager, txId: string, updates: Partial<Transaction>) {
    const repo = manager ? manager.getRepository(Transaction) : this.txRepo;

    await repo.update({ txId }, updates);
    return repo.findOne({ where: { txId } });
  }

  async findByExternalId(externalId: string) {
    return this.txRepo.findOne({
      where: { externalId },
    });
  }

  async fixStuckTransactions() {
    const stuck = await this.txRepo.find({
      where: { status: TransactionStatus.PROCESSING },
    });

    for (const tx of stuck) {
      if (!tx.journalId) {
        tx.status = TransactionStatus.FAILED;
        tx.failureReason = 'Incomplete Transaction';
        await this.txRepo.save(tx);
      }
    }
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

/////////////////////////
// FILE: src/payments/transaction/entities/transaction.entity.ts
/////////////////////////
import {
  Currency,
  TransactionType,
  TransactionStatus,
} from 'src/common/enums/transaction.enums';
import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('transactions')
@Index(['participantId', 'status', 'createdAt'])
@Index(['participantId', 'channel', 'createdAt'])
@Index(['senderFinAddress', 'createdAt'])
@Index(['receiverFinAddress', 'createdAt'])
@Index(['externalId'], { unique: true })
export class Transaction {
  @PrimaryGeneratedColumn('uuid')
  txId: string;

  @Column()
  participantId: string;

  @Column({ type: 'enum', enum: TransactionType })
  channel: TransactionType;

  @Column({ nullable: true })
  customerId?: string;

  @Column({ nullable: true })
  senderAlias?: string;

  @Column({ nullable: true })
  receiverAlias?: string;

  @Column()
  senderFinAddress: string;

  @Column()
  receiverFinAddress: string;

  @Column({ nullable: true })
  sourceType?: 'ACCOUNT' | 'WALLET';

  @Column({ nullable: true })
  sourceAccountId?: string;

  @Column({ nullable: true })
  sourceWalletId?: string;

  @Column({ nullable: true })
  destinationType?: 'ACCOUNT' | 'WALLET';

  @Column({ nullable: true })
  destinationAccountId?: string;

  @Column({ nullable: true })
  destinationWalletId?: string;

  @Column({ type: 'decimal', precision: 18, scale: 2, default: '0.00' })
  amount: number;

  @Column({ type: 'enum', enum: Currency, default: Currency.SLE })
  currency: Currency;

  @Column({
    type: 'enum',
    enum: TransactionStatus,
    default: TransactionStatus.INITIATED,
  })
  status: TransactionStatus;

  @Column({ nullable: true })
  reference?: string;

  @Column({ nullable: true, unique: true })
  externalId?: string;

  @Column({ nullable: true })
  narration?: string;

  @Column({ nullable: true })
  failureReason?: string;

  @Column({ type: 'timestamp', nullable: true })
  processedAt?: Date;

  @Column({ nullable: true })
  journalId?: string;

  @Column({ nullable: true })
  relatedRtpMsgId?: string;

  @Column({ nullable: true })
  relatedBulkId?: string;

  @Column({ nullable: true })
  relatedQrPayload?: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
