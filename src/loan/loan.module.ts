import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LoanApplication } from './entities/loan-application.entity';
import { LoanRepayment } from './entities/loan-repayment.entity';
import { LoanService } from './loan.service';
import { LoanController } from './loan.controller';
import { LoanAdminController } from './loan-admin.controller';

import { WalletModule } from '../wallet/wallet.module';
import { LedgerModule } from '../ledger/ledger.module';
import { KycModule } from '../kyc/kyc.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([LoanApplication, LoanRepayment]),
    WalletModule,
    LedgerModule,
    KycModule,
  ],
  providers: [LoanService],
  controllers: [LoanController, LoanAdminController],
  exports: [LoanService],
})
export class LoanModule {}
