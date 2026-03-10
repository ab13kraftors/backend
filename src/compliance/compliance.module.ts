import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ComplianceService } from './compliance.service';
import { ComplianceLog } from './entities/compliance-log.entity';

@Module({
  imports: [TypeOrmModule.forFeature([ComplianceLog])],
  providers: [ComplianceService],
  exports: [ComplianceService],
})
export class ComplianceModule {}
