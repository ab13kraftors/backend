import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  TableInheritance,
  UpdateDateColumn,
} from 'typeorm';
import {
  PaymentInstrumentStatus,
  PaymentInstrumentType,
} from '../enums/payment-instrument.enum';

@Entity('payment_instruments')
@TableInheritance({ column: { type: 'varchar', name: 'instrumentType' } })
@Index(['participantId', 'customerId'])
@Index(['participantId', 'accountId'])
export abstract class PaymentInstrument {
  @PrimaryGeneratedColumn('uuid')
  instrumentId: string;

  @Column()
  participantId: string;

  @Column()
  customerId: string;

  @Column({ nullable: true })
  accountId?: string | null;

  @Column({ nullable: true })
  walletId?: string | null;

  @Column({
    type: 'enum',
    enum: PaymentInstrumentType,
  })
  instrumentType: PaymentInstrumentType;

  @Column({
    type: 'enum',
    enum: PaymentInstrumentStatus,
    default: PaymentInstrumentStatus.ACTIVE,
  })
  status: PaymentInstrumentStatus;

  @Column({ default: false })
  isDefault: boolean;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, any> | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
