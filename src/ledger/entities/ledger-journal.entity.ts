import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  OneToMany,
} from 'typeorm';
import { LedgerPosting } from './ledger-posting.entity';

@Entity('ledger_journals')
@Index('idx_journal_txid', ['txId'], { unique: true })
@Index('idx_journal_idempotency', ['idempotencyKey'])
@Index('idx_journal_participant', ['participantId'])
export class LedgerJournal {
  @PrimaryGeneratedColumn('uuid')
  journalId: string;

  @Column({ unique: true })
  txId: string; // business / idempotent transaction identifier

  @Column({ nullable: true, unique: true })
  idempotencyKey?: string; // client-provided key to prevent duplicates

  @Column()
  reference: string; // human readable purpose e.g. "RTP approval – req-abc123"

  @Column()
  participantId: string;

  @Column()
  postedBy: string; // who triggered: participantId, system, admin-uuid, etc.

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  postedAt: Date;

  @OneToMany(() => LedgerPosting, (posting) => posting.journal, {
    cascade: true,
    eager: true,
  })
  postings: LedgerPosting[];

  @Column({ nullable: true })
  reversesTxId?: string; // points to the txId this journal reverses

  @Column({ nullable: true })
  reversedByTxId?: string; // points to the reversal txId (for original)
}
