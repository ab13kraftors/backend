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
    // Inject Alias repository
    @InjectRepository(Alias) private readonly aliasRepo: Repository<Alias>,
    // Inject Customer service to validate customer
    private readonly customerService: CustomerService,
  ) {}

  // ================== createAlias ==================
  // Creates a new alias for a customer after validation
  async create(
    participantId: string,
    ccuuid: string,
    dto: CreateAliasDto,
  ): Promise<Alias> {
    // Ensure participant exists in token
    if (!participantId) {
      throw new UnauthorizedException('Participant ID not found in token');
    }

    // Fetch customer and validate status
    const customer = await this.customerService.findOne(ccuuid, participantId);
    if (customer.status !== CustomerStatus.ACTIVE) {
      throw new BadRequestException('Customer must be active');
    }

    // Check if alias already exists
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

    // Create alias entity
    const alias = this.aliasRepo.create({
      ...dto,
      participantId,
      ccuuid,
      status: dto.status ?? AliasStatus.ACTIVE,
    });

    // Save alias to database
    return this.aliasRepo.save(alias);
  }

  // ================== findAllAliases ==================
  // Returns all aliases of a specific customer
  async findAll(participantId: string, ccuuid: string): Promise<Alias[]> {
    // Validate customer existence
    await this.customerService.findOne(ccuuid, participantId);

    return this.aliasRepo.find({
      where: { participantId, ccuuid },
      order: { createdAt: 'DESC' },
    });
  }

  // ================== updateAlias ==================
  // Updates alias details for a customer
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

    // Find alias belonging to customer
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

    // Merge updated fields
    Object.assign(alias, dto);

    // Save updated alias
    return this.aliasRepo.save(alias);
  }

  // ================== removeAlias ==================
  // Deletes an alias belonging to a customer
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

    // Throw error if alias does not exist
    if (!alias) {
      throw new NotFoundException('Alias Not found');
    }

    // Remove alias from database
    await this.aliasRepo.remove(alias);
  }
}
