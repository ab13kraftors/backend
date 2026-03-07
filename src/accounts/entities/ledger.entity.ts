import { CrDbType } from 'src/common/enums/transaction.enums';
import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('ledger_entries')
export class LedgerEntry {
  @PrimaryGeneratedColumn('uuid')
  entryId: string;

  @Column()
  accountId: string;

  @Column()
  txId: string;

  @Column({ type: 'enum', enum: CrDbType })
  type: CrDbType;

  @Column({ type: 'decimal', precision: 18, scale: 2 })
  amount: number;

  @CreateDateColumn()
  createdAt: Date;
}
