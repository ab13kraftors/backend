import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FinAddress } from './entities/finaddress.entity';
import { Repository } from 'typeorm';
import { CustomerService } from 'src/customer/customer.service';
import { CreateFinAddressDto } from './dto/create-finaddress.dto';
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

  // ================= CREATE =================
  async create(
    participantId: string,
    customerId: string,
    dto: CreateFinAddressDto,
  ) {
    await this.customerService.findOne(customerId, participantId);

    const existing = await this.finaRepo.count({
      where: { participantId, customerId },
    });

    const entity = this.finaRepo.create({
      ...dto,
      participantId,
      customerId,
      isDefault: existing === 0,
    });

    return this.finaRepo.save(entity);
  }

  // ================= FIND ALL =================
  async findAll(
    participantId: string,
    customerId: string,
    pageNo = 0,
    pageSize = 10,
  ) {
    const [results, total] = await this.finaRepo.findAndCount({
      where: { participantId, customerId },
      skip: pageNo * pageSize,
      take: pageSize,
      order: { createdAt: 'DESC' },
    });

    if (total === 0) {
      throw new NotFoundException('No fin addresses found');
    }

    return results;
  }

  // ================= SET DEFAULT =================
  async setDefault(
    participantId: string,
    customerId: string,
    finAddressId: string,
  ) {
    const fin = await this.finaRepo.findOne({
      where: { finAddressId, participantId, customerId },
    });

    if (!fin) throw new NotFoundException('Financial address not found');

    await this.finaRepo.update(
      { participantId, customerId, isDefault: true },
      { isDefault: false },
    );

    fin.isDefault = true;

    return this.finaRepo.save(fin);
  }

  // ================= REMOVE =================
  async remove(
    participantId: string,
    customerId: string,
    finAddressId: string,
  ) {
    const fin = await this.finaRepo.findOne({
      where: { finAddressId, participantId, customerId },
    });

    if (!fin) throw new NotFoundException('Financial address not found');

    if (fin.isDefault) {
      throw new BadRequestException('Cannot delete default financial address');
    }

    return this.finaRepo.delete({ finAddressId });
  }

  // ================= RESOLVE ALIAS =================
  async resolveAlias(aliasType: AliasType, aliasValue: string) {
    const result = await this.aliasRepo
      .createQueryBuilder('alias')
      .innerJoin(FinAddress, 'fin', 'fin.customerId = alias.customerId')
      .where('alias.type = :type', { type: aliasType })
      .andWhere('alias.value = :value', { value: aliasValue })
      .andWhere('alias.status = :status', {
        status: AliasStatus.ACTIVE,
      })
      .andWhere('fin.isDefault = true')
      .select([
        'fin.finAddress as finAddress',
        'fin.servicerId as servicerId',
        'fin.type as type',
      ])
      .getRawOne();

    if (!result) {
      throw new NotFoundException('Alias not resolved');
    }

    return result;
  }
}
