import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Alias } from 'src/alias/entities/alias.entity';
import { AliasType } from 'src/common/enums/alias.enums';
import { FinAddress } from 'src/finaddress/entities/finaddress.entity';
import { Repository } from 'typeorm';

@Injectable()
export class CasService {
  constructor(
    @InjectRepository(Alias)
    private aliasRepo: Repository<Alias>,
    @InjectRepository(FinAddress)
    private finRepo: Repository<FinAddress>,
  ) {}

  async resolveAlias(aliasType: AliasType, aliasValue: string) {
    const alias = await this.aliasRepo.findOne({
      where: {
        type: aliasType,
        value: aliasValue,
        status: 'ACTIVE',
      },
    });

    if (!alias) {
      throw new NotFoundException('Alias Not found');
    }
    const fin = await this.finRepo.findOne({
      where: {
        ccuuid: alias.ccuuid,
        isDefault: true,
      },
    });
    if (!fin) {
      throw new NotFoundException('Fin address Not found');
    }
    return {
      finAddress: fin.finAddress,
      servicerId: fin.servicerId,
      type: fin.type,
    };
  }
}
