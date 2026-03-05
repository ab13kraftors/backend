import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Customer } from './entities/customer.entity';
import { Repository } from 'typeorm';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { CustomerStatus, CustomerType } from 'src/common/enums/customer.enums';
import { UpdateCustomerDto } from './dto/update-customer.dto';
//---One Step Registration---
import { DataSource } from 'typeorm';
import { Alias } from 'src/alias/entities/alias.entity';
import { FinAddress } from 'src/finaddress/entities/finaddress.entity';
import { OneStepRegistrationDto } from './dto/one-step-registration.dto';
// ---One Step Registration---

@Injectable()
export class CustomerService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Customer)
    private customerRepository: Repository<Customer>,
  ) {}

  async create(
    dto: CreateCustomerDto,
    participantId: string,
  ): Promise<Customer> {
    const existing = await this.customerRepository.findOne({
      where: { externalId: dto.externalId, participantId },
    });

    if (existing) {
      throw new ConflictException('Already exists');
    }

    this.validateCreateRules(dto);

    const customer = this.customerRepository.create({
      ...dto,
      participantId,
      status: CustomerStatus.INACTIVE,
      documentValidityDate: new Date(dto.documentValidityDate),
      dob: dto.dob ? new Date(dto.dob) : undefined,
    });

    return this.customerRepository.save(customer);
  }

  async update(
    uuid: string,
    dto: UpdateCustomerDto,
    participantId: string,
  ): Promise<Customer> {
    const existing = await this.customerRepository.findOne({
      where: { uuid, participantId },
    });

    if (!existing) {
      throw new ConflictException('Customer not found');
    }

    const effectiveType = dto.type ?? existing.type;
    this.validateUpdateRules(dto, existing, effectiveType);
    // todo: validate

    Object.assign(existing, {
      ...dto,
      documentValidityDate: dto.documentValidityDate
        ? new Date(dto.documentValidityDate)
        : existing.documentValidityDate,
      dob: dto.dob ? new Date(dto.dob) : existing.dob,
    });

    return this.customerRepository.save(existing);
  }

  async updateStatus(customer: Customer) {
    return this.customerRepository.save(customer);
  }

  async findOne(uuid: string, participantId: string): Promise<Customer> {
    const customer = await this.customerRepository.findOne({
      where: { uuid, participantId },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    return customer;
  }

  async findAll(participantId: string): Promise<Customer[]> {
    return await this.customerRepository.find({
      where: { participantId },
    });
  }

  async remove(uuid: string, participantId: string): Promise<void> {
    const result = await this.customerRepository.delete({
      uuid,
      participantId,
    });

    if (result.affected === 0) {
      throw new NotFoundException('Customer not found');
    }
  }

  // RULES
  private validateCreateRules(dto: CreateCustomerDto) {
    if (dto.type === CustomerType.INDIVIDUAL && dto.companyName) {
      throw new BadRequestException(
        'companyName is not allowed for INDIVIDUAL customer',
      );
    }

    if (
      dto.type === CustomerType.COMPANY &&
      (dto.firstName || dto.lastName || dto.gender || dto.dob)
    ) {
      throw new BadRequestException(
        'Personal fields not allowed for COMPANY customer',
      );
    }
  }

  private validateUpdateRules(
    dto: UpdateCustomerDto,
    existing: Customer,
    effectiveType: CustomerType,
  ) {
    if (effectiveType === CustomerType.INDIVIDUAL && dto.companyName) {
      throw new BadRequestException(
        'companyName is not allowed for INDIVIDUAL customer',
      );
    }

    if (
      effectiveType === CustomerType.COMPANY &&
      (dto.firstName || dto.dob || dto.gender || dto.lastName)
    ) {
      throw new BadRequestException(
        'Personal fields are not allowed for COMPANY customer',
      );
    }
  }

  async oneStep(participantId: string, dto: OneStepRegistrationDto) {
    this.validateCreateRules(dto.customer);
    return this.dataSource.transaction(async (manager) => {
      // Create Customer
      const customer = manager.create(Customer, {
        ...dto.customer,
        participantId,
        status: CustomerStatus.INACTIVE,
        documentValidityDate: new Date(dto.customer.documentValidityDate),
        dob: dto.customer.dob ? new Date(dto.customer.dob) : undefined,
      });

      const savedCustomer = await manager.save(customer);

      // Existing Alias
      const existingAlias = await manager.findOne(Alias, {
        where: {
          participantId,
          value: dto.alias.value,
          customer: savedCustomer,
        },
      });

      if (existingAlias) {
        throw new ConflictException('Alias already Exists');
      }

      // Create Alias
      const alias = manager.create(Alias, {
        ...dto.alias,
        participantId,
        ccuuid: savedCustomer.uuid,
        customer: savedCustomer,
      });

      await manager.save(alias);

      // Create Financial Address
      const fin = manager.create(FinAddress, {
        ...dto.finAddress,
        participantId,
        ccuuid: savedCustomer.uuid,
        isDefault: true,
      });

      await manager.save(fin);

      return {
        customer: savedCustomer,
        alias,
        finaddress: fin,
      };
    });
  }
}
