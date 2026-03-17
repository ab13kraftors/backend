import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { LoanStatus } from 'src/common/enums/loan.enums';

@Entity('loan_applications')
@Index(['customerId', 'status'])
export class LoanApplication {
  @PrimaryGeneratedColumn('uuid')
  loanId: string;

  @Column()
  @Index()
  customerId: string;

  @Column()
  participantId: string;

  @Column({ type: 'decimal', precision: 18, scale: 4 })
  requestedAmount: string;

  @Column({ type: 'decimal', precision: 18, scale: 4, nullable: true })
  approvedAmount: string;

  @Column({ type: 'decimal', precision: 18, scale: 4, default: '0.0000' })
  outstandingBalance: string;

  @Column({ type: 'enum', enum: LoanStatus, default: LoanStatus.PENDING })
  status: LoanStatus;

  @Column({ type: 'varchar', nullable: true, length: 500 })
  purpose: string | null;

  @Column({ type: 'varchar', nullable: true, length: 500 })
  rejectionReason: string | null;

  @CreateDateColumn()
  appliedAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  reviewedAt: Date | null;

  @Column({ type: 'varchar', nullable: true })
  reviewedBy: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  disbursedAt: Date | null;

  @Column({ type: 'date', nullable: true })
  dueDate: Date | null;

  @Column({ type: 'varchar', nullable: true })
  ledgerJournalId: string | null;
}
