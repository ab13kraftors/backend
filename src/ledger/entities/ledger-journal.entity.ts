import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Currency } from 'src/common/enums/transaction.enums';
import { LedgerPosting } from './ledger-posting.entity';

@Entity('ledger_journals')
@Index('IDX_LEDGER_JOURNAL_TX_ID', ['txId'], { unique: true })
@Index('IDX_LEDGER_JOURNAL_IDEMPOTENCY', ['idempotencyKey'], { unique: true })
export class LedgerJournal {
  @PrimaryGeneratedColumn('uuid')
  journalId: string;

  @Column({ type: 'varchar', length: 120, unique: true })
  txId: string;

  @Column({ type: 'varchar', length: 150, nullable: true, unique: true })
  idempotencyKey?: string;

  @Column({ type: 'varchar', length: 255 })
  reference: string;

  @Column({ type: 'varchar', length: 100 })
  participantId: string;

  @Column({ type: 'varchar', length: 100, default: 'system' })
  postedBy: string;

  @Column({
    type: 'enum',
    enum: Currency,
    default: Currency.SLE,
  })
  currency: Currency;

  @Column({ type: 'varchar', length: 120, nullable: true })
  reversesTxId?: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  reversedByTxId?: string | null;

  @CreateDateColumn()
  postedAt: Date;

  @OneToMany(() => LedgerPosting, (posting) => posting.journal, {
    cascade: true,
  })
  postings: LedgerPosting[];
}
