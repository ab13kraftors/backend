import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Alias } from './entities/alias.entity';

@Injectable()
export class AliasService {
  constructor(@InjectRepository(Alias) private aliasRepo: Repository<Alias>) {}

  async create(
    participantId: string,
    ccuuid: string,
    
  )
}
