import { Module } from '@nestjs/common';
import { QrController } from './qr.controller';
import { QrService } from './qr.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Transaction } from '../entities/transaction.entity';
import { CasModule } from 'src/cas/cas.module';
import { AccountsModule } from 'src/accounts/accounts.module';

@Module({
  imports: [TypeOrmModule.forFeature([Transaction]), CasModule, AccountsModule],
  controllers: [QrController],
  providers: [QrService],
})
export class QrModule {}
