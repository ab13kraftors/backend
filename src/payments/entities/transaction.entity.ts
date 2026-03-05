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
} from 'typeorm';

@Entity('transactions')
export class Transaction {
  @PrimaryGeneratedColumn('uuid')
  txId: string;

  @Column()
  participantId: string;

  @Column({ type: 'enum', enum: TransactionType })
  channel: TransactionType;

  @Column()
  senderAlias: string;

  @Column()
  receiverAlias: string;

  @Column()
  senderFinAddress: string;

  @Column()
  receiverFinAddress: string;

  @Column({ type: 'decimal', precision: 18, scale: 2 })
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

  @Column({ nullable: true })
  externalId?: string;

  @CreateDateColumn()
  createdAt: Date;
}
