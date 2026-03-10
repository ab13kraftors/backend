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

  @Column({ default: 0 })
  pinAttempts: number;

  @Column({ type: 'enum', enum: WalletStatus, default: WalletStatus.ACTIVE })
  status: WalletStatus;

  @OneToOne(() => Account, (account) => account.wallet, { nullable: true })
  @JoinColumn()
  account?: Account;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
