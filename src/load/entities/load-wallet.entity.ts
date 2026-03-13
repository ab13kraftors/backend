import {
  CardTransaction,
  TransactionType,
} from 'src/common/enums/transaction.enums';
import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  Index,
} from 'typeorm';

@Entity('load_transactions')
export class LoadTransaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  participantId: string;

  @Column()
  @Index({ unique: true })
  idempotencyKey: string; // Crucial: prevents double charging

  @Column()
  ccuuid: string;

  @Column()
  walletId: string;

  @Column({ type: 'decimal', precision: 18, scale: 2 })
  amount: string;

  @Column({
    type: 'enum',
    enum: CardTransaction,
    default: CardTransaction.INITIATED,
  })
  status: CardTransaction;

  @Column({
    type: 'enum',
    enum: TransactionType,
    default: TransactionType.CARD_LOAD,
  })
  type: TransactionType;

  @Column({ nullable: true })
  gatewayRef: string;

  @CreateDateColumn()
  createdAt: Date;
}
