import { LoanStatus } from 'src/common/enums/loan.enums';
import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
} from 'typeorm';

@Entity('loan_applications')
export class LoanApplication {
  @PrimaryGeneratedColumn('uuid')
  loanId: string;

  @Column()
  ccuuid: string;

  @Column()
  participantId: string;

  @Column({ type: 'decimal', precision: 18, scale: 4 })
  requestedAmount: string;

  @Column({ type: 'decimal', precision: 18, scale: 4, nullable: true })
  approvedAmount: string;

  @Column({ type: 'decimal', precision: 18, scale: 4, default: 0 })
  outstandingBalance: string;

  @Column({ type: 'enum', enum: LoanStatus })
  status: LoanStatus;

  @Column({ nullable: true })
  purpose: string;

  @CreateDateColumn()
  appliedAt: Date;

  @Column({ nullable: true })
  reviewedAt: Date;

  @Column({ nullable: true })
  reviewedBy: string;

  @Column({ nullable: true })
  disbursedAt: Date;

  @Column({ type: 'date', nullable: true })
  dueDate: Date;

  @Column({ nullable: true })
  ledgerJournalId: string;
}
