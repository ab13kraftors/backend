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
    // Inject FinAddress repository
    @InjectRepository(FinAddress)
    private readonly finaRepo: Repository<FinAddress>,

    // Inject Customer service for validation
    private readonly customerService: CustomerService,

    // Inject Alias repository
    @InjectRepository(Alias)
    private readonly aliasRepo: Repository<Alias>,
  ) {}

  // ================== create ==================
  // Creates a financial address for a customer
  async create(
    participantId: string,
    ccuuid: string,
    dto: CreateFinAddressDto,
  ) {
    // Ensure customer exists
    await this.customerService.findOne(ccuuid, participantId);

    // Count existing fin addresses
    const existing = await this.finaRepo.count({
      where: { participantId, ccuuid },
    });

    // First address becomes default automatically
    const entity = this.finaRepo.create({
      ...dto,
      participantId,
      ccuuid,
      isDefault: existing === 0,
    });

    return this.finaRepo.save(entity);
  }

  // ================== findAll ==================
  // Returns paginated list of financial addresses
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

    // Throw error if no records found
    if (total === 0) {
      throw new NotFoundException('No customer exists or No fin records found');
    }

    return results;
  }

  // ================== setDefault ==================
  // Sets a financial address as default
  async setDefault(participantId: string, ccuuid: string, finUuid: string) {
    const fin = await this.finaRepo.findOne({
      where: { finUuid, participantId, ccuuid },
    });

    if (!fin) throw new NotFoundException('Financial address not found');

    // Remove existing default flag
    await this.finaRepo.update(
      {
        participantId,
        ccuuid,
        isDefault: true,
      },
      { isDefault: false },
    );

    // Mark selected address as default
    fin.isDefault = true;

    return this.finaRepo.save(fin);
  }

  // ================== remove ==================
  // Deletes a financial address
  async remove(participantId: string, ccuuid: string, finUuid: string) {
    const fin = await this.finaRepo.findOne({
      where: { finUuid, participantId, ccuuid },
    });

    if (!fin) throw new NotFoundException('Financial addess not found');

    // Prevent deletion of default address
    if (fin.isDefault) {
      throw new BadRequestException('Cannot delete default financial address');
    }

    return this.finaRepo.delete({ finUuid });
  }

  // ================== resolveAlias ==================
  // Resolves alias to default financial address
  async resolveAlias(aliasType: AliasType, aliasValue: string) {
    const result = await this.aliasRepo
      .createQueryBuilder('alias')
      .innerJoin(FinAddress, 'fin', 'fin.ccuuid = alias.ccuuid')
      .where('alias.type = :type', { type: aliasType })
      .andWhere('alias.value = :value', { value: aliasValue })
      .andWhere('alias.status = :status', { status: AliasStatus.ACTIVE })
      .andWhere('fin.isDefault = :isDefault', { isDefault: true })
      .select(['fin.finAddress', 'fin.servicerId', 'fin.type'])
      .getRawOne(); // returns raw result

    // Throw error if alias mapping not found
    if (!result) {
      throw new NotFoundException(
        `Active account for ${aliasType}: ${aliasValue} not found`,
      );
    }

    // Return resolved financial routing details
    return {
      finAddress: result.fin_finAddress,
      servicerId: result.fin_servicerId,
      type: result.fin_type,
    };
  }
}
