import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { LedgerEntrySide } from '../enums/ledger-entry-side.enums';
import { Currency } from 'src/common/enums/transaction.enums';

@Entity('ledger_entries')
@Index(['accountId'])
@Index(['reference'])
@Index(['idempotencyKey'], { unique: true })
export class LedgerEntry {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'account_id', type: 'uuid' })
  accountId: string;

  @Column({ name: 'side', type: 'enum', enum: LedgerEntrySide })
  side: LedgerEntrySide;

  @Column({ name: 'amount', type: 'numeric', precision: 18, scale: 2 })
  amount: string;

  @Column({
    name: 'currency',
    type: 'enum',
    enum: Currency,
    default: Currency.SLE,
  })
  currency: Currency;

  @Column({ name: 'reference', type: 'varchar', length: 100 })
  reference: string;

  @Column({ name: 'transaction_type', type: 'varchar', length: 50 })
  transactionType: string;

  @Column({ name: 'description', type: 'varchar', length: 255, nullable: true })
  description: string | null;

  @Column({ name: 'counterparty_account_id', type: 'uuid', nullable: true })
  counterpartyAccountId: string | null;

  @Column({
    name: 'idempotency_key',
    type: 'varchar',
    length: 150,
    unique: true,
  })
  idempotencyKey: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
