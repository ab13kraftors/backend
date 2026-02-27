import { Module } from '@nestjs/common';
import { AliasService } from './alias.service';
import { AliasController } from './alias.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Alias } from './entities/alias.entity';
import { CustomerModule } from 'src/customer/customer.module';

@Module({
  imports: [TypeOrmModule.forFeature([Alias]), CustomerModule],
  providers: [AliasService],
  controllers: [AliasController],
})
export class AliasModule {}
