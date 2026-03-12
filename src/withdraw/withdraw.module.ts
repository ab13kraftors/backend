import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Withdrawal } from './entities/withdraw.entity';
import { WithdrawService } from './withdraw.service';
import { WithdrawController } from './withdraw.controller';

import { WalletModule } from 'src/wallet/wallet.module';
import { LedgerModule } from 'src/ledger/ledger.module';
import { KycModule } from 'src/kyc/kyc.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Withdrawal]),
    WalletModule,
    LedgerModule,
    KycModule,
  ],

  providers: [WithdrawService],

  controllers: [WithdrawController],
})
export class WithdrawModule {}
