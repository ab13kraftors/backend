import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import {
  Currency,
  TransactionStatus,
} from 'src/common/enums/transaction.enums';
import { FundMethod } from 'src/common/enums/bulk.enums';

@Entity('funding')
@Index(['participantId', 'customerId'])
@Index(['idempotencyKey'], { unique: true })
export class Funding {
  @PrimaryGeneratedColumn('uuid')
  fundingId: string;

  @Column()
  participantId: string;

  @Column()
  customerId: string;

  @Column({ nullable: true })
  accountId?: string;

  @Column({ nullable: true })
  walletId?: string;

  @Column({ nullable: true })
  sourceFinAddress?: string;

  @Column({ nullable: true })
  destinationFinAddress?: string;

  @Column({ type: 'enum', enum: FundMethod })
  method: FundMethod;

  @Column({ type: 'decimal', precision: 18, scale: 2 })
  amount: string;

  @Column({ type: 'enum', enum: Currency })
  currency: Currency;

  @Column({
    type: 'enum',
    enum: TransactionStatus,
    default: TransactionStatus.INITIATED,
  })
  status: TransactionStatus;

  @Column({ nullable: true })
  journalId?: string;

  @Column({ nullable: true })
  idempotencyKey?: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
