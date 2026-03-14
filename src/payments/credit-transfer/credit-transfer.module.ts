import { Module } from '@nestjs/common';
import { CreditTransferService } from './credit-transfer.service';
import { CreditTransferController } from './credit-transfer.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Transaction } from '../entities/transaction.entity';
import { LedgerModule } from 'src/ledger/ledger.module';
import { CasModule } from 'src/cas/cas.module';
import { PaymentsService } from '../payments.service';

@Module({
  imports: [TypeOrmModule.forFeature([Transaction]), LedgerModule, CasModule],
  providers: [CreditTransferService, PaymentsService],
  controllers: [CreditTransferController],
})
export class CreditTransferModule {}
