import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Customer } from './entities/customer.entity';
import { EntityManager, Repository } from 'typeorm';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { CustomerStatus, CustomerType } from 'src/common/enums/customer.enums';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import * as bcrypt from 'bcrypt';
import { SetPinDto, ChangePinDto } from './dto/pin.dto';
//---One Step Registration---
import { DataSource } from 'typeorm';
import { Alias } from 'src/alias/entities/alias.entity';
import { FinAddress } from 'src/finaddress/entities/finaddress.entity';
import { OneStepRegistrationDto } from './dto/one-step-registration.dto';
import { WalletService } from 'src/wallet/wallet.service';
// ---One Step Registration---

@Injectable()
export class CustomerService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Customer)
    private customerRepository: Repository<Customer>,
    private walletService: WalletService,
  ) {}

  // ================== create ==================
  // Creates a new customer and automatically creates wallet
  async create(
    dto: CreateCustomerDto,
    participantId: string,
  ): Promise<Customer> {
    return this.dataSource.transaction(async (manager) => {
      const existing = await this.customerRepository.findOne({
        where: { externalId: dto.externalId, participantId },
      });

      // Prevent duplicate externalId for same participant
      if (existing) {
        throw new ConflictException('Already exists');
      }

      // Validate business rules
      this.validateCreateRules(dto);

      const customer = this.customerRepository.create({
        ...dto,
        participantId,
        status: CustomerStatus.INACTIVE,
        documentValidityDate: new Date(dto.documentValidityDate),
        dob: dto.dob ? new Date(dto.dob) : undefined,
      });

      const savedCustomer = await this.customerRepository.save(customer);

      // Create wallet for customer
      await this.walletService.createWallet(
        savedCustomer.uuid,
        participantId,
        manager,
      );

      return savedCustomer;
    });
  }

  // ================== update ==================
  // Updates customer information
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

    // Validate update rules
    this.validateUpdateRules(dto, existing, effectiveType);

    Object.assign(existing, {
      ...dto,
      documentValidityDate: dto.documentValidityDate
        ? new Date(dto.documentValidityDate)
        : existing.documentValidityDate,
      dob: dto.dob ? new Date(dto.dob) : existing.dob,
    });

    return this.customerRepository.save(existing);
  }

  // ================== updateStatus ==================
  // Updates customer status
  async updateStatus(customer: Customer) {
    return this.customerRepository.save(customer);
  }

  // ================== findOne ==================
  // Returns a single customer
  async findOne(uuid: string, participantId: string): Promise<Customer> {
    const customer = await this.customerRepository.findOne({
      where: { uuid, participantId },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    return customer;
  }

  // ================== findAll ==================
  // Returns all customers of a participant
  async findAll(participantId: string): Promise<Customer[]> {
    return await this.customerRepository.find({
      where: { participantId },
    });
  }

  // ================== remove ==================
  // Deletes a customer
  async remove(uuid: string, participantId: string): Promise<void> {
    const result = await this.customerRepository.delete({
      uuid,
      participantId,
    });

    if (result.affected === 0) {
      throw new NotFoundException('Customer not found');
    }
  }

  // ================== validateCreateRules ==================
  // Business validation for creating customer
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

  // ================== validateUpdateRules ==================
  // Business validation for updating customer
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

  // ================== oneStep ==================
  // Performs customer + alias + finaddress + wallet creation in one transaction
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

      // Check if alias already exists
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

      // Create Wallet- use manager
      const wallet = await this.walletService.createWallet(
        savedCustomer.uuid,
        participantId,
        manager,
      );

      return {
        customer: savedCustomer,
        alias,
        finaddress: fin,
        wallet,
      };
    });
  }

  // ================== setPin ==================
  // Sets customer transaction PIN
  async setPin(ccuuid: string, participantId: string, dto: SetPinDto) {
    const customer = await this.customerRepository
      .createQueryBuilder('c')
      .addSelect('c.pinHash')
      .where('c.uuid = :ccuuid AND c.participantId = :participantId', {
        ccuuid,
        participantId,
      })
      .getOne();

    if (!customer) throw new NotFoundException('Customer not found');

    // Prevent overwriting existing PIN
    if (customer.pinHash) {
      throw new BadRequestException(
        'PIN already set. Use change-pin to update it.',
      );
    }

    const saltRounds = Number(process.env.PIN_SALT_ROUNDS ?? 12);

    // Hash and store PIN
    customer.pinHash = await bcrypt.hash(dto.pin, saltRounds);
    await this.customerRepository.save(customer);
    return { message: 'PIN set successfully' };
  }

  // ================== changePin ==================
  // Changes existing customer PIN
  async changePin(ccuuid: string, participantId: string, dto: ChangePinDto) {
    const customer = await this.customerRepository
      .createQueryBuilder('c')
      .addSelect('c.pinHash')
      .where('c.uuid = :ccuuid AND c.participantId = :participantId', {
        ccuuid,
        participantId,
      })
      .getOne();

    if (!customer) throw new NotFoundException('Customer not found');

    if (!customer.pinHash)
      throw new BadRequestException('No PIN set. Use set-pin first.');

    // Validate current PIN
    const valid = await bcrypt.compare(dto.currentPin, customer.pinHash);
    if (!valid) throw new UnauthorizedException('Current PIN is incorrect');

    const saltRounds = Number(process.env.PIN_SALT_ROUNDS ?? 12);

    // Hash new PIN
    customer.pinHash = await bcrypt.hash(dto.newPin, saltRounds);

    await this.customerRepository.save(customer);
    return { message: 'PIN changed successfully' };
  }

  // ================== verifyPin ==================
  // Verifies PIN before performing wallet transactions
  async verifyPin(
    ccuuid: string,
    participantId: string,
    pin: string,
  ): Promise<void> {
    const customer = await this.customerRepository
      .createQueryBuilder('c')
      .addSelect('c.pinHash')
      .where('c.uuid = :ccuuid AND c.participantId = :participantId', {
        ccuuid,
        participantId,
      })
      .getOne();

    if (!customer) throw new NotFoundException('Customer not found');

    if (!customer.pinHash) {
      throw new BadRequestException(
        'PIN not set. Please set your PIN before making payments.',
      );
    }

    // Validate entered PIN
    const valid = await bcrypt.compare(pin, customer.pinHash);

    if (!valid) throw new UnauthorizedException('Invalid PIN');
  }
}
