import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Transaction } from '../transaction/entities/transaction.entity';
import { QrController } from './qr.controller';
import { QrService } from './qr.service';
import { CasModule } from 'src/cas/cas.module';
import { LedgerModule } from 'src/ledger/ledger.module';
import { AccountsModule } from 'src/accounts/accounts.module';
import { WalletModule } from 'src/wallet/wallet.module';
import { CustomerModule } from 'src/customer/customer.module';
import { PaymentsService } from '../payments.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Transaction]),
    CasModule,
    LedgerModule,
    AccountsModule,
    forwardRef(() => WalletModule),
    forwardRef(() => CustomerModule),
  ],
  controllers: [QrController],
  providers: [QrService, PaymentsService],
  exports: [QrService],
})
export class QrModule {}
