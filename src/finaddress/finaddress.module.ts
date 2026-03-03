import { Module } from '@nestjs/common';
import { FinaddressService } from './finaddress.service';
import { FinaddressController } from './finaddress.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FinAddress } from './entities/finaddress.entity';
import { CustomerModule } from 'src/customer/customer.module';

@Module({
  imports: [TypeOrmModule.forFeature([FinAddress]), CustomerModule],
  providers: [FinaddressService],
  controllers: [FinaddressController],
})
export class FinaddressModule {}
