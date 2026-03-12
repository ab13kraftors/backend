import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { LoadController } from './load.controller';
import { LoadService } from './load.service';
import { LoadTransaction } from './entities/load-wallet.entity';

import { WalletModule } from 'src/wallet/wallet.module';
import { LedgerModule } from 'src/ledger/ledger.module';
import { CardModule } from 'src/card/card.module';
import { KycModule } from 'src/kyc/kyc.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([LoadTransaction]),
    forwardRef(() => WalletModule),
    LedgerModule,
    CardModule,
    KycModule,
  ],

  controllers: [LoadController],

  providers: [LoadService],

  exports: [LoadService],
})
export class LoadModule {}
