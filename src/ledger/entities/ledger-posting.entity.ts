import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { LedgerJournal } from './ledger-journal.entity';
import { LedgerEntrySide } from '../enums/ledger-entry-side.enums';
import { Currency } from 'src/common/enums/transaction.enums';

@Entity('ledger_postings')
@Index('IDX_LEDGER_POSTING_ACCOUNT_ID', ['accountId'])
@Index('IDX_LEDGER_POSTING_JOURNAL_ID', ['journalId'])
@Index(['accountId', 'side'])
@Index(['journalId', 'accountId'])
export class LedgerPosting {
  @PrimaryGeneratedColumn('uuid')
  postingId: string;

  @Column({ type: 'uuid' })
  journalId: string;

  @Column({ type: 'uuid' })
  accountId: string;

  @Column({
    type: 'enum',
    enum: LedgerEntrySide,
  })
  side: LedgerEntrySide;

  @Column({ type: 'numeric', precision: 20, scale: 6 })
  amount: string;

  @Column({
    type: 'enum',
    enum: Currency,
    default: Currency.SLE,
  })
  currency: Currency;

  @Column({ type: 'varchar', length: 255, nullable: true })
  memo?: string;

  @ManyToOne(() => LedgerJournal, (journal) => journal.postings, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'journalId' })
  journal: LedgerJournal;
}
