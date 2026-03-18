
import { Module } from '@nestjs/common';
import { ComplianceService } from './compliance.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Transaction } from 'src/payments/transaction/entities/transaction.entity';
import { KycModule } from 'src/kyc/kyc.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Transaction]),
    KycModule,
  ],
  providers: [ComplianceService],
  exports: [ComplianceService],
})
export class ComplianceModule {}
