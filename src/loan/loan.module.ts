import { Module } from '@nestjs/common';
import { LoanController } from './loan.controller';
import { LoanService } from './loan.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LoanApplication } from './entities/loan-application.entity';
import { LoanRepayment } from './entities/loan-repayment.entity';
import { WalletModule } from 'src/wallet/wallet.module';
import { LedgerModule } from 'src/ledger/ledger.module';
import { AccountsModule } from 'src/accounts/accounts.module';
import { KycModule } from 'src/kyc/kyc.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([LoanApplication, LoanRepayment]),
    WalletModule,
    LedgerModule,
    AccountsModule,
    KycModule,
  ],
  providers: [LoanService],
  controllers: [LoanController, LoanAdminController],
})
export class LoanModule {}
