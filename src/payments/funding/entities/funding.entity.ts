import { FundMethod } from 'src/common/enums/bulk.enums';
import {
  Currency,
  TransactionStatus,
} from 'src/common/enums/transaction.enums';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('wallet_funding')
@Index(['participantId', 'walletId', 'createdAt'])
@Index(['participantId', 'status', 'createdAt'])
@Index(['idempotencyKey'], { unique: true })
export class FundingWallet {
  @PrimaryGeneratedColumn('uuid')
  fundingId: string;

  @Column()
  walletId: string;

  @Column()
  participantId: string;

  @Column({ nullable: true })
  customerId?: string;

  @Column({ nullable: true })
  accountId?: string;

  @Column({ nullable: true })
  sourceFinAddress?: string;

  @Column({ nullable: true })
  destinationFinAddress?: string;

  @Column({ type: 'enum', enum: FundMethod, default: FundMethod.CARD })
  method: FundMethod;

  @Column({ type: 'decimal', precision: 18, scale: 2 })
  amount: string;

  @Column({ type: 'enum', enum: Currency, default: Currency.SLE })
  currency: Currency;

  @Column({
    type: 'enum',
    enum: TransactionStatus,
    default: TransactionStatus.INITIATED,
  })
  status: TransactionStatus;

  @Column({ nullable: true, unique: true })
  externalReference?: string;

  @Column({ nullable: true, unique: true })
  idempotencyKey?: string;

  @Column({ nullable: true })
  ledgerTxId?: string;

  @Column({ nullable: true })
  journalId?: string;

  @Column({ nullable: true })
  failureReason?: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
