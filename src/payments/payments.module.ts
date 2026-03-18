import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { PaymentsService } from './payments.service';

import { Transaction } from './transaction/entities/transaction.entity';
import { BulkBatch } from './bulk/entities/bulk-batch.entity';
import { BulkItem } from './bulk/entities/bulk-item.entity';
import { RTP } from './rtp/entities/rtp.entity';

import { CasModule } from 'src/cas/cas.module';
import { QrModule } from './qr/qr.module';
import { RtpModule } from './rtp/rtp.module';
import { BulkModule } from './bulk/bulk.module';
import { AccountsModule } from 'src/accounts/accounts.module';
import { TransactionModule } from './transaction/transaction.module';
import { VerifyModule } from './verify/verify.module';
import { FundingModule } from './funding/funding.module';
import { LedgerModule } from 'src/ledger/ledger.module';
import { CreditTransferModule } from './credit-transfer/credit-transfer.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Transaction, BulkBatch, BulkItem, RTP]),

    CasModule,
    QrModule,
    RtpModule,
    BulkModule,
    forwardRef(() => AccountsModule),
    TransactionModule,
    VerifyModule,
    FundingModule,
    LedgerModule,
    CreditTransferModule,
  ],
  providers: [PaymentsService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
