import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Transaction } from '../entities/transaction.entity';
import { CreditTransferService } from './credit-transfer.service';
import { CreditTransferController } from './credit-transfer.controller';

import { LedgerModule } from 'src/ledger/ledger.module';
import { CasModule } from 'src/cas/cas.module';
import { AccountsModule } from 'src/accounts/accounts.module';
import { WalletModule } from 'src/wallet/wallet.module';
import { CustomerModule } from 'src/customer/customer.module';
import { PaymentsService } from '../payments.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Transaction]),
    LedgerModule,
    CasModule,
    AccountsModule,
    forwardRef(() => WalletModule),
    forwardRef(() => CustomerModule),
  ],
  providers: [CreditTransferService, PaymentsService],
  controllers: [CreditTransferController],
  exports: [CreditTransferService],
})
export class CreditTransferModule {}
