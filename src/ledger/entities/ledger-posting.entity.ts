import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { LedgerJournal } from './ledger-journal.entity';

@Entity('ledger_postings')
@Index('idx_posting_account', ['accountId'])
@Index('idx_posting_created', ['createdAt'])
export class LedgerPosting {
  @PrimaryGeneratedColumn('uuid')
  postingId: string;

  @ManyToOne(() => LedgerJournal, (journal) => journal.postings, {
    onDelete: 'CASCADE',
  })
  journal: LedgerJournal;

  @Column()
  @Index() // repeated for clarity
  accountId: string;

  @Column({ type: 'numeric', precision: 18, scale: 6 }) // better than string for sums
  amount: number; // ← change to number if you trust pg numeric, or keep string

  @Column({ type: 'enum', enum: ['DEBIT', 'CREDIT'] })
  side: 'DEBIT' | 'CREDIT';

  @Column({ nullable: true })
  memo?: string;

  @CreateDateColumn()
  createdAt: Date;
}
