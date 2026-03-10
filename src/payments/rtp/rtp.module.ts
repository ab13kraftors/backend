import { Module } from '@nestjs/common';
import { RtpController } from './rtp.controller';
import { RtpService } from './rtp.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Transaction } from '../entities/transaction.entity';
import { CasModule } from 'src/cas/cas.module';
import { RTP } from '../entities/rtp.entity';
import { LedgerModule } from 'src/ledger/ledger.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Transaction, RTP]),
    CasModule,
    LedgerModule,
  ],
  controllers: [RtpController],
  providers: [RtpService],
})
export class RtpModule {}
