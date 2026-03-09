import { WalletStatus } from 'src/common/enums/banking.enums';
import { Currency } from 'src/common/enums/transaction.enums';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity('wallets')
export class Wallet {
  @PrimaryGeneratedColumn('uuid')
  walletId: string;

  @Column()
  ccuuid: string;

  @Column()
  participantId: string;

  @Column({ unique: true })
  finAddress: string;

  @Column({ type: 'enum', enum: Currency, default: Currency.SLE })
  currency: Currency;

  @Column({ type: 'decimal', precision: 18, scale: 2, default: 0 })
  balance: number;

  @Column({ default: 0 })
  pinAttempts: number;

  @Column({ type: 'enum', enum: WalletStatus, default: WalletStatus.ACTIVE })
  status: WalletStatus;

  @CreateDateColumn()
  createdAt: Date;
}
