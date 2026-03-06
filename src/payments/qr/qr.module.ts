import { Module } from '@nestjs/common';
import { QrController } from './qr.controller';
import { QrService } from './qr.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Transaction } from '../entities/transaction.entity';
import { CasModule } from 'src/cas/cas.module';

@Module({
  imports: [TypeOrmModule.forFeature([Transaction]), CasModule],
  controllers: [QrController],
  providers: [QrService],
})
export class QrModule {}
