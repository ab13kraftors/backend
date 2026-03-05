import { Module } from '@nestjs/common';
import { CasService } from './cas.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Alias } from 'src/alias/entities/alias.entity';
import { FinAddress } from 'src/finaddress/entities/finaddress.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Alias, FinAddress])],
  providers: [CasService],
  exports: [CasService],
})
export class CasModule {}
