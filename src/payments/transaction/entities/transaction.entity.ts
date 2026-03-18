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
