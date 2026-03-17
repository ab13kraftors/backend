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
import { CreateAliasDto } from './dto/create-alias.dto';
import { CustomerStatus } from 'src/common/enums/customer.enums';
import { AliasStatus } from 'src/common/enums/alias.enums';
import { UpdateAliasDto } from './dto/update-create.dto';

@Injectable()
export class AliasService {
  constructor(
    @InjectRepository(Alias)
    private readonly aliasRepo: Repository<Alias>,

    private readonly customerService: CustomerService,
  ) {}

  // ================= CREATE =================
  async create(
    participantId: string,
    customerId: string,
    dto: CreateAliasDto,
  ): Promise<Alias> {
    const customer = await this.customerService.findOne(
      customerId,
      participantId,
    );

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
      customerId,
      isPrimary: true,
    });

    return this.aliasRepo.save(alias);
  }

  // ================= FIND ALL =================
  async findAll(participantId: string, customerId: string) {
    return this.aliasRepo.find({
      where: { participantId, customerId },
      order: { createdAt: 'DESC' },
    });
  }

  // ================= UPDATE =================
  async update(
    aliasId: string,
    participantId: string,
    dto: Partial<CreateAliasDto>,
  ) {
    const alias = await this.aliasRepo.findOne({
      where: { aliasId, participantId },
    });

    if (!alias) throw new NotFoundException('Alias not found');

    Object.assign(alias, dto);
    return this.aliasRepo.save(alias);
  }

  // ================= REMOVE =================
  async remove(aliasId: string, participantId: string) {
    const alias = await this.aliasRepo.findOne({
      where: { aliasId, participantId },
    });

    if (!alias) throw new NotFoundException('Alias not found');

    return this.aliasRepo.delete({ aliasId });
  }
}
