import { WalletStatus } from 'src/common/enums/banking.enums';
import { Currency } from 'src/common/enums/transaction.enums';
import { Account } from 'src/accounts/entities/account.entity';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  OneToOne,
  JoinColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('wallets')
@Index(['finAddress'], { unique: true })
@Index(['participantId'])
@Index(['customerId'], { unique: true })
export class Wallet {
  @PrimaryGeneratedColumn('uuid')
  walletId: string;

  @Column({ type: 'uuid' })
  customerId: string;

  @Column({ type: 'varchar', length: 100 })
  participantId: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  finAddress: string;

  @Column({ type: 'uuid', nullable: true })
  accountId: string;

  @Column({
    type: 'enum',
    enum: Currency,
    default: Currency.SLE,
  })
  currency: Currency;

  @Column({ type: 'int', default: 0 })
  pinAttempts: number;

  @Column({
    type: 'enum',
    enum: WalletStatus,
    default: WalletStatus.INACTIVE,
  })
  status: WalletStatus;

  @OneToOne(() => Account, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'accountId' })
  account?: Account | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
