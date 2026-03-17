import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { LoanApplication } from './entities/loan-application.entity';
import { LoanRepayment } from './entities/loan-repayment.entity';

import { LoanService } from './loan.service';
import { LoanController } from './loan.controller';
import { LoanAdminController } from './loan-admin.controller';

import { WalletModule } from 'src/wallet/wallet.module';
import { LedgerModule } from 'src/ledger/ledger.module';
import { KycModule } from 'src/kyc/kyc.module';
import { AuthModule } from 'src/auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([LoanApplication, LoanRepayment]),

    WalletModule,
    LedgerModule,
    KycModule,
    AuthModule,
  ],

  controllers: [LoanController, LoanAdminController],

  providers: [LoanService],

  exports: [LoanService],
})
export class LoanModule {}
