import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
  forwardRef,
  Inject,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Customer } from './entities/customer.entity';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { CustomerStatus, CustomerType } from 'src/common/enums/customer.enums';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import * as bcrypt from 'bcrypt';
import { SetPinDto, ChangePinDto } from './dto/pin.dto';
import { WalletService } from 'src/wallet/wallet.service';
import { AccountsService } from 'src/accounts/accounts.service';
import { CreateWalletDto } from 'src/wallet/dto/create-wallet.dto';
import { AccountType } from 'src/accounts/enums/account.enum';
import { Currency } from 'src/common/enums/transaction.enums';

@Injectable()
export class CustomerService {
  constructor(
    private readonly dataSource: DataSource,

    @InjectRepository(Customer)
    private readonly customerRepository: Repository<Customer>,

    @Inject(forwardRef(() => WalletService))
    private readonly walletService: WalletService,

    @Inject(forwardRef(() => AccountsService))
    private readonly accountsService: AccountsService,
  ) {}

  async create(
    dto: CreateCustomerDto,
    participantId: string,
  ): Promise<Customer> {
    return this.dataSource.transaction(async (manager) => {
      await this.assertCreateUniqueness(dto, participantId, manager);
      this.validateCreateRules(dto);

      const customerRepository = manager.getRepository(Customer);

      const customer = customerRepository.create({
        ...dto,
        participantId,
        status: CustomerStatus.ACTIVE,
        documentValidityDate: new Date(dto.documentValidityDate),
        dob: dto.dob ? new Date(dto.dob) : undefined,
      });

      const savedCustomer = await customerRepository.save(customer);

      const mainAccount = await this.accountsService.createCustomerMainAccount(
        {
          customerId: savedCustomer.customerId,
          participantId,
          currency: Currency.SLE,
          type: AccountType.CUSTOMER_MAIN,
          metadata: {
            customerId: savedCustomer.customerId,
            externalId: savedCustomer.externalId,
            msisdn: savedCustomer.msisdn,
          },
        } as any,
        manager,
      );

      savedCustomer.defaultAccountId = mainAccount.accountId;
      await customerRepository.save(savedCustomer);

      return savedCustomer;
    });
  }

