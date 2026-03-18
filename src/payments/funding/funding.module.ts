import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { FundingController } from './funding.controller';
import { FundingService } from './funding.service';
import { Funding } from './entities/funding.entity';

import { LedgerModule } from 'src/ledger/ledger.module';
import { AccountsModule } from 'src/accounts/accounts.module';
import { WalletModule } from 'src/wallet/wallet.module';
import { ComplianceModule } from 'src/compliance/compliance.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Funding]),
    LedgerModule,
    AccountsModule,
    ComplianceModule,
    WalletModule,
  ],
  controllers: [FundingController],
  providers: [FundingService],
  exports: [FundingService],
})
export class FundingModule {}
