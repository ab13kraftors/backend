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
export class BulkBatch {
  @PrimaryGeneratedColumn('uuid')
  bulkId: string;

  @Index()
  @Column()
  participantId: string;

  @Column()
  debtorBic: string;

  @Column()
  debtorAccount: string;

  @Column()
  fileName: string;

  @Column({ default: 0 })
  totalRecords: number;

  @Column({ default: 0 })
  processedRecords: number;

  @Column({ default: 0 })
  failedRecords: number;

  @Column({ type: 'enum', enum: BulkStatus, default: BulkStatus.PENDING })
  status: BulkStatus;

  @Column({ nullable: true })
  uploadedBy: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn({ nullable: true })
  updatedAt: Date;
}