  async update(
    customerId: string,
    dto: UpdateCustomerDto,
    participantId: string,
  ): Promise<Customer> {
    const existing = await this.customerRepository.findOne({
      where: { customerId, participantId },
    });

    if (!existing) {
      throw new NotFoundException('Customer not found');
    }

    const effectiveType = dto.type ?? existing.type;
    this.validateUpdateRules(dto, existing, effectiveType);

    if (dto.externalId && dto.externalId !== existing.externalId) {
      const duplicateExternalId = await this.customerRepository.findOne({
        where: { participantId, externalId: dto.externalId },
      });

      if (
        duplicateExternalId &&
        duplicateExternalId.customerId !== customerId
      ) {
        throw new ConflictException('externalId already exists');
      }
    }

    if (dto.msisdn && dto.msisdn !== existing.msisdn) {
      const duplicateMsisdn = await this.customerRepository.findOne({
        where: { participantId, msisdn: dto.msisdn },
      });

      if (duplicateMsisdn && duplicateMsisdn.customerId !== customerId) {
        throw new ConflictException('msisdn already exists');
      }
    }

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

  async findOne(customerId: string, participantId: string): Promise<Customer> {
    const customer = await this.customerRepository.findOne({
      where: { customerId, participantId },
      relations: [
        'defaultAccount',
        'defaultWallet',
        'defaultPaymentInstrument',
      ],
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    return customer;
  }

  async findAll(participantId: string): Promise<Customer[]> {
    return this.customerRepository.find({
      where: { participantId },
      order: { createdAt: 'DESC' },
    });
  }

  async remove(customerId: string, participantId: string): Promise<void> {
    const result = await this.customerRepository.delete({
      customerId,
      participantId,
    });

    if (result.affected === 0) {
      throw new NotFoundException('Customer not found');
    }
  }

  async setPin(customerId: string, participantId: string, dto: SetPinDto) {
    const customer = await this.customerRepository
      .createQueryBuilder('c')
      .addSelect('c.pinHash')
      .where(
        'c.customerId = :customerId AND c.participantId = :participantId',
        {
          customerId,
          participantId,
        },
      )
      .getOne();

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    if (customer.pinHash) {
      throw new BadRequestException(
        'PIN already set. Use change-pin to update it.',
      );
    }

    const saltRounds = Number(process.env.PIN_SALT_ROUNDS ?? 12);
    if (!Number.isInteger(saltRounds) || saltRounds <= 0) {
      throw new Error('Invalid PIN_SALT_ROUNDS');
    }

    customer.pinHash = await bcrypt.hash(dto.pin, saltRounds);
    customer.pinFailedAttempts = 0;
    customer.pinLockedUntil = null as any;

    await this.customerRepository.save(customer);
    return { message: 'PIN set successfully' };
  }

  async changePin(
    customerId: string,
    participantId: string,
    dto: ChangePinDto,
  ) {
    const customer = await this.customerRepository
      .createQueryBuilder('c')
      .addSelect('c.pinHash')
      .where(
        'c.customerId = :customerId AND c.participantId = :participantId',
        {
          customerId,
          participantId,
        },
      )
      .getOne();

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    if (!customer.pinHash) {
      throw new BadRequestException('No PIN set. Use set-pin first.');
    }

    const valid = await bcrypt.compare(dto.currentPin, customer.pinHash);
    if (!valid) {
      throw new UnauthorizedException('Current PIN is incorrect');
    }

    const saltRounds = Number(process.env.PIN_SALT_ROUNDS ?? 12);
    customer.pinHash = await bcrypt.hash(dto.newPin, saltRounds);
    customer.pinFailedAttempts = 0;
    customer.pinLockedUntil = null as any;

    await this.customerRepository.save(customer);
    return { message: 'PIN changed successfully' };
  }

  async verifyPin(
    customerId: string,
    participantId: string,
    pin: string,
  ): Promise<{ message: string }> {
    await this.verifyPinInternal(customerId, participantId, pin);
    return { message: 'PIN verified successfully' };
  }

  async verifyPinOrThrow(
    customerId: string,
    participantId: string,
    pin: string,
  ): Promise<void> {
    await this.verifyPinInternal(customerId, participantId, pin);
  }

  async ensureWallet(
    customerId: string,
    participantId: string,
    manager?: EntityManager,
  ) {
    const customer = await this.findOne(customerId, participantId);

    const existingWallet = await this.walletService.getOptionalWalletByCustomer(
      customerId,
      participantId,
    );

    if (existingWallet) {
      if (!customer.defaultWalletId) {
        customer.defaultWalletId = existingWallet.walletId;
        await this.customerRepository.save(customer);
      }
      return existingWallet;
    }

    const wallet = await this.walletService.createWallet(
      {
        customerId,
        finAddress: `wallet.${customerId}`,
      } as CreateWalletDto,
      participantId,
      manager,
    );

    customer.defaultWalletId = wallet.walletId;
    await this.customerRepository.save(customer);

    return wallet;
  }

  async setDefaultAccount(
    customerId: string,
    participantId: string,
    accountId: string,
  ): Promise<Customer> {
    const customer = await this.findOne(customerId, participantId);

    const account = await this.accountsService.findByIdForCustomerOrThrow(
      accountId,
      customerId,
    );

    customer.defaultAccountId = account.accountId;
    return this.customerRepository.save(customer);
  }

  async setDefaultWallet(
    customerId: string,
    participantId: string,
    walletId: string,
  ): Promise<Customer> {
    const customer = await this.findOne(customerId, participantId);

    const wallet = await this.walletService.getWallet(walletId, participantId);

    if (!wallet || wallet.customerId !== customerId) {
      throw new BadRequestException('Wallet does not belong to this customer');
    }

    customer.defaultWalletId = wallet.walletId;
    return this.customerRepository.save(customer);
  }

  private async assertCreateUniqueness(
    dto: CreateCustomerDto,
    participantId: string,
    manager: EntityManager,
  ): Promise<void> {
    const repo = manager.getRepository(Customer);

    const existingExternal = await repo.findOne({
      where: { externalId: dto.externalId, participantId },
    });

    if (existingExternal) {
      throw new ConflictException('externalId already exists');
    }

    const existingMsisdn = await repo.findOne({
      where: { msisdn: dto.msisdn, participantId },
    });

    if (existingMsisdn) {
      throw new ConflictException('msisdn already exists');
    }
  }

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

    if (
      existing.type === CustomerType.COMPANY &&
      effectiveType === CustomerType.INDIVIDUAL &&
      existing.companyName &&
      !dto.firstName
    ) {
      throw new BadRequestException(
        'firstName is required when changing type to INDIVIDUAL',
      );
    }
  }

  private async verifyPinInternal(
    customerId: string,
    participantId: string,
    pin: string,
  ): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const customer = await manager
        .getRepository(Customer)
        .createQueryBuilder('c')
        .addSelect('c.pinHash')
        .where('c.customerId = :customerId', { customerId })
        .andWhere('c.participantId = :participantId', { participantId })
        .setLock('pessimistic_write')
        .getOne();

      if (!customer) {
        throw new NotFoundException('Customer not found');
      }

      if (!customer.pinHash) {
        throw new BadRequestException(
          'PIN not set. Please set your PIN before making payments.',
        );
      }

      if (
        customer.pinLockedUntil &&
        new Date(customer.pinLockedUntil).getTime() > Date.now()
      ) {
        throw new UnauthorizedException('PIN is temporarily locked');
      }

      const valid = await bcrypt.compare(pin, customer.pinHash);

      if (!valid) {
        customer.pinFailedAttempts = (customer.pinFailedAttempts ?? 0) + 1;

        if (customer.pinFailedAttempts >= 3) {
          const lockedUntil = new Date();
          lockedUntil.setMinutes(lockedUntil.getMinutes() + 15);
          customer.pinLockedUntil = lockedUntil;
          customer.pinFailedAttempts = 0;
        }

        await manager.getRepository(Customer).save(customer);
        throw new UnauthorizedException('Invalid PIN');
      }

      customer.pinFailedAttempts = 0;
      customer.pinLockedUntil = null as any;
      await manager.getRepository(Customer).save(customer);
    });
  }
}
