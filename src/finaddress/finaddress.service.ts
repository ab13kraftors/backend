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

@Injectable()
export class FinaddressService {
  constructor(
    @InjectRepository(FinAddress)
    private readonly finaRepo: Repository<FinAddress>,
    private readonly customerService: CustomerService,
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
    return this.finaRepo.find({
      where: { participantId, ccuuid },
      skip: pageNo * pageSize,
      take: pageSize,
      order: { createdAt: 'DESC' },
    });
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
}
