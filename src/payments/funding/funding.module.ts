import { Module } from '@nestjs/common';
import { FundingController } from './funding.controller';
import { FundingService } from './funding.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FundingWallet } from './entities/funding.entity';
import { Wallet } from 'src/wallet/entities/wallet.entity';
import { AuthModule } from 'src/auth/auth.module';
import { LedgerModule } from 'src/ledger/ledger.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([FundingWallet, Wallet]),
    AuthModule,
    LedgerModule,
  ],
  controllers: [FundingController],
  providers: [FundingService],
})
export class FundingModule {}
