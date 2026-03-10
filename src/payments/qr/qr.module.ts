import { Module } from '@nestjs/common';
import { QrController } from './qr.controller';
import { QrService } from './qr.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Transaction } from '../entities/transaction.entity';
import { CasModule } from 'src/cas/cas.module';
import { LedgerModule } from 'src/ledger/ledger.module';

@Module({
  imports: [TypeOrmModule.forFeature([Transaction]), CasModule, LedgerModule],
  controllers: [QrController],
  providers: [QrService],
})
export class QrModule {}
