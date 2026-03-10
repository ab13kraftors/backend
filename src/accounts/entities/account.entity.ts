import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { Currency } from 'src/common/enums/transaction.enums';
import { Wallet } from 'src/wallet/entities/wallet.entity';

export enum AccountStatus {
  ACTIVE = 'ACTIVE',
  FROZEN = 'FROZEN',
  CLOSED = 'CLOSED',
}

@Entity('accounts')
@Index('idx_account_finaddress', ['finAddress'], { unique: true })
@Index('idx_account_participant', ['participantId'])
export class Account {
  @PrimaryGeneratedColumn('uuid')
  accountId: string;

  @Column({ unique: true })
  finAddress: string;

  @Column()
  participantId: string;

  @Column({ type: 'enum', enum: Currency, default: Currency.SLE })
  currency: Currency;

  @Column({
    type: 'enum',
    enum: AccountStatus,
    default: AccountStatus.ACTIVE,
  })
  status: AccountStatus;

  // Optional: link to wallet if 1:1 relationship
  @OneToOne(() => Wallet, (wallet) => wallet.account, { nullable: true })
  @JoinColumn()
  wallet?: Wallet;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  // Future fields you will likely need
  // tier?: string;           // BASIC_KYC, FULL_KYC, CORPORATE
  // riskScore?: number;
  // frozenReason?: string;
}