import { Module } from '@nestjs/common';
import { CreditTransferService } from './credit-transfer.service';
import { CreditTransferController } from './credit-transfer.controller';
import { LedgerModule } from 'src/ledger/ledger.module';

@Module({
  imports: [LedgerModule],
  providers: [CreditTransferService],
  controllers: [CreditTransferController],
})
export class CreditTransferModule {}
