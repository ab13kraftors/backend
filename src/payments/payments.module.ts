import { Module } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Transaction } from './entities/transaction.entity';
import { BulkBatch } from './entities/bulk.entity';
import { RTP } from './entities/rtp.entity';
import { CasModule } from 'src/cas/cas.module';
import { CreditTransferService } from './credit-transfer/credit-transfer.service';
import { CreditTransferController } from './credit-transfer/credit-transfer.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Transaction, BulkBatch, RTP]), CasModule],
  controllers: [CreditTransferController],
  providers: [PaymentsService, CreditTransferService],
  exports: [PaymentsService, TypeOrmModule],
})
export class PaymentsModule {}
