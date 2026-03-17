import {
  CustomerType,
  LinkageType,
  CustomerStatus,
  Gender,
  DocumentType,
} from 'src/common/enums/customer.enums';
import { Wallet } from 'src/wallet/entities/wallet.entity';
import { Account } from 'src/accounts/entities/account.entity';
import { PaymentInstrument } from 'src/payment-instruments/entities/payment-instrument.entity';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  OneToOne,
  JoinColumn,
  Index,
} from 'typeorm';

@Entity('customers')
@Index(['participantId', 'externalId'], { unique: true })
@Index(['participantId', 'msisdn'], { unique: true })
export class Customer {
  @PrimaryGeneratedColumn('uuid')
  customerId: string;

  @Column()
  participantId: string;

  @Column({ type: 'enum', enum: CustomerType })
  type: CustomerType;

  @Column()
  externalId: string;

  @Column({ type: 'enum', enum: LinkageType })
  linkageType: LinkageType;

  @Column({
    type: 'enum',
    enum: CustomerStatus,
    default: CustomerStatus.INACTIVE,
  })
  status: CustomerStatus;

  @Column({
    type: 'enum',
    enum: DocumentType,
    default: DocumentType.NATIONAL_ID,
  })
  documentType: DocumentType;

  @Column()
  documentId: string;

  @Column({ type: 'timestamp' })
  documentValidityDate: Date;

  @Column()
  msisdn: string;

  @Column({ nullable: true, type: 'boolean' })
  msisdnIsOwned?: boolean;

  @Column({ nullable: true, select: false })
  pinHash?: string;

  @Column({ nullable: true, default: 0 })
  pinFailedAttempts?: number;

  @Column({ nullable: true, type: 'timestamp' })
  pinLockedUntil?: Date;

  @Column({ nullable: true, default: false })
  mfaEnabled?: boolean;

  @Column({ nullable: true })
  defaultAccountId?: string;

  @Column({ nullable: true })
  defaultWalletId?: string;

  @Column({ nullable: true })
  defaultPaymentInstrumentId?: string;

  @Column({ nullable: true })
  firstName?: string;

  @Column({ nullable: true })
  lastName?: string;

  @Column({ type: 'enum', enum: Gender, nullable: true })
  gender?: Gender;

  @Column({ type: 'date', nullable: true })
  dob?: Date;

  @Column({ nullable: true })
  firstEmail?: string;

  @Column({ nullable: true })
  secondEmail?: string;

  @Column({ nullable: true })
  companyName?: string;

  @OneToOne(() => Account, { nullable: true })
  @JoinColumn({ name: 'defaultAccountId' })
  defaultAccount?: Account;

  @OneToOne(() => Wallet, { nullable: true })
  @JoinColumn({ name: 'defaultWalletId' })
  defaultWallet?: Wallet;

  @OneToOne(() => PaymentInstrument, { nullable: true })
  @JoinColumn({ name: 'defaultPaymentInstrumentId' })
  defaultPaymentInstrument?: PaymentInstrument;

  @OneToMany(() => Account, (account) => account.customer)
  accounts: Account[];

  @OneToMany(() => Wallet, (wallet) => wallet.customer)
  wallets: Wallet;

  @OneToMany(
    () => PaymentInstrument,
    (paymentInstrument) => paymentInstrument.customer,
  )
  paymentInstruments: PaymentInstrument[];

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp', nullable: true })
  updatedAt?: Date;
}
