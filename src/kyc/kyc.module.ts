import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { KycRecord } from './entities/kyc.entity';
import { KycService } from './kyc.service';
import { KycController } from './kyc.controller';

@Module({
  imports: [TypeOrmModule.forFeature([KycRecord])],
  providers: [KycService],
  controllers: [KycController],
  exports: [KycService],
})
export class KycModule {}
