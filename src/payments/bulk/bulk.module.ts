import { Module, forwardRef } from '@nestjs/common';
import { BulkController } from './bulk.controller';
import { BulkService } from './bulk.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BulkBatch } from '../entities/bulk-batch.entity';
import { BulkItem } from '../entities/bulk-item.entity';
import { Transaction } from '../entities/transaction.entity';
import { CasModule } from 'src/cas/cas.module';
import { LedgerModule } from 'src/ledger/ledger.module';
import { AccountsModule } from 'src/accounts/accounts.module';
import { WalletModule } from 'src/wallet/wallet.module';
import { CustomerModule } from 'src/customer/customer.module';
import { PaymentsService } from '../payments.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([BulkBatch, BulkItem, Transaction]),
    CasModule,
    LedgerModule,
    AccountsModule,
    forwardRef(() => WalletModule),
    forwardRef(() => CustomerModule),
  ],
  controllers: [BulkController],
  providers: [BulkService, PaymentsService],
  exports: [BulkService],
})
export class BulkModule {}
