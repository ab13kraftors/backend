import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Alias } from 'src/alias/entities/alias.entity';
import { AliasStatus, AliasType } from 'src/common/enums/alias.enums';
import { FinAddress } from 'src/finaddress/entities/finaddress.entity';
import { Repository } from 'typeorm';

@Injectable()
export class CasService {
  constructor(
    // Inject Alias repository
    @InjectRepository(Alias)
    private aliasRepo: Repository<Alias>,

    // Inject FinAddress repository
    @InjectRepository(FinAddress)
    private finRepo: Repository<FinAddress>,
  ) {}

  // ================== resolveAlias ==================
  // Resolves an alias to its default FIN address
  async resolveAlias(aliasType: AliasType, aliasValue: string) {
    // Find active alias matching type and value
    const alias = await this.aliasRepo.findOne({
      where: {
        type: aliasType,
        value: aliasValue,
        status: AliasStatus.ACTIVE,
      },
    });

    // Throw error if alias not found
    if (!alias) {
      throw new NotFoundException('Alias Not found');
    }

    // Find default FIN address linked to the customer
    const fin = await this.finRepo.findOne({
      where: {
        ccuuid: alias.ccuuid,
        isDefault: true,
      },
    });

    // Throw error if FIN address not found
    if (!fin) {
      throw new NotFoundException('Fin address Not found');
    }

    // Return resolved payment routing details
    return {
      finAddress: fin.finAddress,
      servicerId: fin.servicerId,
      type: fin.type,
    };
  }
}
