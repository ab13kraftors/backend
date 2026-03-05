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
  participantId: string; // Who uploaded the batch

  @Column()
  originalFileName: string;

  @Column({ default: 0 })
  totalRecords: number;

  @Column({ default: 0 })
  processedRecords: number;

  @Column({ default: 0 })
  failedRecords: number;

  @Column({ type: 'enum', enum: BulkStatus, default: BulkStatus.PENDING })
  status: BulkBatch;

  @Column({ nullable: true })
  uploadedBy: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
