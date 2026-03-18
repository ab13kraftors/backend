import { BulkStatus } from 'src/common/enums/bulk.enums';
import {
  Column,
  CreateDateColumn,
  PrimaryGeneratedColumn,
  Entity,
  Index,
  UpdateDateColumn,
} from 'typeorm';

@Entity('bulk_batches')
@Index(['participantId', 'status'])
export class BulkBatch {
  @PrimaryGeneratedColumn('uuid')
  bulkId: string;

  @Index()
  @Column()
  participantId: string;

  @Column({ nullable: true })
  customerId?: string;

  @Column({ nullable: true })
  debtorBic?: string;

  @Column()
  sourceType: 'ACCOUNT' | 'WALLET';

  @Column({ nullable: true })
  sourceAccountId?: string;

  @Column({ nullable: true })
  sourceWalletId?: string;

  @Column()
  sourceFinAddress: string;

  @Column()
  fileName: string;

  @Column({ type: 'enum', enum: ['SLE'], default: 'SLE' })
  currency: 'SLE';

  @Column({ default: 0 })
  totalRecords: number;

  @Column({ default: 0 })
  processedRecords: number;

  @Column({ default: 0 })
  failedRecords: number;

  @Column({
    type: 'decimal',
    precision: 18,
    scale: 2,
    default: '0.00',
  })
  totalAmount: string;

  @Column({
    type: 'decimal',
    precision: 18,
    scale: 2,
    default: '0.00',
  })
  processedAmount: string;

  @Column({
    type: 'enum',
    enum: BulkStatus,
    default: BulkStatus.PENDING,
  })
  status: BulkStatus;

  @Column({ nullable: true })
  uploadedBy?: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn({ nullable: true })
  updatedAt: Date;
}
