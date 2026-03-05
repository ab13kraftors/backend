import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FinAddress } from './entities/finaddress.entity';
import { Repository } from 'typeorm';
import { CustomerService } from 'src/customer/customer.service';
import { CreateFinAddressDto } from './entities/dto/create-finaddress.dto';
import { Alias } from 'src/alias/entities/alias.entity';
import { AliasStatus, AliasType } from 'src/common/enums/alias.enums';

@Injectable()
export class FinaddressService {
  constructor(
    @InjectRepository(FinAddress)
    private readonly finaRepo: Repository<FinAddress>,
    private readonly customerService: CustomerService,
    @InjectRepository(Alias)
    private readonly aliasRepo: Repository<Alias>,
  ) {}

  async create(
    participantId: string,
    ccuuid: string,
    dto: CreateFinAddressDto,
  ) {
    await this.customerService.findOne(ccuuid, participantId);

    // if this is first address then make it default automatically
    const existing = await this.finaRepo.count({
      where: { participantId, ccuuid },
    });

    const entity = this.finaRepo.create({
      ...dto,
      participantId,
      ccuuid,
      isDefault: existing === 0,
    });

    return this.finaRepo.save(entity);
  }

  async findAll(
    participantId: string,
    ccuuid: string,
    pageNo = 0,
    pageSize = 10,
  ) {
    const [results, total] = await this.finaRepo.findAndCount({
      where: { participantId, ccuuid },
      skip: pageNo * pageSize,
      take: pageSize,
      order: { createdAt: 'DESC' },
    });

    if (total === 0) {
      throw new NotFoundException('No customer exists or No fin records found');
    }
    return results;
  }

  async setDefault(participantId: string, ccuuid: string, finUuid: string) {
    const fin = await this.finaRepo.findOne({
      where: { finUuid, participantId, ccuuid },
    });

    if (!fin) throw new NotFoundException('Financial address not found');

    // remove existing default
    await this.finaRepo.update(
      {
        participantId,
        ccuuid,
        isDefault: true,
      },
      { isDefault: false },
    );

    fin.isDefault = true;
    return this.finaRepo.save(fin);
  }

  async remove(participantId: string, ccuuid: string, finUuid: string) {
    const fin = await this.finaRepo.findOne({
      where: { finUuid, participantId, ccuuid },
    });

    if (!fin) throw new NotFoundException('Financial addess not found');

    if (fin.isDefault) {
      throw new BadRequestException('Cannot delete default financial address');
    }

    return this.finaRepo.delete({ finUuid });
  }

  // finaddress.service.ts

  async resolveAlias(aliasType: AliasType, aliasValue: string) {
    const result = await this.aliasRepo
      .createQueryBuilder('alias')
      // Ensure FinAddress is imported from your entity file
      .innerJoin(FinAddress, 'fin', 'fin.ccuuid = alias.ccuuid')
      .where('alias.type = :type', { type: aliasType })
      .andWhere('alias.value = :value', { value: aliasValue })
      .andWhere('alias.status = :status', { status: AliasStatus.ACTIVE })
      .andWhere('fin.isDefault = :isDefault', { isDefault: true })
      .select([
        'fin.finAddress', // Use property names from your entity
        'fin.servicerId',
        'fin.type',
      ])
      .getRawOne(); // Use getRawOne() because select aliases (AS "finAddress") return raw data

    if (!result) {
      throw new NotFoundException(
        `Active account for ${aliasType}: ${aliasValue} not found`,
      );
    }

    return {
      finAddress: result.fin_finAddress, // TypeORM raw results usually prefix with alias_
      servicerId: result.fin_servicerId,
      type: result.fin_type,
    };
  }
}
