import { Module, forwardRef } from '@nestjs/common';
import { FundingController } from './funding.controller';
import { FundingService } from './funding.service';
import { TypeOrmModule } from '@nestjs/typeorm';

import { FundingWallet } from './entities/funding.entity';
import { Wallet } from 'src/wallet/entities/wallet.entity';
import { Transaction } from '../entities/transaction.entity';

import { LedgerModule } from 'src/ledger/ledger.module';
import { AccountsModule } from 'src/accounts/accounts.module';
import { PaymentsModule } from '../payments.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([FundingWallet, Wallet, Transaction]),
    LedgerModule,
    AccountsModule,
    forwardRef(() => PaymentsModule),
  ],
  controllers: [FundingController],
  providers: [FundingService],
  exports: [FundingService],
})
export class FundingModule {}
