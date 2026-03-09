import { FundMethod } from 'src/common/enums/bulk.enums';
import {
  Currency,
  TransactionStatus,
} from 'src/common/enums/transaction.enums';
import {
  Column,
  CreateDateColumn,
  PrimaryGeneratedColumn,
  Entity,
} from 'typeorm';

@Entity('wallet_funding')
export class FundingWallet {
  @PrimaryGeneratedColumn('uuid')
  fundingId: string;

  @Column()
  walletId: string;

  @Column()
  participantId: string;

  @Column({ type: 'enum', enum: FundMethod, default: FundMethod.CARD })
  method: FundMethod;

  @Column({ type: 'decimal', precision: 18, scale: 2 })
  amount: number;

  @Column({ type: 'enum', enum: Currency, default: Currency.SLE })
  currency: Currency;

  @Column({ type: 'enum', enum: Currency, default: Currency.SLE })
  @Column({
    type: 'enum',
    enum: TransactionStatus,
    default: TransactionStatus.INITIATED,
  })
  status: TransactionStatus;

  @CreateDateColumn()
  createdAt: Date;
}
