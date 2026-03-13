import { TransactionType } from 'src/common/enums/transaction.enums';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity('withdrawals')
export class Withdrawal {
  @PrimaryGeneratedColumn('uuid')
  withdrawalId: string;

  @Column()
  participantId: string;

  @Column()
  walletId: string;

  @Column()
  ccuuid: string;

  @Column({ type: 'decimal', precision: 18, scale: 2 })
  amount: string;

  @Column()
  destination: string;

  @Column({
    type: 'enum',
    enum: TransactionType,
    default: TransactionType.WALLET_WITHDRAWAL, // Set a default
  })
  type: TransactionType;

  @Column()
  status: string;

  @CreateDateColumn()
  createdAt: Date;
}
