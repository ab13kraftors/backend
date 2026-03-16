import { ChildEntity, Column, Index } from 'typeorm';
import { PaymentInstrument } from './payment-instrument.entity';
import { PaymentInstrumentType } from '../enums/payment-instrument.enum';
import { MobileMoneyProvider } from '../enums/mobile-money.enum';

@ChildEntity(PaymentInstrumentType.MOBILE_MONEY)
@Index(['participantId', 'customerId', 'msisdn'], { unique: true })
export class MobileMoneyInstrument extends PaymentInstrument {
  @Column({
    type: 'enum',
    enum: MobileMoneyProvider,
  })
  provider: MobileMoneyProvider;

  @Column()
  msisdn: string;

  @Column({ nullable: true })
  accountName?: string;

  @Column({ nullable: true })
  providerReference?: string;
}
