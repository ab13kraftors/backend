import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Currency } from 'src/common/enums/transaction.enums';
import { Customer } from 'src/customer/entities/customer.entity';
import { Wallet } from 'src/wallet/entities/wallet.entity';
import { AccountType, AccountStatus } from '../enums/account.enum';

@Entity('accounts')
@Index('IDX_ACCOUNT_ACCOUNT_NUMBER', ['accountNumber'], { unique: true })
@Index('IDX_ACCOUNT_FIN_ADDRESS', ['finAddress'], { unique: true })
@Index('IDX_ACCOUNT_CUSTOMER_TYPE', ['customerId', 'type'])
@Index('IDX_ACCOUNT_WALLET_TYPE', ['walletId', 'type'])
export class CreateAccountDto {
  @PrimaryGeneratedColumn('uuid')
  accountId: string;

  @Column({ type: 'varchar', length: 30, unique: true })
  accountNumber: string;

  @Column({ type: 'uuid', nullable: true })
  customerId: string | null;

  @Column({ type: 'uuid', nullable: true })
  walletId: string | null;

  @Column({ type: 'varchar', length: 100 })
  participantId: string;

  @Column({
    type: 'enum',
    enum: Currency,
    default: Currency.SLE,
  })
  currency: Currency;

  @Column({
    type: 'enum',
    enum: AccountType,
  })
  type: AccountType;

  @Column({
    type: 'enum',
    enum: AccountStatus,
    default: AccountStatus.INACTIVE,
  })
  status: AccountStatus;

  @Column({ type: 'varchar', length: 255, nullable: true, unique: true })
  finAddress: string | null;

  @Column({ type: 'boolean', default: false })
  isDefault: boolean;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, any> | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => Customer, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'customerId' })
  customer?: Customer | null;

  @OneToOne(() => Wallet, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'walletId' })
  wallet?: Wallet | null;
}
