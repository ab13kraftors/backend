import { ChildEntity, Column, Index } from 'typeorm';
import { CardBrand } from 'src/common/enums/card.enums';
import { PaymentInstrument } from './payment-instrument.entity';
import { PaymentInstrumentType } from '../enums/payment-instrument.enum';

@ChildEntity(PaymentInstrumentType.CARD)
@Index(['participantId', 'customerId', 'last4'])
export class CardInstrument extends PaymentInstrument {
  @Column({ select: false })
  token: string;

  @Column()
  bin: string;

  @Column()
  last4: string;

  @Column({ type: 'enum', enum: CardBrand })
  brand: CardBrand;

  @Column('int')
  expMonth: number;

  @Column('int')
  expYear: number;

  @Column({ nullable: true })
  holderName?: string;

  @Column({ nullable: true })
  schemeReference?: string;
}
