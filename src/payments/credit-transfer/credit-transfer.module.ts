import { Module } from '@nestjs/common';
import { CreditTransferService } from './credit-transfer.service';
import { CreditTransferController } from './credit-transfer.controller';
import { AccountsModule } from 'src/accounts/accounts.module';

@Module({
  imports: [AccountsModule],
  providers: [CreditTransferService],
  controllers: [CreditTransferController],
})
export class CreditTransferModule {}
