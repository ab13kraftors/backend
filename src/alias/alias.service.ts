import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Alias } from './entities/alias.entity';
import { CustomerService } from 'src/customer/customer.service';
import { CreateAliasDto } from './entities/dto/create-alias.dto';
import { CustomerStatus } from 'src/common/enums/customer.enums';
import { AliasStatus } from 'src/common/enums/alias.enums';
import { UpdateAliasDto } from './entities/dto/update-create.dto';

@Injectable()
export class AliasService {
  constructor(
    @InjectRepository(Alias) private readonly aliasRepo: Repository<Alias>,
    private readonly customerService: CustomerService,
  ) {}

  async create(
    participantId: string,
    ccuuid: string,
    dto: CreateAliasDto,
  ): Promise<Alias> {
    if (!participantId) {
      throw new UnauthorizedException('Participant ID not found in token');
    }
    const customer = await this.customerService.findOne(ccuuid, participantId);
    if (customer.status !== CustomerStatus.ACTIVE) {
      throw new BadRequestException('Customer must be active');
    }

    const existing = await this.aliasRepo.findOne({
      where: {
        participantId,
        type: dto.type,
        value: dto.value,
      },
    });

    if (existing) {
      throw new BadRequestException('Alias already exists');
    }

    const alias = this.aliasRepo.create({
      ...dto,
      participantId,
      ccuuid,
      status: dto.status ?? AliasStatus.ACTIVE,
    });
    return this.aliasRepo.save(alias);
  }

  async findAll(participantId: string, ccuuid: string): Promise<Alias[]> {
    await this.customerService.findOne(ccuuid, participantId);

    return this.aliasRepo.find({
      where: { participantId, ccuuid },
      order: { createdAt: 'DESC' },
    });
  }

  async update(
    participantId: string,
    ccuuid: string,
    aliasUuid: string,
    dto: UpdateAliasDto,
  ): Promise<Alias> {
    console.log('Searching for Alias with:', {
      aliasUuid,
      participantId,
      ccuuid,
    });
    const alias = await this.aliasRepo.findOne({
      where: {
        aliasUuid,
        participantId,
        ccuuid,
      },
    });

    if (!alias) {
      throw new NotFoundException('Alias Not found');
    }

    Object.assign(alias, dto);

    return this.aliasRepo.save(alias);
  }

  async remove(
    participantId: string,
    ccuuid: string,
    aliasUuid: string,
  ): Promise<void> {
    const alias = await this.aliasRepo.findOne({
      where: {
        aliasUuid,
        participantId,
        ccuuid,
      },
    });

    if (!alias) {
      throw new NotFoundException('Alias Not found');
    }
    await this.aliasRepo.remove(alias);
  }
}
