import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LimitsRiskService } from './limits-risk.service';
import { LimitsRiskController } from './limits-risk.controller';
import { LimitConfig } from './entities/limit-config.entity';
import { LimitUsage } from './entities/limit-usage.entity';
import { KycModule } from 'src/kyc/kyc.module';

@Module({
  imports: [TypeOrmModule.forFeature([LimitConfig, LimitUsage]), KycModule],
  providers: [LimitsRiskService],
  controllers: [LimitsRiskController],
  exports: [LimitsRiskService],
})
export class LimitsRiskModule {}
