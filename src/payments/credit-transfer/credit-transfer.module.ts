import { Module } from '@nestjs/common';
import { CreditTransferService } from './credit-transfer.service';
import { CreditTransferController } from './credit-transfer.controller';

@Module({
  providers: [CreditTransferService],
  controllers: [CreditTransferController]
})
export class CreditTransferModule {}
