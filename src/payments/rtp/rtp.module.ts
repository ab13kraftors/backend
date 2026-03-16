import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RtpController } from './rtp.controller';
import { RtpService } from './rtp.service';
import { Transaction } from '../entities/transaction.entity';
import { RTP } from '../entities/rtp.entity';
import { CasModule } from 'src/cas/cas.module';
import { LedgerModule } from 'src/ledger/ledger.module';
import { AccountsModule } from 'src/accounts/accounts.module';
import { WalletModule } from 'src/wallet/wallet.module';
import { CustomerModule } from 'src/customer/customer.module';
import { PaymentsService } from '../payments.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Transaction, RTP]),
    CasModule,
    LedgerModule,
    AccountsModule,
    forwardRef(() => WalletModule),
    forwardRef(() => CustomerModule),
  ],
  controllers: [RtpController],
  providers: [RtpService, PaymentsService],
  exports: [RtpService],
})
export class RtpModule {}
