import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
} from 'typeorm';

@Entity('loan_repayments')
export class LoanRepayment {
  @PrimaryGeneratedColumn('uuid')
  repaymentId: string;

  @Column()
  loanId: string;

  @Column({ type: 'decimal', precision: 18, scale: 4 })
  amount: string;

  @Column({ type: 'decimal', precision: 18, scale: 4 })
  walletBalanceBefore: string;

  @Column()
  ledgerJournalId: string;

  @CreateDateColumn()
  repaidAt: Date;
}
