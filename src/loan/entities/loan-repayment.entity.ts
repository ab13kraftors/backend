import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('loan_repayments')
@Index(['loanId', 'customerId'])
export class LoanRepayment {
  @PrimaryGeneratedColumn('uuid')
  repaymentId: string;

  @Column()
  @Index()
  loanId: string;

  @Column()
  customerId: string;

  @Column()
  participantId: string;

  @Column({ type: 'decimal', precision: 18, scale: 4 })
  amount: string;

  @Column({ type: 'decimal', precision: 18, scale: 4 })
  outstandingBefore: string;

  @Column({ type: 'decimal', precision: 18, scale: 4 })
  outstandingAfter: string;

  @Column()
  ledgerJournalId: string;

  @Column({ type: 'varchar', nullable: true })
  idempotencyKey: string | null;

  @CreateDateColumn()
  repaidAt: Date;
}
