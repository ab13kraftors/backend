import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CardInstrument } from './entities/card.entity';
import { MobileMoneyInstrument } from './entities/mobile-money.entity';
import { Transaction } from 'src/payments/entities/transaction.entity';

import {
  PaymentInstrumentsController,
  PaymentInstrumentsWebhookController,
} from './payment-instruments.controller';
import { PaymentInstrumentsService } from './payment-instruments.service';

import { WalletModule } from 'src/wallet/wallet.module';
import { LedgerModule } from 'src/ledger/ledger.module';
import { AccountsModule } from 'src/accounts/accounts.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CardInstrument,
      MobileMoneyInstrument,
      Transaction,
    ]),
    forwardRef(() => WalletModule),
    AccountsModule,
    LedgerModule,
  ],
  controllers: [
    PaymentInstrumentsController,
    PaymentInstrumentsWebhookController,
  ],
  providers: [PaymentInstrumentsService],
  exports: [PaymentInstrumentsService],
})
export class PaymentInstrumentsModule {}
