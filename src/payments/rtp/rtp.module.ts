import { Module } from '@nestjs/common';
import { RtpController } from './rtp.controller';
import { RtpService } from './rtp.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Transaction } from '../entities/transaction.entity';
import { CasModule } from 'src/cas/cas.module';
import { RTP } from '../entities/rtp.entity';
import { AccountsModule } from 'src/accounts/accounts.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Transaction, RTP]),
    CasModule,
    AccountsModule,
  ],
  controllers: [RtpController],
  providers: [RtpService],
})
export class RtpModule {}
