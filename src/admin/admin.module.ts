import { Module } from '@nestjs/common';

import { CustomerModule } from 'src/customer/customer.module';
import { KycModule } from 'src/kyc/kyc.module';
import { LoanModule } from 'src/loan/loan.module';
import { AccountsModule } from 'src/accounts/accounts.module';
import { TransactionModule } from 'src/payments/transaction/transaction.module';
import { LedgerModule } from 'src/ledger/ledger.module';

import { AdminCustomerController } from './controllers/admin.customer.controller';
import { AdminKycController } from './controllers/admin.kyc.controller';
import { AdminTransactionController } from './controllers/admin.transaction.controller';
import { AdminLoanController } from './controllers/admin.loan.controller';
import { AdminAccountController } from './controllers/admin.account.controller';

@Module({
  imports: [
    CustomerModule,
    KycModule,
    LoanModule,
    AccountsModule,
    TransactionModule,
    LedgerModule,
  ],
  controllers: [
    AdminCustomerController,
    AdminKycController,
    AdminTransactionController,
    AdminLoanController,
    AdminAccountController,
  ],
})
export class AdminModule {}
