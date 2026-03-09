import { Module } from '@nestjs/common';
import { BulkController } from './bulk.controller';
import { BulkService } from './bulk.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BulkBatch } from '../entities/bulk-batch.entity';
import { BulkItem } from '../entities/bulk-item.entity';
import { Transaction } from '../entities/transaction.entity';
import { CasModule } from 'src/cas/cas.module';
import { AccountsModule } from 'src/accounts/accounts.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([BulkBatch, BulkItem, Transaction]),
    CasModule,
    AccountsModule,
  ],
  controllers: [BulkController],
  providers: [BulkService],
  exports: [BulkService],
})
export class BulkModule {}
