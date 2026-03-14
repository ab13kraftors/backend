import { Module } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Transaction } from './entities/transaction.entity';
import { BulkBatch } from './entities/bulk-batch.entity';
import { RTP } from './entities/rtp.entity';
import { CasModule } from 'src/cas/cas.module';
import { CreditTransferService } from './credit-transfer/credit-transfer.service';
import { CreditTransferController } from './credit-transfer/credit-transfer.controller';
import { QrModule } from './qr/qr.module';
import { RtpModule } from './rtp/rtp.module';
import { BulkItem } from './entities/bulk-item.entity';
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
    AccountsModule,
    TransactionModule,
    VerifyModule,
    FundingModule,
    LedgerModule,
    CreditTransferModule,
  ],
  controllers: [],
  providers: [PaymentsService],
  exports: [PaymentsService, TypeOrmModule],
})
export class PaymentsModule {}
