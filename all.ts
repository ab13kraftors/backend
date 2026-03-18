
/////////////////////////
// FILE: src/app.controller.ts
/////////////////////////
import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('health')
  health() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version ?? '1.0.0',
    };
  }
}

/////////////////////////
// FILE: src/app.module.ts
/////////////////////////
import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { databaseConfig } from './config/database.config';
import { CustomerModule } from './customer/customer.module';
import { OtpModule } from './otp/otp.module';
import { ScheduleModule } from '@nestjs/schedule';
import { AliasModule } from './alias/alias.module';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { AuthModule } from './auth/auth.module';
import { EncryptionInterceptor } from './common/interceptors/encryption.interceptor';
import { AesService } from './common/crypto/aes.service';
import { FinaddressModule } from './finaddress/finaddress.module';
import { PaymentsModule } from './payments/payments.module';
import { CasModule } from './cas/cas.module';
import { AccountsModule } from './accounts/accounts.module';
import { WalletModule } from './wallet/wallet.module';
import { ParticipantGuard } from './common/guards/participant/participant.guard';
import { EmailModule } from './common/email/email.module';
import { KycModule } from './kyc/kyc.module';
import { LedgerModule } from './ledger/ledger.module';
import { ComplianceModule } from './compliance/compliance.module';
import { RolesGuard } from './common/guards/auth/roles.guard';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { LoanModule } from './loan/loan.module';
import { NotificationsModule } from './notifications/notifications.module';
import { SettingsModule } from './settings/settings.module';
import { PaymentInstrumentsModule } from './payment-instruments/payment-instruments.module';
import { LimitsRiskModule } from './limits-risk/limits-risk.module';
import { AdminModule } from './admin/admin.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // envFilePath: '.env',
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 3600000,
        limit: 20,
        // in 1 hr only 20 requests per ip
      },
    ]),
    TypeOrmModule.forRoot(databaseConfig),
    ScheduleModule.forRoot(),
    CustomerModule,
    OtpModule,
    AliasModule,
    AuthModule,
    FinaddressModule,
    PaymentsModule,
    CasModule,
    AccountsModule,
    WalletModule,
    EmailModule,
    KycModule,
    LedgerModule,
    ComplianceModule,
    LoanModule,
    NotificationsModule,
    SettingsModule,
    PaymentInstrumentsModule,
    LimitsRiskModule,
    AdminModule,
  ],
  controllers: [AppController],
  providers: [
    AesService,
    AppService,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: ParticipantGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: EncryptionInterceptor,
    },
  ],
})
export class AppModule {}

/////////////////////////
// FILE: src/app.service.ts
/////////////////////////
import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello(): string {
    return 'Hello World!';
  }
}

/////////////////////////
// FILE: src/main.ts
/////////////////////////
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { doubleCsrf } from 'csrf-csrf';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { AccountsService } from './accounts/accounts.service';

async function bootstrap() {
  // Validate all env vars at startup
  const required = [
    'JWT_SECRET',
    'AES_SECRET',
    // 'FRONTEND_URL',
    'DB_HOST',
    'DB_PORT',
    'DB_USER',
    'DB_PASS',
    'DB_NAME',
  ];

  for (const key of required) {
    if (!process.env[key])
      throw new Error(`Missing required environment variable: ${key}`);
  }

  if (process.env.AES_SECRET!.length !== 64) {
    throw new Error('AES_SECRET must be exactly 64 hex characters (32 bytes)');
  }

  const app = await NestFactory.create(AppModule);

  app.useGlobalFilters(new GlobalExceptionFilter());

  app.use(
    helmet({
      hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
      contentSecurityPolicy: {
        directives: { defaultSrc: ["'self'"] },
      },
    }),
  );

  app.use(cookieParser());

  // Modern CSRF Configuration (csrf-csrf)
  // src/main.ts

  const { doubleCsrfProtection } = doubleCsrf({
    getSecret: () =>
      process.env.JWT_SECRET || '13dddefc0b865032b849ac0e6bd8d2c0',
    cookieName: 'x-csrf-token',
    // ADD THIS: A function that returns a unique ID for the current user/session
    getSessionIdentifier: (req) => {
      // For now, use the participant-id header or a fallback for dev
      return (req.headers['participant-id'] as string) || 'guest-session';
    },
    cookieOptions: {
      httpOnly: true,
      sameSite: 'strict',
      secure: process.env.NODE_ENV === 'production',
    },
    size: 64,
    ignoredMethods: ['GET', 'HEAD', 'OPTIONS'],
    getCsrfTokenFromRequest: (req) => {
      const token = req.headers['x-xsrf-token'];
      return Array.isArray(token) ? token[0] : token;
    },
  });

  if (process.env.NODE_ENV === 'production') {
    app.use(doubleCsrfProtection);
  }

  app.enableCors({
    origin: process.env.FRONTEND_URL || true, // remove true when have frontend
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'participant-id',
      'X-XSRF-Token',
    ],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const accountsService = app.get(AccountsService);
  await accountsService.ensureSystemAccounts();

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();

/////////////////////////
// FILE: src/limits-risk/limits-risk.controller.ts
/////////////////////////
import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { LimitsRiskService } from './limits-risk.service';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { Participant } from 'src/common/decorators/participant/participant.decorator';
import { CheckLimitDto } from './dto/check-limit.dto';
import { KycService } from 'src/kyc/kyc.service';

@UseGuards(JwtAuthGuard)
@Controller('api/fp/limits')
export class LimitsRiskController {
  constructor(
    private readonly service: LimitsRiskService,
    private readonly kycService: KycService,
  ) {}

  @Post('check')
  async check(
    @Participant() participantId: string,
    @Body() dto: CheckLimitDto,
  ) {
    const tier = await this.kycService.getTier(dto.customerId, participantId);
    return this.service.check(
      participantId,
      dto.customerId,
      tier,
      dto.amount,
      dto.direction,
    );
  }
}

/////////////////////////
// FILE: src/limits-risk/limits-risk.module.ts
/////////////////////////
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LimitsRiskService } from './limits-risk.service';
import { LimitsRiskController } from './limits-risk.controller';
import { LimitConfig } from './entities/limit-config.entity';
import { LimitUsage } from './entities/limit-usage.entity';
import { KycModule } from 'src/kyc/kyc.module';

@Module({
  imports: [TypeOrmModule.forFeature([LimitConfig, LimitUsage]), KycModule],
  providers: [LimitsRiskService],
  controllers: [LimitsRiskController],
  exports: [LimitsRiskService],
})
export class LimitsRiskModule {}

/////////////////////////
// FILE: src/limits-risk/limits-risk.service.ts
/////////////////////////
import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LimitConfig } from './entities/limit-config.entity';
import { LimitUsage } from './entities/limit-usage.entity';
import { Repository } from 'typeorm';
import Decimal from 'decimal.js';

@Injectable()
export class LimitsRiskService {
  constructor(
    @InjectRepository(LimitConfig)
    private readonly configRepo: Repository<LimitConfig>,

    @InjectRepository(LimitUsage)
    private readonly usageRepo: Repository<LimitUsage>,
  ) {
    Decimal.set({ precision: 20 });
  }

  // ================= GET CONFIG =================
  async getConfig(participantId: string, level: string) {
    const config = await this.configRepo.findOne({
      where: { participantId, level },
    });

    if (!config) {
      throw new BadRequestException('Limit config not found');
    }

    return config;
  }

  // ================= GET / CREATE USAGE =================
  async getOrCreateUsage(
    participantId: string,
    customerId: string,
  ): Promise<LimitUsage> {
    const today = new Date().toISOString().slice(0, 10);

    let usage = await this.usageRepo.findOne({
      where: { participantId, customerId, date: today },
    });

    if (!usage) {
      usage = this.usageRepo.create({
        participantId,
        customerId,
        date: today,
        dailySent: '0',
        dailyReceived: '0',
        monthlyTotal: '0',
      });

      usage = await this.usageRepo.save(usage);
    }

    return usage;
  }

  // ================= CHECK LIMIT =================
  async check(
    participantId: string,
    customerId: string,
    level: string,
    amountStr: string,
    direction: 'DEBIT' | 'CREDIT',
  ) {
    const config = await this.getConfig(participantId, level);
    const usage = await this.getOrCreateUsage(participantId, customerId);

    const amount = new Decimal(amountStr);

    if (amount.gt(config.singleTxLimit)) {
      throw new BadRequestException('Exceeds single transaction limit');
    }

    if (direction === 'DEBIT') {
      const newDaily = new Decimal(usage.dailySent).add(amount);
      if (newDaily.gt(config.dailySendLimit)) {
        throw new BadRequestException('Daily send limit exceeded');
      }
    } else {
      const newDaily = new Decimal(usage.dailyReceived).add(amount);
      if (newDaily.gt(config.dailyReceiveLimit)) {
        throw new BadRequestException('Daily receive limit exceeded');
      }
    }

    const newMonthly = new Decimal(usage.monthlyTotal).add(amount);
    if (newMonthly.gt(config.monthlyLimit)) {
      throw new BadRequestException('Monthly limit exceeded');
    }

    return true;
  }

  // ================= CONSUME LIMIT =================
  async consume(
    participantId: string,
    customerId: string,
    amountStr: string,
    direction: 'DEBIT' | 'CREDIT',
  ) {
    const usage = await this.getOrCreateUsage(participantId, customerId);
    const amount = new Decimal(amountStr);

    if (direction === 'DEBIT') {
      usage.dailySent = new Decimal(usage.dailySent).add(amount).toString();
    } else {
      usage.dailyReceived = new Decimal(usage.dailyReceived)
        .add(amount)
        .toString();
    }

    usage.monthlyTotal = new Decimal(usage.monthlyTotal).add(amount).toString();

    return this.usageRepo.save(usage);
  }
}

/////////////////////////
// FILE: src/limits-risk/dto/check-limit.dto.ts
/////////////////////////
import { IsString, IsNumberString } from 'class-validator';

export class CheckLimitDto {
  @IsString()
  customerId: string;

  @IsNumberString()
  amount: string;

  @IsString()
  direction: 'DEBIT' | 'CREDIT'; // send or receive
}

/////////////////////////
// FILE: src/limits-risk/entities/limit-config.entity.ts
/////////////////////////
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('limit_configs')
@Index(['participantId', 'level'], { unique: true })
export class LimitConfig {
  @PrimaryGeneratedColumn('uuid')
  configId: string;

  @Column()
  participantId: string;

  @Column()
  level: string; // KYC tier or risk level: LOW, MEDIUM, HIGH

  @Column({ type: 'decimal', precision: 18, scale: 2 })
  dailySendLimit: string;

  @Column({ type: 'decimal', precision: 18, scale: 2 })
  dailyReceiveLimit: string;

  @Column({ type: 'decimal', precision: 18, scale: 2 })
  singleTxLimit: string;

  @Column({ type: 'decimal', precision: 18, scale: 2, default: '0' })
  monthlyLimit: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

/////////////////////////
// FILE: src/limits-risk/entities/limit-usage.entity.ts
/////////////////////////
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('limit_usage')
@Index(['participantId', 'customerId'])
export class LimitUsage {
  @PrimaryGeneratedColumn('uuid')
  usageId: string;

  @Column()
  participantId: string;

  @Column()
  customerId: string;

  @Column({ type: 'date' })
  date: string;

  @Column({ type: 'decimal', precision: 18, scale: 2, default: '0' })
  dailySent: string;

  @Column({ type: 'decimal', precision: 18, scale: 2, default: '0' })
  dailyReceived: string;

  @Column({ type: 'decimal', precision: 18, scale: 2, default: '0' })
  monthlyTotal: string;

  @CreateDateColumn()
  createdAt: Date;
}

/////////////////////////
// FILE: src/customer/customer.controller.ts
/////////////////////////
import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  Put,
  Delete,
  UseGuards,
} from '@nestjs/common';
import { CustomerService } from './customer.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { Customer } from './entities/customer.entity';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { SetPinDto, ChangePinDto, VerifyPinDto } from './dto/pin.dto';
import { Participant } from 'src/common/decorators/participant/participant.decorator';

@UseGuards(JwtAuthGuard)
@Controller('api/fp/customers')
export class CustomerController {
  constructor(private readonly customerService: CustomerService) {}

  @Post()
  async createCustomer(
    @Body() dto: CreateCustomerDto,
    @Participant() participantId: string,
  ): Promise<Customer> {
    return this.customerService.create(dto, participantId);
  }

  @Get(':customerId')
  async getCustomer(
    @Param('customerId') customerId: string,
    @Participant() participantId: string,
  ): Promise<Customer> {
    return this.customerService.findOne(customerId, participantId);
  }

  @Get()
  async getAll(@Participant() participantId: string): Promise<Customer[]> {
    return this.customerService.findAll(participantId);
  }

  @Put(':customerId')
  async updateCustomer(
    @Param('customerId') customerId: string,
    @Body() dto: UpdateCustomerDto,
    @Participant() participantId: string,
  ): Promise<Customer> {
    return this.customerService.update(customerId, dto, participantId);
  }

  @Delete(':customerId')
  async deleteCustomer(
    @Param('customerId') customerId: string,
    @Participant() participantId: string,
  ): Promise<void> {
    return this.customerService.remove(customerId, participantId);
  }

  @Post(':customerId/set-pin')
  setPin(
    @Param('customerId') customerId: string,
    @Body() dto: SetPinDto,
    @Participant() participantId: string,
  ) {
    return this.customerService.setPin(customerId, participantId, dto);
  }

  @Put(':customerId/change-pin')
  changePin(
    @Param('customerId') customerId: string,
    @Body() dto: ChangePinDto,
    @Participant() participantId: string,
  ) {
    return this.customerService.changePin(customerId, participantId, dto);
  }

  @Post(':customerId/verify-pin')
  verifyPin(
    @Param('customerId') customerId: string,
    @Body() dto: VerifyPinDto,
    @Participant() participantId: string,
  ) {
    return this.customerService.verifyPin(customerId, participantId, dto.pin);
  }
}
/////////////////////////
// FILE: src/customer/customer.module.ts
/////////////////////////
import { forwardRef, Module } from '@nestjs/common';
import { CustomerService } from './customer.service';
import { CustomerController } from './customer.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Customer } from './entities/customer.entity';
import { WalletModule } from 'src/wallet/wallet.module';
import { AccountsModule } from 'src/accounts/accounts.module';
import { PaymentInstrumentsModule } from 'src/payment-instruments/payment-instruments.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Customer]),
    forwardRef(() => WalletModule),
    forwardRef(() => AccountsModule),
    forwardRef(() => PaymentInstrumentsModule),
  ],
  providers: [CustomerService],
  controllers: [CustomerController],
  exports: [CustomerService],
})
export class CustomerModule {}
/////////////////////////
// FILE: src/customer/customer.service.ts
/////////////////////////
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

/////////////////////////
// FILE: src/customer/dto/create-customer.dto.ts
/////////////////////////
import {
  IsEnum,
  IsNotEmpty,
  IsDateString,
  IsOptional,
  IsBoolean,
  ValidateIf,
  IsEmail,
  IsString,
} from 'class-validator';
import {
  CustomerType,
  LinkageType,
  Gender,
  DocumentType,
} from 'src/common/enums/customer.enums';

export class CreateCustomerDto {
  @IsEnum(CustomerType)
  type: CustomerType;

  @IsString()
  @IsNotEmpty()
  externalId: string;

  @IsEnum(LinkageType)
  linkageType: LinkageType;

  @IsEnum(DocumentType)
  documentType: DocumentType;

  @IsString()
  @IsNotEmpty()
  documentId: string;

  @IsDateString()
  documentValidityDate: string;

  @IsString()
  @IsNotEmpty()
  msisdn: string;

  @IsOptional()
  @IsBoolean()
  msisdnIsOwned?: boolean;

  @ValidateIf((o: CreateCustomerDto) => o.type === CustomerType.INDIVIDUAL)
  @IsString()
  @IsNotEmpty()
  firstName?: string;

  @ValidateIf((o: CreateCustomerDto) => o.type === CustomerType.INDIVIDUAL)
  @IsString()
  @IsNotEmpty()
  lastName?: string;

  @ValidateIf((o: CreateCustomerDto) => o.type === CustomerType.INDIVIDUAL)
  @IsEnum(Gender)
  @IsNotEmpty()
  gender?: Gender;

  @ValidateIf((o: CreateCustomerDto) => o.type === CustomerType.INDIVIDUAL)
  @IsDateString()
  @IsNotEmpty()
  dob?: string;

  @IsOptional()
  @IsEmail()
  firstEmail?: string;

  @IsOptional()
  @IsEmail()
  secondEmail?: string;

  @ValidateIf((o: CreateCustomerDto) => o.type === CustomerType.COMPANY)
  @IsString()
  @IsNotEmpty()
  companyName?: string;
}
/////////////////////////
// FILE: src/customer/dto/one-step-registration.dto.ts
/////////////////////////
import { CreateCustomerDto } from './create-customer.dto';
import { ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { CreateAliasDto } from 'src/alias/dto/create-alias.dto';
import { CreateFinAddressDto } from 'src/finaddress/dto/create-finaddress.dto';

export class OneStepRegistrationDto {
  @ValidateNested()
  @Type(() => CreateCustomerDto)
  customer: CreateCustomerDto;

  @ValidateNested()
  @Type(() => CreateAliasDto)
  alias: CreateAliasDto;

  @ValidateNested()
  @Type(() => CreateFinAddressDto)
  finAddress: CreateFinAddressDto;
}

/////////////////////////
// FILE: src/customer/dto/pin.dto.ts
/////////////////////////
import { IsString, Length, Matches } from 'class-validator';

export class SetPinDto {
  @IsString()
  @Length(6, 6, { message: 'PIN must be exactly 6 digits' })
  @Matches(/^\d{6}$/, { message: 'PIN must contain only digits' })
  pin: string;
}

export class ChangePinDto {
  @IsString()
  @Length(6, 6)
  @Matches(/^\d{6}$/)
  currentPin: string;

  @IsString()
  @Length(6, 6)
  @Matches(/^\d{6}$/)
  newPin: string;
}

export class VerifyPinDto {
  @IsString()
  @Length(6, 6)
  @Matches(/^\d{6}$/)
  pin: string;
}
/////////////////////////
// FILE: src/customer/dto/update-customer.dto.ts
/////////////////////////
import {
  IsEnum,
  IsOptional,
  IsBoolean,
  IsDateString,
  ValidateIf,
  IsEmail,
  IsString,
} from 'class-validator';
import {
  CustomerType,
  LinkageType,
  CustomerStatus,
  Gender,
  DocumentType,
} from 'src/common/enums/customer.enums';

export class UpdateCustomerDto {
  @IsOptional()
  @IsEnum(CustomerType)
  type?: CustomerType;

  @IsOptional()
  @IsString()
  externalId?: string;

  @IsOptional()
  @IsEnum(LinkageType)
  linkageType?: LinkageType;

  @IsOptional()
  @IsEnum(CustomerStatus)
  status?: CustomerStatus;

  @IsOptional()
  @IsEnum(DocumentType)
  documentType?: DocumentType;

  @IsOptional()
  @IsString()
  documentId?: string;

  @IsOptional()
  @IsDateString()
  documentValidityDate?: string;

  @IsOptional()
  @IsString()
  msisdn?: string;

  @IsOptional()
  @IsBoolean()
  msisdnIsOwned?: boolean;

  @ValidateIf((o: UpdateCustomerDto) => o.type === CustomerType.INDIVIDUAL)
  @IsOptional()
  @IsString()
  firstName?: string;

  @ValidateIf((o: UpdateCustomerDto) => o.type === CustomerType.INDIVIDUAL)
  @IsOptional()
  @IsString()
  lastName?: string;

  @ValidateIf((o: UpdateCustomerDto) => o.type === CustomerType.INDIVIDUAL)
  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender;

  @ValidateIf((o: UpdateCustomerDto) => o.type === CustomerType.INDIVIDUAL)
  @IsOptional()
  @IsDateString()
  dob?: string;

  @IsOptional()
  @IsEmail()
  firstEmail?: string;

  @IsOptional()
  @IsEmail()
  secondEmail?: string;

  @ValidateIf((o: UpdateCustomerDto) => o.type === CustomerType.COMPANY)
  @IsOptional()
  @IsString()
  companyName?: string;
}
/////////////////////////
// FILE: src/customer/entities/customer.entity.ts
/////////////////////////
import {
  CustomerType,
  LinkageType,
  CustomerStatus,
  Gender,
  DocumentType,
} from 'src/common/enums/customer.enums';
import { Wallet } from 'src/wallet/entities/wallet.entity';
import { Account } from 'src/accounts/entities/account.entity';
import { PaymentInstrument } from 'src/payment-instruments/entities/payment-instrument.entity';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  OneToOne,
  JoinColumn,
  Index,
} from 'typeorm';

@Entity('customers')
@Index(['participantId', 'externalId'], { unique: true })
@Index(['participantId', 'msisdn'], { unique: true })
export class Customer {
  @PrimaryGeneratedColumn('uuid')
  customerId: string;

  @Column()
  participantId: string;

  @Column({ type: 'enum', enum: CustomerType })
  type: CustomerType;

  @Column()
  externalId: string;

  @Column({ type: 'enum', enum: LinkageType })
  linkageType: LinkageType;

  @Column({
    type: 'enum',
    enum: CustomerStatus,
    default: CustomerStatus.INACTIVE,
  })
  status: CustomerStatus;

  @Column({
    type: 'enum',
    enum: DocumentType,
    default: DocumentType.NATIONAL_ID,
  })
  documentType: DocumentType;

  @Column()
  documentId: string;

  @Column({ type: 'timestamp' })
  documentValidityDate: Date;

  @Column()
  msisdn: string;

  @Column({ nullable: true, type: 'boolean' })
  msisdnIsOwned?: boolean;

  @Column({ nullable: true, select: false })
  pinHash?: string;

  @Column({ nullable: true, default: 0 })
  pinFailedAttempts?: number;

  @Column({ nullable: true, type: 'timestamp' })
  pinLockedUntil?: Date;

  @Column({ nullable: true, default: false })
  mfaEnabled?: boolean;

  @Column({ nullable: true })
  defaultAccountId?: string;

  @Column({ nullable: true })
  defaultWalletId?: string;

  @Column({ nullable: true })
  defaultPaymentInstrumentId?: string;

  @Column({ nullable: true })
  firstName?: string;

  @Column({ nullable: true })
  lastName?: string;

  @Column({ type: 'enum', enum: Gender, nullable: true })
  gender?: Gender;

  @Column({ type: 'date', nullable: true })
  dob?: Date;

  @Column({ nullable: true })
  firstEmail?: string;

  @Column({ nullable: true })
  secondEmail?: string;

  @Column({ nullable: true })
  companyName?: string;

  @OneToOne(() => Account, { nullable: true })
  @JoinColumn({ name: 'defaultAccountId' })
  defaultAccount?: Account;

  @OneToOne(() => Wallet, { nullable: true })
  @JoinColumn({ name: 'defaultWalletId' })
  defaultWallet?: Wallet;

  @OneToOne(() => PaymentInstrument, { nullable: true })
  @JoinColumn({ name: 'defaultPaymentInstrumentId' })
  defaultPaymentInstrument?: PaymentInstrument;

  @OneToMany(() => Account, (account) => account.customer)
  accounts: Account[];

  @OneToMany(() => Wallet, (wallet) => wallet.customerId)
  wallets: Wallet;

  @OneToMany(
    () => PaymentInstrument,
    (paymentInstrument) => paymentInstrument.customerId,
  )
  paymentInstruments: PaymentInstrument[];

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp', nullable: true })
  updatedAt?: Date;
}

/////////////////////////
// FILE: src/cas/cas.module.ts
/////////////////////////
import { Module } from '@nestjs/common';
import { CasService } from './cas.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Alias } from 'src/alias/entities/alias.entity';
import { FinAddress } from 'src/finaddress/entities/finaddress.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Alias, FinAddress])],
  providers: [CasService],
  exports: [CasService],
})
export class CasModule {}

/////////////////////////
// FILE: src/cas/cas.service.ts
/////////////////////////
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Alias } from 'src/alias/entities/alias.entity';
import { AliasStatus, AliasType } from 'src/common/enums/alias.enums';
import { FinAddress } from 'src/finaddress/entities/finaddress.entity';
import { Repository } from 'typeorm';

@Injectable()
export class CasService {
  constructor(
    // Inject Alias repository
    @InjectRepository(Alias)
    private aliasRepo: Repository<Alias>,

    // Inject FinAddress repository
    @InjectRepository(FinAddress)
    private finRepo: Repository<FinAddress>,
  ) {}

  // ================== resolveAlias ==================
  // Resolves an alias to its default FIN address
  async resolveAlias(aliasType: AliasType, aliasValue: string) {
    // Find active alias matching type and value
    const alias = await this.aliasRepo.findOne({
      where: {
        type: aliasType,
        value: aliasValue,
        status: AliasStatus.ACTIVE,
      },
    });

    // Throw error if alias not found
    if (!alias) {
      throw new NotFoundException('Alias Not found');
    }

    // Find default FIN address linked to the customer
    const fin = await this.finRepo.findOne({
      where: {
        ccuuid: alias.ccuuid,
        isDefault: true,
      },
    });

    // Throw error if FIN address not found
    if (!fin) {
      throw new NotFoundException('Fin address Not found');
    }

    // Return resolved payment routing details
    return {
      finAddress: fin.finAddress,
      servicerId: fin.servicerId,
      type: fin.type,
    };
  }
}

/////////////////////////
// FILE: src/ledger/ledger.controller.ts
/////////////////////////
import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { LedgerService } from './ledger.service';
import { LedgerTransferDto } from './dto/ledger-transfer.dto';
import { LedgerReverseDto } from './dto/ledger-reverse.dto';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/auth/roles.guard';
import { Roles } from 'src/common/decorators/auth/roles.decorator';
import { Role } from 'src/common/enums/auth.enums';

@Controller('ledger')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class LedgerController {
  constructor(private readonly ledgerService: LedgerService) {}

  @Post('transfer')
  async transfer(@Body() dto: LedgerTransferDto) {
    return this.ledgerService.postTransfer(dto);
  }

  @Post('reverse')
  async reverse(@Body() dto: LedgerReverseDto) {
    return this.ledgerService.reverseTransfer(dto);
  }

  @Get('journal/:txId')
  async getJournal(@Param('txId') txId: string) {
    return this.ledgerService.findJournalByTxId(txId);
  }

  @Get('balance/:finAddress')
  async getBalance(
    @Param('finAddress') finAddress: string,
    @Param('participantId') participantId: string,
  ) {
    const balance = await this.ledgerService.getDerivedBalance(
      finAddress,
      participantId,
    );
    return { finAddress, balance };
  }

  @Get('entries/:accountId')
  async getEntries(@Param('accountId') accountId: string) {
    return this.ledgerService.getAccountEntries(accountId);
  }
}

/////////////////////////
// FILE: src/ledger/ledger.module.ts
/////////////////////////
import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LedgerJournal } from './entities/ledger-journal.entity';
import { LedgerPosting } from './entities/ledger-posting.entity';
import { LedgerService } from './ledger.service';
import { AccountsModule } from 'src/accounts/accounts.module';
import { Account } from 'src/accounts/entities/account.entity';
import { LedgerController } from './ledger.controller';
// import { LedgerController } from './ledger.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([LedgerJournal, LedgerPosting, Account]),
    forwardRef(() => AccountsModule),
  ],
  providers: [LedgerService],
  controllers: [LedgerController],
  exports: [LedgerService],
})
export class LedgerModule {}

/////////////////////////
// FILE: src/ledger/ledger.service.ts
/////////////////////////
import {
  Injectable,
  BadRequestException,
  NotFoundException,
  InternalServerErrorException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import Decimal from 'decimal.js';
import { LedgerJournal } from './entities/ledger-journal.entity';
import { LedgerPosting } from './entities/ledger-posting.entity';
import { Account } from '../accounts/entities/account.entity';
import { LedgerTransferInput, LedgerTransferResult } from './ledger.types';
import { Currency } from 'src/common/enums/transaction.enums';
import { AccountsService } from 'src/accounts/accounts.service';
import { LedgerEntrySide } from './enums/ledger-entry-side.enums';
import * as crypto from 'crypto';
import { AccountStatus } from 'src/accounts/enums/account.enum';

interface TransferLeg {
  finAddress: string;
  amount: string;
  isCredit: boolean;
  memo?: string;
}

interface ReverseLeg {
  finAddress: string;
  amount: string;
  isCredit: boolean;
  memo: string;
}

@Injectable()
export class LedgerService {
  constructor(
    @InjectRepository(LedgerJournal)
    private readonly journalRepo: Repository<LedgerJournal>,

    @InjectRepository(LedgerPosting)
    private readonly postingRepo: Repository<LedgerPosting>,

    @InjectRepository(Account)
    private readonly accountRepo: Repository<Account>,

    @Inject(forwardRef(() => AccountsService))
    private readonly accService: AccountsService,

    private readonly dataSource: DataSource,
  ) {
    Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });
  }

  async getDerivedBalance(
    finAddress: string,
    participantId: string,
  ): Promise<string> {
    const account = await this.accountRepo.findOne({
      where: { finAddress, participantId },
      select: ['accountId'],
    });

    if (!account) {
      throw new NotFoundException(`Account not found: ${finAddress}`);
    }

    return this.getDerivedBalanceByAccountId(
      this.accountRepo.manager,
      account.accountId,
    );
  }

  async getDerivedBalanceByAccountId(
    manager: EntityManager,
    accountId: string,
  ): Promise<string> {
    const result = await manager
      .createQueryBuilder(LedgerPosting, 'p')
      .where('p.accountId = :accountId', { accountId })
      .select(
        `COALESCE(SUM(
          CASE
            WHEN p.side = 'DEBIT' THEN -CAST(p.amount AS numeric)
            ELSE CAST(p.amount AS numeric)
          END
        ), 0)`,
        'balance',
      )
      .getRawOne<{ balance: string }>();

    return result?.balance?.toString() ?? '0';
  }

  async postTransfer(
    input: LedgerTransferInput,
    txManager?: EntityManager,
  ): Promise<LedgerTransferResult> {
    const run = async (
      manager: EntityManager,
    ): Promise<LedgerTransferResult> => {
      if (!input.txId?.trim()) {
        throw new BadRequestException('txId is required');
      }

      if (!input.participantId?.trim()) {
        throw new BadRequestException('participantId is required');
      }

      if (!input.currency) {
        throw new BadRequestException('currency is required');
      }

      if (!input.legs?.length || input.legs.length < 2) {
        throw new BadRequestException(
          'At least two legs required for double-entry',
        );
      }

      for (const leg of input.legs) {
        if (!leg.finAddress?.trim()) {
          throw new BadRequestException('Each leg must include finAddress');
        }

        if (!this.isValidMonetaryString(leg.amount)) {
          throw new BadRequestException(`Invalid amount format: ${leg.amount}`);
        }

        if (new Decimal(leg.amount).lte(0)) {
          throw new BadRequestException(
            `Amount must be greater than zero: ${leg.amount}`,
          );
        }
      }

      const idempotentResult = await this.checkIdempotency(
        manager,
        input.idempotencyKey,
      );
      if (idempotentResult) return idempotentResult;

      const accounts = await this.lockAccountsByFinAddress(
        manager,
        input.legs.map((l) => l.finAddress),
        input.currency,
        input.participantId,
      );

      const { totalDebit, totalCredit } = await this.checkBalancesAndInvariant(
        manager,
        input.legs,
        accounts,
      );

      if (!totalDebit.equals(totalCredit)) {
        throw new InternalServerErrorException(
          `Double-entry violation: debit ${totalDebit.toFixed(6)} != credit ${totalCredit.toFixed(6)}`,
        );
      }

      const journal = manager.create(LedgerJournal, {
        txId: input.txId,
        idempotencyKey: input.idempotencyKey,
        reference: input.reference || 'No reference provided',
        participantId: input.participantId,
        postedBy: input.postedBy || 'system',
        postedAt: new Date(),
        currency: input.currency,
      });

      journal.postings = this.buildPostings(
        input.legs,
        accounts,
        input.currency,
      );

      await manager.save(journal);

      return {
        journalId: journal.journalId,
        txId: journal.txId,
        status: 'created',
      };
    };

    if (txManager) {
      return run(txManager);
    }

    return this.dataSource.transaction('SERIALIZABLE', run);
  }

  async reverseTransfer(input: {
    originalTxId: string;
    reason: string;
    postedBy: string;
    participantId: string;
    idempotencyKey?: string;
  }): Promise<LedgerTransferResult> {
    return this.dataSource.transaction('SERIALIZABLE', async (manager) => {
      const original = await manager.findOne(LedgerJournal, {
        where: { txId: input.originalTxId },
        relations: ['postings'],
      });

      if (!original) {
        throw new NotFoundException(
          `Original transaction not found: ${input.originalTxId}`,
        );
      }

      if (original.reversedByTxId) {
        throw new BadRequestException(
          `Already reversed by tx: ${original.reversedByTxId}`,
        );
      }

      const idempotentResult = await this.checkIdempotency(
        manager,
        input.idempotencyKey,
      );
      if (idempotentResult) return idempotentResult;

      const accountIds = [
        ...new Set(original.postings.map((p) => p.accountId)),
      ];

      const accountsByAccountId = await this.lockAccountsByAccountId(
        manager,
        accountIds,
        input.participantId,
      );

      const accountsByFinAddress = new Map<string, Account>();

      for (const account of accountsByAccountId.values()) {
        if (!account.finAddress) {
          throw new BadRequestException(
            `Account ${account.accountId} has no finAddress`,
          );
        }
        accountsByFinAddress.set(account.finAddress, account);
      }

      const reverseLegs: ReverseLeg[] = original.postings.map((p) => {
        const acc = accountsByAccountId.get(p.accountId);
        if (!acc?.finAddress) {
          throw new NotFoundException(`Account not found: ${p.accountId}`);
        }

        return {
          finAddress: acc.finAddress,
          amount: p.amount.toString(),
          isCredit: p.side !== LedgerEntrySide.CREDIT,
          memo: `Reversal of ${input.originalTxId} - ${input.reason}`,
        };
      });

      await this.checkReverseBalances(
        manager,
        reverseLegs,
        accountsByFinAddress,
      );

      const reverseTxId = `REV-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;

      const reverseJournal = manager.create(LedgerJournal, {
        txId: reverseTxId,
        idempotencyKey: input.idempotencyKey,
        reference: `Reversal of ${input.originalTxId}: ${input.reason}`,
        participantId: input.participantId,
        postedBy: input.postedBy,
        postedAt: new Date(),
        currency: original.currency ?? Currency.SLE,
        reversesTxId: input.originalTxId,
      });

      reverseJournal.postings = this.buildPostings(
        reverseLegs,
        accountsByFinAddress,
        original.currency ?? Currency.SLE,
      );

      original.reversedByTxId = reverseTxId;

      await manager.save(original);
      await manager.save(reverseJournal);

      return {
        journalId: reverseJournal.journalId,
        txId: reverseTxId,
        status: 'created',
      };
    });
  }

  async findJournalByTxId(txId: string): Promise<LedgerJournal | null> {
    return this.journalRepo.findOne({
      where: { txId },
      relations: ['postings'],
    });
  }

  async getAccountEntries(accountId: string): Promise<LedgerPosting[]> {
    return this.postingRepo.find({
      where: { accountId },
      order: { postingId: 'DESC' },
    });
  }

  private async checkIdempotency(
    manager: EntityManager,
    idempotencyKey?: string,
  ): Promise<LedgerTransferResult | null> {
    if (!idempotencyKey) return null;

    const existing = await manager.findOne(LedgerJournal, {
      where: { idempotencyKey },
    });

    if (!existing) return null;

    return {
      journalId: existing.journalId,
      txId: existing.txId,
      status: 'already_processed',
    };
  }

  private async lockAccountsByFinAddress(
    manager: EntityManager,
    finAddresses: string[],
    currency: Currency,
    participantId: string,
  ): Promise<Map<string, Account>> {
    const uniqueFinAddresses = [...new Set(finAddresses)];
    const accounts = new Map<string, Account>();

    for (const finAddress of uniqueFinAddresses) {
      const acc = await manager
        .createQueryBuilder(Account, 'a')
        .where('a.finAddress = :fin AND a.participantId = :participantId', {
          fin: finAddress,
          participantId,
        })
        .setLock('pessimistic_write')
        .getOne();

      if (!acc) {
        throw new NotFoundException(`Account not found: ${finAddress}`);
      }

      if (acc.status !== AccountStatus.ACTIVE) {
        throw new BadRequestException(`Account is not active: ${finAddress}`);
      }

      if (acc.currency !== currency) {
        throw new BadRequestException(
          `Currency mismatch for ${finAddress}. Expected ${currency}, found ${acc.currency}`,
        );
      }

      accounts.set(finAddress, acc);
    }

    return accounts;
  }

  private async lockAccountsByAccountId(
    manager: EntityManager,
    accountIds: string[],
    participantId: string,
  ): Promise<Map<string, Account>> {
    const uniqueAccountIds = [...new Set(accountIds)];
    const accounts = new Map<string, Account>();

    for (const accountId of uniqueAccountIds) {
      const acc = await manager
        .createQueryBuilder(Account, 'a')
        .where('a.accountId = :id AND a.participantId = :participantId', {
          id: accountId,
          participantId,
        })
        .setLock('pessimistic_write')
        .getOne();

      if (!acc) {
        throw new NotFoundException(`Account not found: ${accountId}`);
      }

      accounts.set(accountId, acc);
    }

    return accounts;
  }

  private async checkBalancesAndInvariant(
    manager: EntityManager,
    legs: TransferLeg[],
    accounts: Map<string, Account>,
  ): Promise<{ totalDebit: Decimal; totalCredit: Decimal }> {
    let totalDebit = new Decimal(0);
    let totalCredit = new Decimal(0);

    for (const leg of legs) {
      const acc = accounts.get(leg.finAddress);
      if (!acc) {
        throw new NotFoundException(`Account not resolved: ${leg.finAddress}`);
      }

      const amount = new Decimal(leg.amount);

      if (!leg.isCredit) {
        const current = new Decimal(
          await this.getDerivedBalanceByAccountId(manager, acc.accountId),
        );

        if (current.lessThan(amount)) {
          throw new BadRequestException(
            `Insufficient funds on ${leg.finAddress}: ${current.toFixed(6)} < ${amount.toFixed(6)}`,
          );
        }

        totalDebit = totalDebit.add(amount);
      } else {
        totalCredit = totalCredit.add(amount);
      }
    }

    return { totalDebit, totalCredit };
  }

  private async checkReverseBalances(
    manager: EntityManager,
    reverseLegs: ReverseLeg[],
    accounts: Map<string, Account>,
  ): Promise<void> {
    for (const leg of reverseLegs) {
      if (leg.isCredit) continue;

      const acc = accounts.get(leg.finAddress);
      if (!acc) {
        throw new NotFoundException(`Account not resolved: ${leg.finAddress}`);
      }

      const current = new Decimal(
        await this.getDerivedBalanceByAccountId(manager, acc.accountId),
      );
      const amount = new Decimal(leg.amount);

      if (current.lessThan(amount)) {
        throw new BadRequestException(
          `Cannot reverse: insufficient balance on ${leg.finAddress} (${current.toFixed(6)} < ${amount.toFixed(6)})`,
        );
      }
    }
  }

  private buildPostings(
    legs: Array<{
      finAddress: string;
      amount: string;
      isCredit: boolean;
      memo?: string;
    }>,
    accounts: Map<string, Account>,
    currency: Currency,
  ): LedgerPosting[] {
    return legs.map((leg) => {
      const acc = accounts.get(leg.finAddress);
      if (!acc) {
        throw new NotFoundException(`Account not resolved: ${leg.finAddress}`);
      }

      const posting = new LedgerPosting();
      posting.accountId = acc.accountId;
      posting.amount = new Decimal(leg.amount).toFixed(6);
      posting.currency = currency;
      posting.side = leg.isCredit
        ? LedgerEntrySide.CREDIT
        : LedgerEntrySide.DEBIT;
      posting.memo = leg.memo ?? undefined;
      return posting;
    });
  }

  private isValidMonetaryString(v: string): boolean {
    return /^\d+(\.\d{1,6})?$/.test(v);
  }
}

/////////////////////////
// FILE: src/ledger/ledger.types.ts
/////////////////////////
import { Currency } from 'src/common/enums/transaction.enums';

export interface LedgerTransferLegInput {
  finAddress: string;
  amount: string;
  isCredit: boolean;
  memo?: string;
}

export interface LedgerTransferInput {
  txId: string;
  reference?: string;
  participantId: string;
  postedBy?: string;
  idempotencyKey?: string;
  currency: Currency;
  legs: LedgerTransferLegInput[];
}

export interface LedgerTransferResult {
  journalId: string;
  txId: string;
  status: 'created' | 'already_processed';
}

/////////////////////////
// FILE: src/ledger/enums/ledger-entry-side.enums.ts
/////////////////////////
export enum LedgerEntrySide {
  DEBIT = 'DEBIT',
  CREDIT = 'CREDIT',
}

/////////////////////////
// FILE: src/ledger/dto/ledger-post.dto.ts
/////////////////////////
import {
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { Currency } from 'src/common/enums/transaction.enums';
import { LedgerTransferDto } from './ledger-transfer.dto';

export class PostLedgerDto {
  @IsString()
  @IsNotEmpty()
  txId: string;

  @IsString()
  @IsOptional()
  idempotencyKey?: string;

  @IsString()
  @IsNotEmpty()
  reference: string;

  @IsString()
  @IsNotEmpty()
  participantId: string;

  @IsString()
  @IsOptional()
  postedBy?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TransferLegDto)
  legs: TransferLegDto[];

  // Optional: enforce single currency in the future
  @IsEnum(Currency)
  @IsOptional()
  currency?: Currency;
}

/////////////////////////
// FILE: src/ledger/dto/ledger-reverse.dto.ts
/////////////////////////
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class LedgerReverseDto {
  @IsString()
  @IsNotEmpty()
  originalTxId: string;

  @IsString()
  @IsNotEmpty()
  reason: string;

  @IsString()
  @IsNotEmpty()
  postedBy: string;

  @IsString()
  @IsNotEmpty()
  participantId: string;

  @IsOptional()
  @IsString()
  idempotencyKey?: string;
}

/////////////////////////
// FILE: src/ledger/dto/ledger-transfer.dto.ts
/////////////////////////
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { Currency } from 'src/common/enums/transaction.enums';

export class LedgerTransferLegDto {
  @IsString()
  @IsNotEmpty()
  finAddress: string;

  @IsString()
  @IsNotEmpty()
  amount: string;

  @IsBoolean()
  isCredit: boolean;

  @IsOptional()
  @IsString()
  memo?: string;
}

export class LedgerTransferDto {
  @IsString()
  @IsNotEmpty()
  txId: string;

  @IsOptional()
  @IsString()
  reference?: string;

  @IsString()
  @IsNotEmpty()
  participantId: string;

  @IsOptional()
  @IsString()
  postedBy?: string;

  @IsOptional()
  @IsString()
  idempotencyKey?: string;

  @IsEnum(Currency)
  currency: Currency;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LedgerTransferLegDto)
  legs: LedgerTransferLegDto[];
}

/////////////////////////
// FILE: src/ledger/entities/ledger-journal.entity.ts
/////////////////////////
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Currency } from 'src/common/enums/transaction.enums';
import { LedgerPosting } from './ledger-posting.entity';

@Entity('ledger_journals')
@Index('IDX_LEDGER_JOURNAL_TX_ID', ['txId'], { unique: true })
@Index('IDX_LEDGER_JOURNAL_IDEMPOTENCY', ['idempotencyKey'], { unique: true })
export class LedgerJournal {
  @PrimaryGeneratedColumn('uuid')
  journalId: string;

  @Column({ type: 'varchar', length: 120, unique: true })
  txId: string;

  @Column({ type: 'varchar', length: 150, nullable: true, unique: true })
  idempotencyKey?: string;

  @Column({ type: 'varchar', length: 255 })
  reference: string;

  @Column({ type: 'varchar', length: 100 })
  participantId: string;

  @Column({ type: 'varchar', length: 100, default: 'system' })
  postedBy: string;

  @Column({
    type: 'enum',
    enum: Currency,
    default: Currency.SLE,
  })
  currency: Currency;

  @Column({ type: 'varchar', length: 120, nullable: true })
  reversesTxId?: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  reversedByTxId?: string | null;

  @CreateDateColumn()
  postedAt: Date;

  @OneToMany(() => LedgerPosting, (posting) => posting.journal, {
    cascade: true,
  })
  postings: LedgerPosting[];
}

/////////////////////////
// FILE: src/ledger/entities/ledger-posting.entity.ts
/////////////////////////
import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { LedgerJournal } from './ledger-journal.entity';
import { LedgerEntrySide } from '../enums/ledger-entry-side.enums';
import { Currency } from 'src/common/enums/transaction.enums';

@Entity('ledger_postings')
@Index('IDX_LEDGER_POSTING_ACCOUNT_ID', ['accountId'])
@Index('IDX_LEDGER_POSTING_JOURNAL_ID', ['journalId'])
@Index(['accountId', 'side'])
@Index(['journalId', 'accountId'])
export class LedgerPosting {
  @PrimaryGeneratedColumn('uuid')
  postingId: string;

  @Column({ type: 'uuid' })
  journalId: string;

  @Column({ type: 'uuid' })
  accountId: string;

  @Column({
    type: 'enum',
    enum: LedgerEntrySide,
  })
  side: LedgerEntrySide;

  @Column({ type: 'numeric', precision: 20, scale: 6 })
  amount: string;

  @Column({
    type: 'enum',
    enum: Currency,
    default: Currency.SLE,
  })
  currency: Currency;

  @Column({ type: 'varchar', length: 255, nullable: true })
  memo?: string;

  @ManyToOne(() => LedgerJournal, (journal) => journal.postings, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'journalId' })
  journal: LedgerJournal;
}

/////////////////////////
// FILE: src/database/seeds/participant.seed.ts
/////////////////////////
import { Participant } from 'src/auth/entities/participant.entity';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { Role } from 'src/common/enums/auth.enums';

// ================== seedParticipant ==================
// Seeds a default participant (admin) into the database
export async function seedParticipant(dataSource: DataSource) {
  // Get repository for Participant entity
  const repo = dataSource.getRepository(Participant);

  // Check if admin user already exists
  const existing = await repo.findOne({ where: { username: 'admin' } });
  if (existing) {
    console.log('Participant already seeded - skipping');
    return;
  }

  // Hash default password
  const passwordHash = await bcrypt.hash('Admin@1234', 12);

  // Create and save participant record
  await repo.save(
    repo.create({
      participantId: 'BANK_SL_001',
      username: 'admin',
      passwordHash,
      roles: [Role.ADMIN],
      isActive: true,
    }),
  );

  // Log success message
  console.log('Participant seeded: username=admin, participantId=BANK_SL_001');
}

/////////////////////////
// FILE: src/database/seeds/run-seed.ts
/////////////////////////
import { DataSource } from 'typeorm';
import { seedParticipant } from './participant.seed';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// ================== DataSource Configuration ==================
// Configure TypeORM connection for seeding
const dataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  username: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  entities: [__dirname + '/../../**/*.entity{.ts,.js}'],
  synchronize: true,
});

// ================== run ==================
// Initializes DB, runs seed, then closes connection
async function run() {
  await dataSource.initialize();

  // Seed participant data
  await seedParticipant(dataSource);

  // Close DB connection
  await dataSource.destroy();
}

// Execute seeding script
run().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});

/////////////////////////
// FILE: src/compliance/compliance.controller.ts
/////////////////////////
import { Controller } from '@nestjs/common';

@Controller('compliance')
export class ComplianceController {}

/////////////////////////
// FILE: src/compliance/compliance.module.ts
/////////////////////////

import { Module } from '@nestjs/common';
import { ComplianceService } from './compliance.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Transaction } from 'src/payments/transaction/entities/transaction.entity';
import { KycModule } from 'src/kyc/kyc.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Transaction]),
    KycModule,
  ],
  providers: [ComplianceService],
  exports: [ComplianceService],
})
export class ComplianceModule {}

/////////////////////////
// FILE: src/compliance/compliance.service.ts
/////////////////////////
import { Injectable, BadRequestException } from '@nestjs/common';
import Decimal from 'decimal.js';

import { ValidateTransactionDto } from './dto/validate-transaction.dto';
import { KycService } from 'src/kyc/kyc.service';
import { KycTier } from 'src/common/enums/kyc.enums';
import { TransactionStatus } from 'src/common/enums/transaction.enums';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Transaction } from 'src/payments/transaction/entities/transaction.entity';
import { ComplianceTxnType } from './enums/compliance.enum';

@Injectable()
export class ComplianceService {
  constructor(
    private readonly kycService: KycService,

    @InjectRepository(Transaction)
    private readonly txRepo: Repository<Transaction>,
  ) {}

  // =========================
  // 🔵 MAIN ENTRY POINT
  // =========================
  async validate(dto: ValidateTransactionDto, participantId: string) {
    const amount = new Decimal(dto.amount);

    if (amount.lte(0)) {
      throw new BadRequestException('Invalid amount');
    }

    await this.checkKyc(dto.customerId, dto.type, amount, participantId);
    await this.checkLimits(dto.customerId, dto.type, amount);
    await this.checkSanctions(dto.customerId);

    return true;
  }

  // =========================
  // 🔐 KYC RULE
  // =========================
  private async checkKyc(
    customerId: string,
    type: ComplianceTxnType,
    amount: Decimal,
    participantId: string,
  ) {
    if (type === ComplianceTxnType.WITHDRAW || amount.gt(5000)) {
      await this.kycService.requireTier(
        customerId,
        participantId,
        KycTier.HARD_APPROVED,
      );
    } else {
      await this.kycService.requireTier(
        customerId,
        participantId,
        KycTier.SOFT_APPROVED,
      );
    }
  }

  // =========================
  // 📊 LIMIT RULE
  // =========================
  private async checkLimits(
    customerId: string,
    type: ComplianceTxnType,
    amount: Decimal,
  ) {
    const dailyLimit = new Decimal(10000);
    const singleLimit = new Decimal(5000);

    if (amount.gt(singleLimit)) {
      throw new BadRequestException(
        `Amount exceeds single transaction limit (${singleLimit})`,
      );
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const result = await this.txRepo
      .createQueryBuilder('tx')
      .select('COALESCE(SUM(tx.amount), 0)', 'total')
      .where('tx.createdAt >= :today', { today })
      .andWhere('tx.status = :status', {
        status: TransactionStatus.COMPLETED,
      })
      .andWhere('tx.senderFinAddress LIKE :pattern', {
        pattern: `%${customerId}`,
      })
      .getRawOne<{ total: string }>();

    const used = new Decimal(result?.total || '0');
    const projected = used.add(amount);

    if (projected.gt(dailyLimit)) {
      throw new BadRequestException(`Daily limit exceeded (${dailyLimit})`);
    }
  }

  // =========================
  // 🚫 SANCTIONS RULE
  // =========================
  private async checkSanctions(customerId: string) {
    // placeholder for blacklist / AML
    const blocked = false;

    if (blocked) {
      throw new BadRequestException(
        'Transaction blocked due to compliance restrictions',
      );
    }
  }
}

/////////////////////////
// FILE: src/compliance/enums/compliance.enum.ts
/////////////////////////
export enum ComplianceTxnType {
  FUNDING = 'FUNDING',
  WITHDRAW = 'WITHDRAW',
  TRANSFER = 'TRANSFER',
}
/////////////////////////
// FILE: src/compliance/dto/validate-transaction.dto.ts
/////////////////////////
import { IsEnum, IsString, Matches } from 'class-validator';



export class ValidateTransactionDto {
  @IsString()
  customerId: string;

  @IsEnum(ComplianceTxnType)
  type: ComplianceTxnType;

  @IsString()
  @Matches(/^\d+(\.\d{1,2})?$/)
  amount: string;

  @IsString()
  currency: string;
}
/////////////////////////
// FILE: src/compliance/entities/compliance-log.entity.ts
/////////////////////////
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity('compliance_logs')
export class ComplianceLog {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column() action: string; // e.g., 'login', 'txn_create'
  @Column() userId: string;
  @Column() participantId: string;
  @Column('json', { nullable: true }) metadata: any; // e.g., { ip, amount }
  @CreateDateColumn() timestamp: Date;
  @Column({ default: false }) reported: boolean; // For SAR
}

/////////////////////////
// FILE: src/notifications/notifications.controller.ts
/////////////////////////
import {
  Controller,
  Get,
  Patch,
  Param,
  UseGuards,
  Query,
} from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Participant } from '../common/decorators/participant/participant.decorator';
import { GetNotificationsQueryDto } from './dto/get-notifications-query.dto';

@UseGuards(JwtAuthGuard)
@Controller('api/notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  async getNotifications(
    @Participant() participantId: string,
    @Query() query: GetNotificationsQueryDto,
  ) {
    const { limit = 50, offset = 0 } = query;

    const data = await this.notificationsService.getUserNotifications(
      participantId,
      limit,
      offset,
    );

    const unreadCount =
      await this.notificationsService.getUnreadCount(participantId);

    return {
      unreadCount,
      data,
    };
  }

  @Patch(':id/read')
  async markAsRead(
    @Participant() participantId: string,
    @Param('id') notificationId: string,
  ) {
    return this.notificationsService.markAsRead(participantId, notificationId);
  }

  @Patch('read-all')
  async markAllAsRead(@Participant() participantId: string) {
    return this.notificationsService.markAllAsRead(participantId);
  }
}

/////////////////////////
// FILE: src/notifications/notifications.module.ts
/////////////////////////
import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { Notification } from './entities/notification.entity';

@Global() // Makes this service available everywhere
@Module({
  imports: [TypeOrmModule.forFeature([Notification])],
  controllers: [NotificationsController],
  providers: [NotificationsService],
  exports: [NotificationsService], // Export so OtpService and WalletService can use it
})
export class NotificationsModule {}

/////////////////////////
// FILE: src/notifications/notifications.service.ts
/////////////////////////
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import { Notification } from './entities/notification.entity';
import {
  NotificationStatus,
  NotificationType,
} from 'src/common/enums/notification.enums';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private readonly sns: SNSClient;
  private readonly ses: SESClient;

  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepo: Repository<Notification>,
  ) {
    const region = process.env.AWS_REGION;

    this.sns = new SNSClient({ region });
    this.ses = new SESClient({ region });
  }

  // ----------------------------
  // PRIVATE HELPERS
  // ----------------------------

  private async createNotification(data: Partial<Notification>) {
    const notification = this.notificationRepo.create(data);
    return this.notificationRepo.save(notification);
  }

  private async updateNotificationStatus(
    notification: Notification,
    status: NotificationStatus,
  ) {
    notification.status = status;
    return this.notificationRepo.save(notification);
  }

  // ----------------------------
  // EXTERNAL DELIVERY METHODS
  // ----------------------------

  async sendSms(
    participantId: string,
    phoneNumber: string,
    message: string,
  ): Promise<boolean> {
    const notification = await this.createNotification({
      participantId,
      type: NotificationType.SMS,
      title: 'SMS Alert',
      message,
      status: NotificationStatus.PENDING,
    });

    try {
      await this.sns.send(
        new PublishCommand({
          Message: message,
          PhoneNumber: phoneNumber,
          MessageAttributes: {
            'AWS.SNS.SMS.SMSType': {
              DataType: 'String',
              StringValue: 'Transactional',
            },
          },
        }),
      );

      await this.updateNotificationStatus(
        notification,
        NotificationStatus.SENT,
      );
      this.logger.log(`SMS sent to ${phoneNumber}`);
      return true;
    } catch (error) {
      await this.updateNotificationStatus(
        notification,
        NotificationStatus.FAILED,
      );
      this.logger.error(
        `Failed to send SMS to ${phoneNumber}`,
        error instanceof Error ? error.stack : String(error),
      );
      return false;
    }
  }
  async sendEmail(
    participantId: string,
    email: string,
    subject: string,
    body: string,
  ): Promise<boolean> {
    const notification = await this.createNotification({
      participantId,
      type: NotificationType.EMAIL,
      title: subject,
      message: body,
      status: NotificationStatus.PENDING,
    });

    try {
      await this.ses.send(
        new SendEmailCommand({
          Source: process.env.SYSTEM_EMAIL_SENDER || 'noreply@linkpay.sl',
          Destination: {
            ToAddresses: [email],
          },
          Message: {
            Subject: {
              Data: subject,
            },
            Body: {
              Text: {
                Data: body,
              },
            },
          },
        }),
      );

      await this.updateNotificationStatus(
        notification,
        NotificationStatus.SENT,
      );
      this.logger.log(`Email sent to ${email}`);
      return true;
    } catch (error) {
      await this.updateNotificationStatus(
        notification,
        NotificationStatus.FAILED,
      );
      this.logger.error(
        `Failed to send email to ${email}`,
        error instanceof Error ? error.stack : String(error),
      );
      return false;
    }
  }

  async sendPushNotification(
    participantId: string,
    fcmToken: string,
    title: string,
    body: string,
    metadata?: Record<string, any>,
  ): Promise<boolean> {
    const notification = await this.createNotification({
      participantId,
      type: NotificationType.PUSH,
      title,
      message: body,
      metadata,
      status: NotificationStatus.PENDING,
    });

    try {
      // TODO: Replace with Firebase Admin SDK when FCM is configured
      this.logger.log(
        `[MOCK] Push sent to FCM Token: ${fcmToken} | Title: ${title}`,
      );

      await this.updateNotificationStatus(
        notification,
        NotificationStatus.SENT,
      );
      return true;
    } catch (error) {
      await this.updateNotificationStatus(
        notification,
        NotificationStatus.FAILED,
      );
      this.logger.error(
        'Failed to send push notification',
        error instanceof Error ? error.stack : String(error),
      );
      return false;
    }
  }
  async createInAppNotification(
    participantId: string,
    title: string,
    message: string,
    metadata?: Record<string, any>,
  ): Promise<Notification> {
    return this.createNotification({
      participantId,
      type: NotificationType.IN_APP,
      title,
      message,
      metadata,
      status: NotificationStatus.SENT,
    });
  }

  // ----------------------------
  // IN-APP INBOX METHODS
  // ----------------------------

  async getUserNotifications(
    participantId: string,
    limit = 50,
    offset = 0,
  ): Promise<Notification[]> {
    return this.notificationRepo.find({
      where: { participantId },
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset,
    });
  }

  async getUnreadCount(participantId: string): Promise<number> {
    return this.notificationRepo.count({
      where: { participantId, isRead: false },
    });
  }

  async markAsRead(
    participantId: string,
    notificationId: string,
  ): Promise<Notification> {
    const notification = await this.notificationRepo.findOne({
      where: { id: notificationId, participantId },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    if (!notification.isRead) {
      notification.isRead = true;
      await this.notificationRepo.save(notification);
    }

    return notification;
  }

  async markAllAsRead(
    participantId: string,
  ): Promise<{ success: true; message: string }> {
    await this.notificationRepo.update(
      { participantId, isRead: false },
      { isRead: true },
    );

    return {
      success: true,
      message: 'All notifications marked as read',
    };
  }
}

/////////////////////////
// FILE: src/notifications/dto/get-notifications-query.dto.ts
/////////////////////////
import { IsInt, IsOptional, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class GetNotificationsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 50;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number = 0;
}

/////////////////////////
// FILE: src/notifications/entities/notification.entity.ts
/////////////////////////
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';
import {
  NotificationStatus,
  NotificationType,
} from 'src/common/enums/notification.enums';

@Entity('notifications')
@Index('IDX_NOTIFICATIONS_PARTICIPANT_CREATED_AT', [
  'participantId',
  'createdAt',
])
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  participantId: string;

  @Column({
    type: 'enum',
    enum: NotificationType,
  })
  type: NotificationType;

  @Column()
  title: string;

  @Column('text')
  message: string;

  @Column({
    type: 'enum',
    enum: NotificationStatus,
    default: NotificationStatus.PENDING,
  })
  status: NotificationStatus;

  @Column({ default: false })
  isRead: boolean;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any> | null;

  @CreateDateColumn()
  createdAt: Date;
}

/*
@Column({nullable: true})
customerId?: string;    // add tracing

@Column({nullable: true})
referenceId?: string;   // for otpId/txId/mfaId
*/

/////////////////////////
// FILE: src/config/database.config.ts
/////////////////////////
import { TypeOrmModuleOptions } from '@nestjs/typeorm';

// export const databaseConfig: TypeOrmModuleOptions = {
//   type: 'postgres',
//   host: process.env.DB_HOST,
//   port: Number(process.env.DB_PORT),
//   username: process.env.DB_USER,
//   password: process.env.DB_PASS,
//   database: process.env.DB_NAME,
//   autoLoadEntities: true,
//   synchronize:  process.env.NODE_ENV !== 'production'
// };

export const databaseConfig: TypeOrmModuleOptions = {
  type: 'postgres',
  host: 'localhost',
  port: 5432,
  username: 'cas_user',
  password: 'cas_password', // Hardcode temporarily to test
  database: 'cas_db2',
  autoLoadEntities: true,
  synchronize: true,
  dropSchema: false,
};

/////////////////////////
// FILE: src/config/jwt.config.ts
/////////////////////////
export const jwtConfig = {
  secret: process.env.JWT_SECRET,
  expiresIn: '15m',
};

/////////////////////////
// FILE: src/finaddress/finaddress.controller.ts
/////////////////////////
import {
  Controller,
  UseGuards,
  Param,
  Body,
  Post,
  Get,
  Query,
  Delete,
} from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { FinaddressService } from './finaddress.service';
import { Participant } from 'src/common/decorators/participant/participant.decorator';
import { CreateFinAddressDto } from './dto/create-finaddress.dto';
import { AliasType } from 'src/common/enums/alias.enums';
import { SetDefaultFinAddressDto } from './dto/set-default-finaddress.dto';

@UseGuards(JwtAuthGuard)
@Controller('api/fp/cas/v2')
export class FinaddressController {
  constructor(private readonly finService: FinaddressService) {}

  @Get('finaddresses')
  resolveAlias(
    @Query('aliasType') aliasType: AliasType,
    @Query('aliasValue') aliasValue: string,
  ) {
    return this.finService.resolveAlias(aliasType, aliasValue);
  }

  @Post('customer/:customerId/finaddresses')
  create(
    @Participant() participantId: string,
    @Param('customerId') customerId: string,
    @Body() dto: CreateFinAddressDto,
  ) {
    return this.finService.create(participantId, customerId, dto);
  }

  @Get('customer/:customerId/finaddresses')
  findAll(
    @Participant() participantId: string,
    @Param('customerId') customerId: string,
    @Query('pageNo') pageNo?: number,
    @Query('pageSize') pageSize?: number,
  ) {
    return this.finService.findAll(
      participantId,
      customerId,
      Number(pageNo ?? 0),
      Number(pageSize ?? 10),
    );
  }

  @Post('customer/:customerId/finaddresses/default')
  setDefault(
    @Participant() participantId: string,
    @Param('customerId') customerId: string,
    @Body() dto: SetDefaultFinAddressDto,
  ) {
    return this.finService.setDefault(
      participantId,
      customerId,
      dto.finAddressId,
    );
  }

  @Delete('customer/:customerId/finaddresses/:finAddressId')
  remove(
    @Participant() participantId: string,
    @Param('customerId') customerId: string,
    @Param('finAddressId') finAddressId: string,
  ) {
    return this.finService.remove(participantId, customerId, finAddressId);
  }
}

/////////////////////////
// FILE: src/finaddress/finaddress.module.ts
/////////////////////////
import { Module } from '@nestjs/common';
import { FinaddressService } from './finaddress.service';
import { FinaddressController } from './finaddress.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FinAddress } from './entities/finaddress.entity';
import { CustomerModule } from 'src/customer/customer.module';
import { Alias } from 'src/alias/entities/alias.entity';

@Module({
  imports: [TypeOrmModule.forFeature([FinAddress, Alias]), CustomerModule],
  providers: [FinaddressService],
  controllers: [FinaddressController],
})
export class FinaddressModule {}

/////////////////////////
// FILE: src/finaddress/finaddress.service.ts
/////////////////////////
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

/////////////////////////
// FILE: src/finaddress/dto/create-finaddress.dto.ts
/////////////////////////
import { IsEnum, IsNotEmpty } from 'class-validator';
import { ServicerIdType, Type } from 'src/common/enums/finaddress.enums';

export class CreateFinAddressDto {
  @IsEnum(Type)
  type: Type;

  @IsNotEmpty()
  finAddress: string;

  @IsEnum(ServicerIdType)
  servicerIdType: ServicerIdType;

  @IsNotEmpty()
  servicerId: string;
}
/////////////////////////
// FILE: src/finaddress/dto/set-default-finaddress.dto.ts
/////////////////////////
import { IsNotEmpty, IsUUID } from 'class-validator';

export class SetDefaultFinAddressDto {
  @IsUUID()
  @IsNotEmpty()
  finAddressId: string;
}
/////////////////////////
// FILE: src/finaddress/entities/finaddress.entity.ts
/////////////////////////
import { ServicerIdType, Type } from 'src/common/enums/finaddress.enums';
import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Customer } from 'src/customer/entities/customer.entity';

@Entity('fin_addresses')
@Unique(['participantId', 'finAddress'])
@Index(['participantId', 'customerId'])
export class FinAddress {
  @PrimaryGeneratedColumn('uuid')
  finAddressId: string;

  @Column()
  participantId: string;

  @Column()
  customerId: string;

  @ManyToOne(() => Customer, (customer) => customer.finAddresses, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'customerId' })
  customer: Customer;

  @Column({ type: 'enum', enum: Type })
  type: Type;

  @Column()
  finAddress: string;

  @Column({ type: 'enum', enum: ServicerIdType })
  servicerIdType: ServicerIdType;

  @Column()
  servicerId: string;

  @Column({ default: false })
  isDefault: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
/////////////////////////
// FILE: src/auth/auth.controller.ts
/////////////////////////
import {
  Controller,
  Post,
  Delete,
  Body,
  Res,
  UseGuards,
  Req,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './jwt-auth.guard';

// ================== Cookie Config ==================
// Cookie name used to store JWT token
const COOKIE_NAME = 'nssl-token';

// Secure cookie configuration
const COOKIE_OPTS = {
  httpOnly: true,
  secure: true,
  sameSite: 'strict' as const,
  maxAge: 15 * 60 * 1000,
};

@Controller('auth')
export class AuthController {
  constructor(
    // Inject Auth service
    private readonly authService: AuthService,
  ) {}

  // ================== login ==================
  // Authenticates user and stores JWT in secure cookie
  @Post('token')
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: any) {
    const token = await this.authService.login(dto);

    // Set JWT token as HTTP-only cookie
    res.cookie(COOKIE_NAME, token, COOKIE_OPTS);

    return { success: true };
  }

  // ================== refresh ==================
  @Post('refresh')
  @UseGuards(JwtAuthGuard) // Requires a currently valid token to refresh
  async refresh(@Req() req: any, @Res({ passthrough: true }) res: any) {
    // Generate a new token based on the existing user's data
    const newToken = await this.authService.login({
      username: req.user.username,
    } as any);

    res.cookie(COOKIE_NAME, newToken, COOKIE_OPTS);
    return { success: true };
  }

  // ================== logout ==================
  // Clears authentication cookie
  @Delete('token')
  @UseGuards(JwtAuthGuard)
  logout(@Res({ passthrough: true }) res: any) {
    res.clearCookie(COOKIE_NAME, {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
    });

    return { success: true };
  }
}

/////////////////////////
// FILE: src/auth/auth.module.ts
/////////////////////////
import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { JwtStrategy } from './jwt.strategy';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Participant } from './entities/participant.entity';
import { OtpModule } from 'src/otp/otp.module';
import { CustomerModule } from 'src/customer/customer.module';

@Module({
  imports: [
    PassportModule,
    TypeOrmModule.forFeature([Participant]),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const secret = config.get<string>('JWT_SECRET');
        if (!secret)
          throw new Error('JWT_SECRET environment variable is not set');
        return { secret, signOptions: { expiresIn: '15m' } };
      },
    }),
    OtpModule,
    CustomerModule,
  ],
  providers: [AuthService, JwtStrategy],
  controllers: [AuthController],
  exports: [TypeOrmModule, AuthService],
})
export class AuthModule {}

/////////////////////////
// FILE: src/auth/auth.service.ts
/////////////////////////
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Participant } from './entities/participant.entity';
import * as bcrypt from 'bcrypt';
import { LoginDto } from './dto/login.dto';
import { CustomerService } from 'src/customer/customer.service';
import { OtpService } from 'src/otp/otp.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly customerService: CustomerService,
    private readonly otpService: OtpService,

    @InjectRepository(Participant)
    private readonly participantRepo: Repository<Participant>,
  ) {}

  // ================== login ==================
  // Authenticates user and returns JWT token
  async login(dto: LoginDto): Promise<string> {
    const participant = await this.participantRepo.findOne({
      where: { username: dto.username, isActive: true },
    });

    // Validate user existence and password
    // Same error used to prevent username enumeration
    if (
      !participant ||
      !(await bcrypt.compare(dto.password, participant.passwordHash))
    ) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Create JWT payload
    const payload = {
      sub: participant.participantId,
      participantId: participant.participantId,
      username: participant.username,
      roles: participant.roles,
    };

    // Generate signed JWT token
    return this.jwtService.sign(payload);
  }

  // ================== validate ==================
  // Validates JWT payload during authentication
  async validate(payload: any) {
    if (!payload || !payload.sub || !payload.participantId) {
      throw new UnauthorizedException('Invalid token payload');
    }

    return {
      participantId: payload.participantId,
      username: payload.username,
      roles: payload.roles || [],
    };
  }
}

/*

*/

/////////////////////////
// FILE: src/auth/jwt-auth.guard.ts
/////////////////////////
import { AuthGuard } from '@nestjs/passport';
import {
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
//   async canActivate(context: ExecutionContext) {
//     const req = context.switchToHttp().getRequest();
//     const token = this.extractor(req); // Existing
//     const payload = this.jwtService.verify(token);
//     if (payload.ip !== req.ip)
//       throw new UnauthorizedException('IP mismatch (security)');
//     if (await this.authService.isTokenBlacklisted(token))
//       throw new UnauthorizedException('Token revoked');
//     req.user = payload;
//     return true;
//   }
}

/////////////////////////
// FILE: src/auth/jwt.strategy.ts
/////////////////////////
import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, ExtractJwt } from 'passport-jwt';
import { AuthService } from './auth.service';
import { Request } from 'express';

export interface JwtUser {
  participantId: string;
  username: string;
  roles: string[];
  // add more fields if needed (email, etc.)
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly authService: AuthService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (req: Request) => {
          const token = req?.cookies?.['nssl-token'] as string | undefined;
          return token || null;
        },
      ]),

      ignoreExpiration: false, //  token expiration

      secretOrKey: (() => {
        const s = process.env.JWT_SECRET;
        if (!s) throw new Error('JWT_SECRET environment variable is not set');
        return s;
      })(),
    });
  }

  // ================== validate ==================
  // Validates decoded JWT payload using AuthService
  async validate(payload: Record<string, any>): Promise<any> {
    const validated = await this.authService.validate(payload);

    return {
      participantId: validated.participantId,
      username: validated.username,
      roles: validated.roles || [],
    };
  }
}

/////////////////////////
// FILE: src/auth/dto/login.dto.ts
/////////////////////////
import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @IsString()
  @IsNotEmpty()
  username: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  password: string;
}

/////////////////////////
// FILE: src/auth/entities/participant.entity.ts
/////////////////////////
import { Role } from 'src/common/enums/auth.enums';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

// Represents a bank/institution that connects to the switch
@Entity('participants')
export class Participant {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  participantId: string; // e.g. "BANK_SL_001" — used in JWT payload

  @Column({ unique: true })
  username: string;

  @Column()
  passwordHash: string;

  @Column({ type: 'simple-array', default: Role.CUSTOMER })
  roles: string[];

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

/////////////////////////
// FILE: src/alias/alias.controller.ts
/////////////////////////
import {
  Body,
  Controller,
  Post,
  Param,
  Get,
  Delete,
  Put,
  UseGuards,
} from '@nestjs/common';
import { AliasService } from './alias.service';
import { Participant } from 'src/common/decorators/participant/participant.decorator';
import { CreateAliasDto } from './dto/create-alias.dto';
import { UpdateAliasDto } from './dto/update-create.dto';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('api/fp/customers')
export class AliasController {
  constructor(private readonly aliasService: AliasService) {}

  @Post(':customerId/aliases')
  create(
    @Participant() participantId: string,
    @Param('customerId') customerId: string,
    @Body() dto: CreateAliasDto,
  ) {
    return this.aliasService.create(participantId, customerId, dto);
  }

  @Get(':customerId/aliases')
  findAll(
    @Participant() participantId: string,
    @Param('customerId') customerId: string,
  ) {
    return this.aliasService.findAll(participantId, customerId);
  }

  @Put(':customerId/aliases/:aliasId')
  update(
    @Participant() participantId: string,
    @Param('customerId') customerId: string,
    @Param('aliasId') aliasId: string,
    @Body() dto: UpdateAliasDto,
  ) {
    return this.aliasService.update(aliasId, participantId, dto);
  }

  @Delete(':customerId/aliases/:aliasId')
  remove(
    @Participant() participantId: string,
    @Param('customerId') customerId: string,
    @Param('aliasId') aliasId: string,
  ) {
    return this.aliasService.remove(aliasId, participantId);
  }
}
/////////////////////////
// FILE: src/alias/alias.module.ts
/////////////////////////
import { Module } from '@nestjs/common';
import { AliasService } from './alias.service';
import { AliasController } from './alias.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Alias } from './entities/alias.entity';
import { CustomerModule } from 'src/customer/customer.module';

@Module({
  imports: [TypeOrmModule.forFeature([Alias]), CustomerModule],
  providers: [AliasService],
  controllers: [AliasController],
})
export class AliasModule {}

/////////////////////////
// FILE: src/alias/alias.service.ts
/////////////////////////
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

/////////////////////////
// FILE: src/alias/dto/create-alias.dto.ts
/////////////////////////
import { IsEnum, IsNotEmpty, Length } from 'class-validator';
import { AliasType } from 'src/common/enums/alias.enums';

export class CreateAliasDto {
  @IsEnum(AliasType)
  type: AliasType;

  @IsNotEmpty()
  @Length(3, 100)
  value: string;
}
/////////////////////////
// FILE: src/alias/dto/resolve-alias.dto.ts
/////////////////////////
import { IsEnum, IsNotEmpty } from 'class-validator';
import { AliasType } from 'src/common/enums/alias.enums';

export class ResolveAliasDto {
  @IsEnum(AliasType)
  aliasType: AliasType;

  @IsNotEmpty()
  aliasValue: string;
}
/////////////////////////
// FILE: src/alias/dto/update-create.dto.ts
/////////////////////////
import { IsEnum, IsNotEmpty, Length } from 'class-validator';
import { AliasType } from 'src/common/enums/alias.enums';

export class CreateAliasDto {
  @IsEnum(AliasType)
  type: AliasType;

  @IsNotEmpty()
  @Length(3, 100)
  value: string;
}
/////////////////////////
// FILE: src/alias/entities/alias.entity.ts
/////////////////////////
import { AliasStatus, AliasType } from 'src/common/enums/alias.enums';
import { Customer } from 'src/customer/entities/customer.entity';
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Index,
} from 'typeorm';

@Entity('aliases')
@Index(['participantId', 'type', 'value'], { unique: true })
export class Alias {
  @PrimaryGeneratedColumn('uuid')
  aliasId: string;

  @Column()
  participantId: string;

  @Column()
  customerId: string;

  @ManyToOne(() => Customer, (customer) => customer.aliases, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'customerId' })
  customer: Customer;

  @Column({ type: 'enum', enum: AliasType })
  type: AliasType;

  @Column()
  value: string;

  @Column({ type: 'enum', enum: AliasStatus, default: AliasStatus.ACTIVE })
  status: AliasStatus;

  @Column({ default: true })
  isPrimary: boolean;

  @CreateDateColumn()
  createdAt: Date;
}
/////////////////////////
// FILE: src/admin/admin.module.ts
/////////////////////////
import { Module } from '@nestjs/common';

import { CustomerModule } from 'src/customer/customer.module';
import { KycModule } from 'src/kyc/kyc.module';
import { LoanModule } from 'src/loan/loan.module';
import { AccountsModule } from 'src/accounts/accounts.module';
import { TransactionModule } from 'src/payments/transaction/transaction.module';
import { LedgerModule } from 'src/ledger/ledger.module';

import { AdminCustomerController } from './controllers/admin.customer.controller';
import { AdminKycController } from './controllers/admin.kyc.controller';
import { AdminTransactionController } from './controllers/admin.transaction.controller';
import { AdminLoanController } from './controllers/admin.loan.controller';
import { AdminAccountController } from './controllers/admin.account.controller';

@Module({
  imports: [
    CustomerModule,
    KycModule,
    LoanModule,
    AccountsModule,
    TransactionModule,
    LedgerModule,
  ],
  controllers: [
    AdminCustomerController,
    AdminKycController,
    AdminTransactionController,
    AdminLoanController,
    AdminAccountController,
  ],
})
export class AdminModule {}

/////////////////////////
// FILE: src/admin/controllers/admin.account.controller.ts
/////////////////////////
import { Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { AccountsService } from 'src/accounts/accounts.service';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { Roles } from 'src/common/decorators/auth/roles.decorator';
import { Participant } from 'src/common/decorators/participant/participant.decorator';
import { Role } from 'src/common/enums/auth.enums';
import { RolesGuard } from 'src/common/guards/auth/roles.guard';
import { AccountStatus } from 'src/accounts/enums/account.enum';

@Controller('/api/admin/accounts')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class AdminAccountController {
  constructor(private readonly accountsService: AccountsService) {}

  @Get(':accountId')
  get(@Param('accountId') id: string, @Participant() participantId: string) {
    return this.accountsService.findById(id, participantId);
  }

  @Patch(':accountId/freeze')
  freeze(@Param('accountId') id: string, @Participant() participantId: string) {
    return this.accountsService.updateStatus(
      id,
      participantId,
      AccountStatus.BLOCKED,
    );
  }

  @Patch(':accountId/unfreeze')
  unfreeze(
    @Param('accountId') id: string,
    @Participant() participantId: string,
  ) {
    return this.accountsService.updateStatus(
      id,
      participantId,
      AccountStatus.ACTIVE,
    );
  }
}

/////////////////////////
// FILE: src/admin/controllers/admin.customer.controller.ts
/////////////////////////
import { Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { Roles } from 'src/common/decorators/auth/roles.decorator';
import { Participant } from 'src/common/decorators/participant/participant.decorator';
import { Role } from 'src/common/enums/auth.enums';
import { RolesGuard } from 'src/common/guards/auth/roles.guard';
import { CustomerService } from 'src/customer/customer.service';
import { CustomerStatus } from 'src/common/enums/customer.enums';

@Controller('/api/admin/customers')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class AdminCustomerController {
  constructor(private readonly customerService: CustomerService) {}

  @Get()
  findAll(@Participant() participantId: string) {
    return this.customerService.findAll(participantId);
  }

  @Get(':customerId')
  findOne(
    @Param('customerId') id: string,
    @Participant() participantId: string,
  ) {
    return this.customerService.findOne(id, participantId);
  }

  @Patch(':customerId/block')
  async block(
    @Param('customerId') id: string,
    @Participant() participantId: string,
  ) {
    const customer = await this.customerService.findOne(id, participantId);
    customer.status = CustomerStatus.BLOCKED;
    return this.customerService.updateStatus(customer);
  }

  @Patch(':customerId/unblock')
  async unblock(
    @Param('customerId') id: string,
    @Participant() participantId: string,
  ) {
    const customer = await this.customerService.findOne(id, participantId);
    customer.status = CustomerStatus.BLOCKED;
    return this.customerService.updateStatus(customer);
  }
}

/////////////////////////
// FILE: src/admin/controllers/admin.kyc.controller.ts
/////////////////////////
import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { Roles } from 'src/common/decorators/auth/roles.decorator';
import { Participant } from 'src/common/decorators/participant/participant.decorator';
import { Role } from 'src/common/enums/auth.enums';
import { RolesGuard } from 'src/common/guards/auth/roles.guard';
import { RejectKycDto } from 'src/kyc/dto/review-kyc.dto';
import { KycService } from 'src/kyc/kyc.service';

@Controller('/api/admin/kyc')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class AdminKycController {
  constructor(private readonly kycService: KycService) {}

  @Get('/pending')
  getPending(@Participant() participantId: string) {
    return this.kycService.getPendingReviews(participantId);
  }

  @Get(':kycId')
  getOne(@Param('kycId') kycId: string) {
    return this.kycService.getRecord(kycId);
  }

  @Post(':kycId/approve')
  approve(@Param('kycId') kycId: string, @Participant() participantId: string) {
    return this.kycService.approveHard(kycId, participantId);
  }

  @Post(':kycId/reject')
  reject(
    @Param('kycId') kycId: string,
    @Participant() adminId: string,
    @Body() dto: RejectKycDto,
  ) {
    return this.kycService.rejectHard(kycId, adminId, dto);
  }
}

/////////////////////////
// FILE: src/admin/controllers/admin.loan.controller.ts
/////////////////////////
import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { Roles } from 'src/common/decorators/auth/roles.decorator';
import { Participant } from 'src/common/decorators/participant/participant.decorator';
import { Role } from 'src/common/enums/auth.enums';
import { LoanStatus } from 'src/common/enums/loan.enums';
import { RolesGuard } from 'src/common/guards/auth/roles.guard';
import { ApproveLoanDto, RejectLoanDto } from 'src/loan/dto/approve-loan.dto';
import { LoanService } from 'src/loan/loan.service';

@Controller('/api/admin/loans')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.LOAN_OFFICER)
export class AdminLoanController {
  constructor(private readonly loanService: LoanService) {}

  @Get('/pending')
  getPending(
    @Participant() participantId: string,
    @Query('status') status?: LoanStatus,
  ) {
    return this.loanService.getAllLoans(status, participantId);
  }

  @Post(':loanId/approve')
  approve(
    @Param('loanId') loanId: string,
    @Participant() participantId: string,
    @Body() dto: ApproveLoanDto,
  ) {
    return this.loanService.approveLoan(loanId, participantId, dto);
  }

  @Post(':loanId/reject')
  reject(
    @Param('loanId') loanId: string,
    @Participant() participantId: string,
    @Body() dto: RejectLoanDto,
  ) {
    return this.loanService.rejectLoan(loanId, participantId, dto);
  }
}

/////////////////////////
// FILE: src/admin/controllers/admin.transaction.controller.ts
/////////////////////////
import {
  BadRequestException,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { Roles } from 'src/common/decorators/auth/roles.decorator';
import { Participant } from 'src/common/decorators/participant/participant.decorator';
import { Role } from 'src/common/enums/auth.enums';
import { TransactionStatus } from 'src/common/enums/transaction.enums';
import { RolesGuard } from 'src/common/guards/auth/roles.guard';
import { LedgerService } from 'src/ledger/ledger.service';
import { Transaction } from 'src/payments/transaction/entities/transaction.entity';
import { TransactionService } from 'src/payments/transaction/transaction.service';
import { DataSource } from 'typeorm';

@Controller('/api/admin/transactions')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class AdminTransactionController {
  constructor(
    private readonly txService: TransactionService,
    private readonly ledger: LedgerService,
    private readonly dataSource: DataSource,
  ) {}

  @Get()
  findAll(@Participant() participantId: string) {
    return this.txService.findAll({ participantId });
  }

  @Get(':txId')
  findOne(@Param('txId') txId: string, @Participant() participantId: string) {
    return this.txService.findOne(participantId, txId);
  }

  // 🔴 REVERSAL
  @Post(':txId/reverse')
  async reverse(
    @Param('txId') txId: string,
    @Participant() participantId: string,
  ) {
    return this.dataSource.transaction(async (manager) => {
      const tx = await manager.getRepository(Transaction).findOne({
        where: { txId, participantId },
      });

      if (!tx) throw new NotFoundException('Transaction not found');

      if (tx.status !== TransactionStatus.COMPLETED) {
        throw new BadRequestException('Only completed tx can be reversed');
      }

      const reverseTxId = `REV-${tx.txId}`;

      await this.ledger.postTransfer(
        {
          txId: reverseTxId,
          participantId,
          reference: `Reversal of ${tx.txId}`,
          postedBy: 'admin',
          currency: tx.currency,
          legs: [
            {
              finAddress: tx.receiverFinAddress,
              amount: tx.amount.toString(),
              isCredit: false,
            },
            {
              finAddress: tx.senderFinAddress,
              amount: tx.amount.toString(),
              isCredit: true,
            },
          ],
        },
        manager,
      );

      tx.status = TransactionStatus.REVERSED;
      await manager.save(tx);

      return { status: 'reversed', txId: reverseTxId };
    });
  }
}

/////////////////////////
// FILE: src/wallet/wallet.controller.ts
/////////////////////////
import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { Participant } from 'src/common/decorators/participant/participant.decorator';
import { WalletService } from './wallet.service';
import { CreateWalletDto } from './dto/create-wallet.dto';
import { FundWalletDto } from './dto/fund-wallet.dto';
import { WithdrawWalletDto } from './dto/withdraw-wallet.dto';
import { TransferWalletDto } from './dto/transfer-wallet.dto';
import { UpdateWalletStatusDto } from './dto/update-wallet-status.dto';

@UseGuards(JwtAuthGuard)
@Controller('/api/fp/wallet')
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  @Post()
  create(@Body() dto: CreateWalletDto, @Participant() participantId: string) {
    return this.walletService.createWallet(dto, participantId);
  }

  @Get(':walletId/balance')
  getBalance(
    @Param('walletId') walletId: string,
    @Participant() participantId: string,
  ) {
    return this.walletService.getBalance(walletId, participantId);
  }

  @Get(':walletId/history')
  getHistory(
    @Param('walletId') walletId: string,
    @Participant() participantId: string,
  ) {
    return this.walletService.getHistory(walletId, participantId);
  }

  @Post('fund')
  fund(@Body() dto: FundWalletDto, @Participant() participantId: string) {
    return this.walletService.fundWallet(dto, participantId);
  }

  @Post('withdraw')
  withdraw(
    @Body() dto: WithdrawWalletDto,
    @Participant() participantId: string,
  ) {
    return this.walletService.withdrawWallet(dto, participantId);
  }

  @Post('transfer')
  transfer(
    @Body() dto: TransferWalletDto,
    @Participant() participantId: string,
  ) {
    return this.walletService.transferWallet(dto, participantId);
  }

  @Patch(':walletId/status')
  updateStatus(
    @Param('walletId') walletId: string,
    @Body() dto: UpdateWalletStatusDto,
    @Participant() participantId: string,
  ) {
    return this.walletService.updateWalletStatus(
      walletId,
      participantId,
      dto.status,
    );
  }
}

/////////////////////////
// FILE: src/wallet/wallet.module.ts
/////////////////////////
import { Module, forwardRef } from '@nestjs/common';
import { WalletService } from './wallet.service';
import { WalletController } from './wallet.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Wallet } from './entities/wallet.entity';
import { Transaction } from 'src/payments/transaction/entities/transaction.entity';
import { AccountsModule } from 'src/accounts/accounts.module';
import { CustomerModule } from 'src/customer/customer.module';
import { WalletLimit } from './entities/wallet-limit.entity';
import { LedgerModule } from 'src/ledger/ledger.module';
import { KycModule } from 'src/kyc/kyc.module';
import { ComplianceModule } from 'src/compliance/compliance.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Wallet, Transaction, WalletLimit]),
    AccountsModule,
    LedgerModule,
    KycModule,
    ComplianceModule,
    forwardRef(() => CustomerModule),
  ],
  providers: [WalletService],
  controllers: [WalletController],
  exports: [WalletService],
})
export class WalletModule {}

/////////////////////////
// FILE: src/wallet/wallet.service.ts
/////////////////////////
import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import Decimal from 'decimal.js';
import * as crypto from 'crypto';

import { Wallet } from './entities/wallet.entity';
import { WalletLimit } from './entities/wallet-limit.entity';
import { Transaction } from 'src/payments/transaction/entities/transaction.entity';

import {
  TransactionType,
  TransactionStatus,
  Currency,
} from 'src/common/enums/transaction.enums';
import { WalletStatus } from 'src/common/enums/banking.enums';
import { AccountType } from 'src/accounts/enums/account.enum';

import { FundWalletDto } from './dto/fund-wallet.dto';
import { WithdrawWalletDto } from './dto/withdraw-wallet.dto';
import { TransferWalletDto } from './dto/transfer-wallet.dto';
import { CreateWalletDto } from './dto/create-wallet.dto';

import { AccountsService } from 'src/accounts/accounts.service';
import { CustomerService } from 'src/customer/customer.service';
import { LedgerService } from 'src/ledger/ledger.service';
import { KycService } from 'src/kyc/kyc.service';
import { KycTier } from 'src/common/enums/kyc.enums';
import { SYSTEM_POOL } from 'src/common/constants';
import { CreateAccountDto } from 'src/accounts/dto/create-account.dto';
import { ComplianceService } from 'src/compliance/compliance.service';
import { ComplianceTxnType } from 'src/compliance/enums/compliance.enum';
import { TransactionService } from 'src/payments/transaction/transaction.service';
@Injectable()
export class WalletService {
  private readonly SYSTEM_POOL_FIN = SYSTEM_POOL;

  constructor(
    @InjectRepository(Wallet)
    private readonly walletRepo: Repository<Wallet>,

    @InjectRepository(WalletLimit)
    private readonly walletLimitRepo: Repository<WalletLimit>,

    @InjectRepository(Transaction)
    private readonly txRepo: Repository<Transaction>,

    @Inject(forwardRef(() => CustomerService))
    private readonly customerService: CustomerService,

    private readonly accountsService: AccountsService,
    private readonly ledgerService: LedgerService,
    private readonly kycService: KycService,
    private readonly dataSource: DataSource,
    private readonly complianceService: ComplianceService,
    private readonly transactionService: TransactionService,
  ) {
    Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });
  }

  async createWallet(
    dto: CreateWalletDto,
    participantId: string,
    manager?: EntityManager,
  ): Promise<Wallet> {
    const run = async (txManager: EntityManager): Promise<Wallet> => {
      const walletRepository = txManager.getRepository(Wallet);
      const walletLimitRepository = txManager.getRepository(WalletLimit);

      const existing = await walletRepository.findOne({
        where: { customerId: dto.customerId, participantId },
      });

      if (existing) {
        return existing;
      }

      const finAddress = dto.finAddress?.trim() || `wallet.${dto.customerId}`;

      const wallet = walletRepository.create({
        customerId: dto.customerId,
        participantId,
        finAddress,
        accountId: undefined,
        currency: Currency.SLE,
        pinAttempts: 0,
        status: WalletStatus.ACTIVE,
      } as Partial<Wallet>);

      const savedWallet = await walletRepository.save(wallet);

      const walletAccount = await this.accountsService.createWalletAccount(
        {
          customerId: dto.customerId,
          walletId: savedWallet.walletId,
          participantId,
          currency: Currency.SLE,
          type: AccountType.WALLET,
          finAddress,
          metadata: {
            walletId: savedWallet.walletId,
            customerId: dto.customerId,
          },
        } as CreateAccountDto,
        txManager,
      );

      savedWallet.accountId = walletAccount.accountId;
      await walletRepository.save(savedWallet);

      await walletLimitRepository.save(
        walletLimitRepository.create({
          walletId: savedWallet.walletId,
          dailySendLimit: '10000.00',
          dailyReceiveLimit: '10000.00',
          singleTxLimit: '5000.00',
        }),
      );

      return savedWallet;
    };

    if (manager) {
      return run(manager);
    }

    return this.dataSource.transaction(run);
  }

  async findByCustomer(
    customerId: string,
    participantId: string,
  ): Promise<Wallet> {
    const wallet = await this.walletRepo.findOne({
      where: { customerId, participantId },
    });

    if (!wallet) {
      throw new NotFoundException(
        `Wallet for customer ${customerId} not found`,
      );
    }

    if (wallet.status !== WalletStatus.ACTIVE) {
      throw new BadRequestException(
        `Wallet is ${wallet.status.toLowerCase()}. Only ACTIVE wallets can be used.`,
      );
    }

    return wallet;
  }

  async getWallet(
    walletId: string,
    participantId: string,
  ): Promise<Wallet | null> {
    return this.walletRepo.findOne({
      where: { walletId, participantId },
    });
  }

  async findByFinAddress(
    finAddress: string,
    participantId?: string,
  ): Promise<Wallet | null> {
    return this.walletRepo.findOne({
      where: participantId ? { finAddress, participantId } : { finAddress },
    });
  }

  async getWalletByFinAddress(
    finAddress: string,
    participantId?: string,
  ): Promise<Wallet> {
    const wallet = await this.findByFinAddress(finAddress, participantId);

    if (!wallet) {
      throw new NotFoundException('Receiver wallet not found');
    }

    if (wallet.status !== WalletStatus.ACTIVE) {
      throw new BadRequestException('Receiver wallet not active');
    }

    return wallet;
  }

  async getBalance(walletId: string, participantId: string) {
    const wallet = await this.validateActiveWallet(walletId, participantId);

    const account = await this.resolveWalletAccount(wallet);

    const balance = await this.ledgerService.getDerivedBalance(
      account.finAddress,
      participantId,
    );

    return {
      walletId: wallet.walletId,
      accountId: wallet.accountId,
      customerId: wallet.customerId,
      balance,
      currency: wallet.currency,
      status: wallet.status,
    };
  }

  async getHistory(walletId: string, participantId: string) {
    const wallet = await this.validateActiveWallet(walletId, participantId);

    return this.txRepo.find({
      where: [
        { senderFinAddress: wallet.finAddress, participantId },
        { receiverFinAddress: wallet.finAddress, participantId },
      ],
      order: { createdAt: 'DESC' },
      take: 50,
    });
  }

  async fundWallet(dto: FundWalletDto, participantId: string) {
    if (dto.idempotencyKey) {
      const existing = await this.transactionService.findByExternalId(
        dto.idempotencyKey,
        participantId,
      );
      if (existing) return existing;
    }

    const wallet = await this.validateActiveWallet(dto.walletId, participantId);
    const walletAccount = await this.resolveWalletAccount(wallet);

    let tx = await this.transactionService.createTx(null, {
      participantId,
      channel: TransactionType.CREDIT_TRANSFER,
      customerId: wallet.customerId,
      senderFinAddress: dto.sourceFinAddress || this.SYSTEM_POOL_FIN,
      receiverFinAddress: walletAccount.finAddress,
      amount: Number(dto.amount),
      currency: wallet.currency,
      status: TransactionStatus.INITIATED,
      externalId: dto.idempotencyKey,
      reference: 'Wallet Funding',
    });

    await this.kycService.requireTier(
      wallet.customerId,
      participantId,
      KycTier.SOFT_APPROVED,
    );
    await this.verifyPinWithLock(wallet, participantId, dto.pin);

    const amount = new Decimal(dto.amount);
    if (amount.isNaN() || amount.lte(0)) {
      throw new BadRequestException('Invalid amount');
    }

    const amountStr = amount.toFixed(2);
    const sourceFinAddress =
      dto.sourceFinAddress?.trim() || this.SYSTEM_POOL_FIN;
    const txId = tx.txId;

    return this.dataSource.transaction('SERIALIZABLE', async (manager) => {
      await this.accountsService.assertFinAddressActive(
        sourceFinAddress,
        manager,
      );
      await this.accountsService.assertFinAddressActive(
        walletAccount.finAddress,
        manager,
      );

      tx = await this.transactionService.updateTx(
        manager,
        tx.txId,
        participantId,
        {
          status: TransactionStatus.PROCESSING,
        },
      );

      let transferResult;
      try {
        transferResult = await this.ledgerService.postTransfer(
          {
            txId,
            idempotencyKey: dto.idempotencyKey,
            reference: `Wallet funding ${wallet.walletId}`,
            participantId,
            postedBy: 'wallet-service',
            currency: wallet.currency,
            legs: [
              {
                finAddress: sourceFinAddress,
                amount: amountStr,
                isCredit: false,
                memo: `Wallet funding source -> ${wallet.finAddress}`,
              },
              {
                finAddress: walletAccount.finAddress,
                amount: amountStr,
                isCredit: true,
                memo: `Wallet funded from ${sourceFinAddress}`,
              },
            ],
          },
          manager,
        );
      } catch (err) {
        await this.transactionService.updateTx(manager, tx.txId, {
          status: TransactionStatus.FAILED,
          failureReason: err.message,
        });
        throw err;
      }

      if (transferResult.status === 'already_processed') {
        const newBalance = await this.ledgerService.getDerivedBalance(
          wallet.finAddress,
          participantId,
        );
        return {
          status: 'success',
          journalId: transferResult.journalId,
          txId: transferResult.txId,
          newBalance,
        };
      }

      const newBalance = await this.ledgerService.getDerivedBalance(
        wallet.finAddress,
        participantId,
      );

      await this.transactionService.updateTx(manager, tx.txId, {
        status: TransactionStatus.COMPLETED,
        journalId: transferResult.journalId,
        processedAt: new Date(),
      });

      return {
        status: 'success',
        journalId: transferResult.journalId,
        txId,
        newBalance,
      };
    });
  }

  async withdrawWallet(dto: WithdrawWalletDto, participantId: string) {
    if (dto.idempotencyKey) {
      const existing = await this.transactionService.findByExternalId(
        dto.idempotencyKey,
      );
      if (existing) return existing;
    }

    const wallet = await this.validateActiveWallet(dto.walletId, participantId);
    const walletAccount = await this.resolveWalletAccount(wallet);

    let tx = await this.transactionService.createTx(null, {
      participantId,
      channel: TransactionType.CREDIT_TRANSFER,
      customerId: wallet.customerId,
      senderFinAddress: dto.sourceFinAddress || this.SYSTEM_POOL_FIN,
      receiverFinAddress: walletAccount.finAddress,
      amount: Number(dto.amount),
      currency: wallet.currency,
      status: TransactionStatus.INITIATED,
      externalId: dto.idempotencyKey,
      reference: 'Wallet Funding',
    });

    await this.kycService.requireTier(
      wallet.customerId,
      participantId,
      KycTier.HARD_APPROVED,
    );
    await this.verifyPinWithLock(wallet, participantId, dto.pin);

    const amount = new Decimal(dto.amount);
    if (amount.isNaN() || amount.lte(0)) {
      throw new BadRequestException('Invalid amount');
    }

    const amountStr = amount.toFixed(2);
    const destinationFinAddress =
      dto.destinationFinAddress?.trim() || this.SYSTEM_POOL_FIN;
    const txId = tx.txId;

    return this.dataSource.transaction('SERIALIZABLE', async (manager) => {
      await this.accountsService.assertFinAddressActive(
        walletAccount.finAddress,
        manager,
      );
      await this.accountsService.assertFinAddressActive(
        destinationFinAddress,
        manager,
        participantId,
      );

      tx = await this.transactionService.updateTx(manager, tx.txId, {
        status: TransactionStatus.PROCESSING,
      });

      let transferResult;
      try {
        transferResult = await this.ledgerService.postTransfer(
          {
            txId,
            idempotencyKey: dto.idempotencyKey,
            reference: `Wallet withdrawal ${wallet.walletId}`,
            participantId,
            postedBy: 'wallet-service',
            currency: wallet.currency,
            legs: [
              {
                finAddress: walletAccount.finAddress,
                amount: amountStr,
                isCredit: false,
                memo: `Wallet withdrawal -> ${destinationFinAddress}`,
              },
              {
                finAddress: destinationFinAddress,
                amount: amountStr,
                isCredit: true,
                memo: `Wallet withdrawal from ${wallet.finAddress}`,
              },
            ],
          },
          manager,
        );
      } catch (err) {
        await this.transactionService.updateTx(manager, tx.txId, {
          status: TransactionStatus.FAILED,
          failureReason: err.message,
        });
        throw err;
      }

      if (transferResult.status === 'already_processed') {
        const newBalance = await this.ledgerService.getDerivedBalance(
          wallet.finAddress,
          participantId,
        );
        return {
          status: 'success',
          journalId: transferResult.journalId,
          txId: transferResult.txId,
          newBalance,
        };
      }

      await manager.getRepository(Transaction).save(
        manager.getRepository(Transaction).create({
          participantId,
          channel: TransactionType.CREDIT_TRANSFER,
          senderAlias: wallet.customerId,
          receiverAlias: destinationFinAddress,
          senderFinAddress: wallet.finAddress,
          receiverFinAddress: destinationFinAddress,
          amount: Number(amountStr),
          currency: wallet.currency,
          status: TransactionStatus.COMPLETED,
          reference: `Wallet Withdrawal ${txId}`,
        }),
      );

      const newBalance = await this.ledgerService.getDerivedBalance(
        wallet.finAddress,
        participantId,
      );

      await this.transactionService.updateTx(manager, tx.txId, {
        status: TransactionStatus.COMPLETED,
        journalId: transferResult.journalId,
        processedAt: new Date(),
      });

      return {
        status: 'success',
        journalId: transferResult.journalId,
        txId,
        newBalance,
      };
    });
  }

  async transferWallet(dto: TransferWalletDto, participantId: string) {
    if (dto.idempotencyKey) {
      const existing = await this.transactionService.findByExternalId(
        dto.idempotencyKey,
      );
      if (existing) return existing;
    }

    const sender = await this.validateActiveWallet(
      dto.senderWalletId,
      participantId,
    );

    await this.complianceService.validate(
      {
        customerId: sender.customerId,
        type: ComplianceTxnType.TRANSFER,
        amount: dto.amount,
        currency: sender.currency,
      },
      participantId,
    );
    const receiver = await this.getWalletByFinAddress(dto.receiverFinAddress);

    const senderAccount = await this.resolveWalletAccount(sender);
    const receiverAccount = await this.resolveWalletAccount(receiver);

    await this.verifyPinWithLock(sender, participantId, dto.pin);

    if (sender.walletId === receiver.walletId) {
      throw new BadRequestException('Cannot send to yourself');
    }

    const amount = new Decimal(dto.amount);
    if (amount.isNaN() || amount.lte(0)) {
      throw new BadRequestException('Invalid amount');
    }

    if (amount.gt(5000)) {
      await this.kycService.requireTier(
        sender.customerId,
        participantId,
        KycTier.HARD_APPROVED,
      );
    } else {
      await this.kycService.requireTier(
        sender.customerId,
        participantId,
        KycTier.SOFT_APPROVED,
      );
    }

    const amountStr = amount.toFixed(2);

    let tx = await this.transactionService.createTx(null, {
      participantId,
      channel: TransactionType.CREDIT_TRANSFER,

      customerId: sender.customerId,

      senderAlias: sender.customerId,
      receiverAlias: receiver.customerId,

      senderFinAddress: senderAccount.finAddress,
      receiverFinAddress: receiverAccount.finAddress,

      sourceType: 'WALLET',
      sourceWalletId: sender.walletId,

      destinationType: 'WALLET',
      destinationWalletId: receiver.walletId,

      amount: Number(amountStr),
      currency: sender.currency,

      status: TransactionStatus.INITIATED,
      externalId: dto.idempotencyKey,
      reference: 'Wallet Transfer',
    });

    const txId = tx.txId;

    return this.dataSource.transaction('SERIALIZABLE', async (manager) => {
      tx = await this.transactionService.updateTx(manager, tx.txId, {
        status: TransactionStatus.PROCESSING,
      });

      await this.accountsService.assertFinAddressActive(
        senderAccount.finAddress,
        manager,
      );
      await this.accountsService.assertFinAddressActive(
        receiverAccount.finAddress,
        manager,
      );

      const senderLimit = await manager.getRepository(WalletLimit).findOne({
        where: { walletId: sender.walletId },
      });

      if (senderLimit) {
        const dailySent = await this.calculateDailySent(
          manager,
          senderAccount.finAddress,
        );
        const newDailySent = new Decimal(dailySent).add(amount);

        if (newDailySent.gt(senderLimit.dailySendLimit)) {
          throw new BadRequestException('Daily send limit exceeded');
        }

        if (amount.gt(senderLimit.singleTxLimit)) {
          throw new BadRequestException(
            'Amount exceeds single transaction limit',
          );
        }
      }

      const receiverLimit = await manager.getRepository(WalletLimit).findOne({
        where: { walletId: receiver.walletId },
      });

      if (receiverLimit) {
        const dailyReceived = await this.calculateDailyReceived(
          manager,
          receiver.finAddress,
        );
        const newDailyReceived = new Decimal(dailyReceived).add(amount);

        if (newDailyReceived.gt(receiverLimit.dailyReceiveLimit)) {
          throw new BadRequestException(
            'Receiver daily receive limit exceeded',
          );
        }
      }

      let transferResult;
      try {
        transferResult = await this.ledgerService.postTransfer(
          {
            txId,
            idempotencyKey: dto.idempotencyKey,
            reference: `Wallet to wallet ${txId}`,
            participantId,
            postedBy: 'wallet-service',
            currency: sender.currency,
            legs: [
              {
                finAddress: senderAccount.finAddress,
                amount: amountStr,
                isCredit: false,
                memo: `Wallet transfer to ${receiver.finAddress}`,
              },
              {
                finAddress: receiverAccount.finAddress,
                amount: amountStr,
                isCredit: true,
                memo: `Wallet transfer from ${sender.finAddress}`,
              },
            ],
          },
          manager,
        );
      } catch (err) {
        await this.transactionService.updateTx(manager, tx.txId, {
          status: TransactionStatus.FAILED,
          failureReason: err?.message || 'TRANSFER_FAILED',
        });
        throw err;
      }

      if (transferResult.status === 'already_processed') {
        const senderNewBalance = await this.ledgerService.getDerivedBalance(
          senderAccount.finAddress,
          participantId,
        );

        return {
          status: 'success',
          journalId: transferResult.journalId,
          txId: transferResult.txId,
          senderNewBalance,
        };
      }

      await this.transactionService.updateTx(manager, tx.txId, {
        status: TransactionStatus.COMPLETED,
        journalId: transferResult.journalId,
        processedAt: new Date(),
      });

      const senderNewBalance = await this.ledgerService.getDerivedBalance(
        senderAccount.finAddress,
        participantId,
      );

      return {
        status: 'success',
        journalId: transferResult.journalId,
        txId,
        senderNewBalance,
      };
    });
  }

  async updateWalletStatus(
    walletId: string,
    participantId: string,
    status: WalletStatus,
  ): Promise<Wallet> {
    const wallet = await this.walletRepo.findOne({
      where: { walletId, participantId },
    });

    if (!wallet) {
      throw new NotFoundException('Wallet not found');
    }

    wallet.status = status;
    return this.walletRepo.save(wallet);
  }

  async verifyPinWithLock(
    wallet: Wallet,
    participantId: string,
    pin: string,
  ): Promise<void> {
    await this.dataSource.transaction(async (manager: EntityManager) => {
      const lockedWallet = await manager
        .createQueryBuilder(Wallet, 'wallet')
        .where('wallet.walletId = :walletId', {
          walletId: wallet.walletId,
        })
        .andWhere('wallet.participantId = :participantId', {
          participantId,
        })
        .setLock('pessimistic_write')
        .getOne();

      if (!lockedWallet) {
        throw new NotFoundException('Wallet not found');
      }

      if (lockedWallet.status === WalletStatus.LOCKED) {
        throw new BadRequestException(
          'Wallet is locked. Contact support to unlock.',
        );
      }

      let pinValid = false;

      try {
        await this.customerService.verifyPin(
          lockedWallet.customerId,
          participantId,
          pin,
        );
        pinValid = true;
      } catch {
        lockedWallet.pinAttempts = (lockedWallet.pinAttempts ?? 0) + 1;

        if (lockedWallet.pinAttempts >= 3) {
          lockedWallet.status = WalletStatus.LOCKED;
        }

        await manager.save(lockedWallet);

        throw new BadRequestException(
          `Invalid PIN. Attempt ${lockedWallet.pinAttempts}/3${
            lockedWallet.status === WalletStatus.LOCKED
              ? '. Wallet locked.'
              : ''
          }`,
        );
      }

      if (pinValid) {
        if (lockedWallet.pinAttempts !== 0) {
          lockedWallet.pinAttempts = 0;
          await manager.save(lockedWallet);
        }
      }
    });
  }

  private async validateActiveWallet(
    walletId: string,
    participantId: string,
  ): Promise<Wallet> {
    const wallet = await this.walletRepo.findOne({
      where: { walletId, participantId },
    });

    if (!wallet) {
      throw new NotFoundException('Wallet not found');
    }

    if (wallet.status !== WalletStatus.ACTIVE) {
      throw new BadRequestException(
        `Wallet is ${wallet.status.toLowerCase()}. Only ACTIVE wallets can perform operations.`,
      );
    }

    return wallet;
  }

  private async resolveWalletAccount(wallet: Wallet, manager?: EntityManager) {
    if (!wallet.accountId)
      throw new NotFoundException('Wallet account missing');
    return this.accountsService.findById(wallet.accountId, manager);
  }

  private async calculateDailySent(
    manager: EntityManager,
    finAddress: string,
  ): Promise<string> {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const result = await manager
      .getRepository(Transaction)
      .createQueryBuilder('tx')
      .select('COALESCE(SUM(tx.amount), 0)', 'total')
      .where('tx.senderFinAddress = :finAddress', { finAddress })
      .andWhere('tx.status = :status', { status: TransactionStatus.COMPLETED })
      .andWhere('tx.createdAt >= :startOfDay', { startOfDay })
      .getRawOne<{ total: string }>();

    return result?.total ?? '0';
  }

  private async calculateDailyReceived(
    manager: EntityManager,
    finAddress: string,
  ): Promise<string> {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const result = await manager
      .getRepository(Transaction)
      .createQueryBuilder('tx')
      .select('COALESCE(SUM(tx.amount), 0)', 'total')
      .where('tx.receiverFinAddress = :finAddress', { finAddress })
      .andWhere('tx.status = :status', { status: TransactionStatus.COMPLETED })
      .andWhere('tx.createdAt >= :startOfDay', { startOfDay })
      .getRawOne<{ total: string }>();

    return result?.total ?? '0';
  }
}

/////////////////////////
// FILE: src/wallet/enums/wallet-status.enums.ts
/////////////////////////
export enum WalletStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  BLOCKED = 'BLOCKED',
}

/////////////////////////
// FILE: src/wallet/dto/create-wallet.dto.ts
/////////////////////////
import { IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateWalletDto {
  @IsUUID()
  customerId: string;

  @IsOptional()
  @IsString()
  finAddress?: string;
}

/////////////////////////
// FILE: src/wallet/dto/fund-wallet.dto.ts
/////////////////////////
import { IsOptional, IsString, Length, Matches } from 'class-validator';

export class FundWalletDto {
  @IsString()
  walletId: string;

  @IsString()
  @Matches(/^\d+(\.\d{1,2})?$/)
  amount: string;

  @IsString()
  @Length(6, 6)
  @Matches(/^\d{6}$/)
  pin: string;

  @IsOptional()
  @IsString()
  sourceFinAddress?: string;

  @IsOptional()
  @IsString()
  idempotencyKey?: string;
}

/////////////////////////
// FILE: src/wallet/dto/transfer-wallet.dto.ts
/////////////////////////
import {
  IsOptional,
  IsString,
  Length,
  Matches,
  IsNotEmpty,
} from 'class-validator';

export class TransferWalletDto {
  @IsString()
  @IsNotEmpty()
  senderWalletId: string;

  @IsString()
  @IsNotEmpty()
  receiverFinAddress: string;

  @IsString()
  @Matches(/^\d+(\.\d{1,2})?$/, {
    message: 'amount must be a positive number with up to 2 decimal places',
  })
  amount: string;

  @IsString()
  @Length(6, 6)
  @Matches(/^\d{6}$/)
  pin: string;

  @IsString()
  @IsOptional()
  idempotencyKey?: string;
}

/////////////////////////
// FILE: src/wallet/dto/update-wallet-status.dto.ts
/////////////////////////
import { IsEnum } from 'class-validator';
import { WalletStatus } from 'src/common/enums/banking.enums';

export class UpdateWalletStatusDto {
  @IsEnum(WalletStatus)
  status: WalletStatus;
}

/////////////////////////
// FILE: src/wallet/dto/withdraw-wallet.dto.ts
/////////////////////////
import { IsOptional, IsString, Length, Matches } from 'class-validator';

export class WithdrawWalletDto {
  @IsString()
  walletId: string;

  @IsString()
  @Matches(/^\d+(\.\d{1,2})?$/)
  amount: string;

  @IsString()
  @Length(6, 6)
  @Matches(/^\d{6}$/)
  pin: string;

  @IsOptional()
  @IsString()
  destinationFinAddress?: string;

  @IsOptional()
  @IsString()
  idempotencyKey?: string;
}

/////////////////////////
// FILE: src/wallet/entities/wallet-limit.entity.ts
/////////////////////////
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('wallet_limits')
@Index(['walletId'], { unique: true })
export class WalletLimit {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  walletId: string;

  @Column({ type: 'decimal', precision: 18, scale: 2, default: '0' })
  dailySendLimit: string;

  @Column({ type: 'decimal', precision: 18, scale: 2, default: '0' })
  dailyReceiveLimit: string;

  @Column({ type: 'decimal', precision: 18, scale: 2, default: '0' })
  singleTxLimit: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

/////////////////////////
// FILE: src/wallet/entities/wallet.entity.ts
/////////////////////////
import { WalletStatus } from 'src/common/enums/banking.enums';
import { Currency } from 'src/common/enums/transaction.enums';
import { Account } from 'src/accounts/entities/account.entity';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  OneToOne,
  JoinColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('wallets')
@Index(['finAddress'], { unique: true })
@Index(['participantId'])
@Index(['customerId'], { unique: true })
export class Wallet {
  @PrimaryGeneratedColumn('uuid')
  walletId: string;

  @Column({ type: 'uuid' })
  customerId: string;

  @Column({ type: 'varchar', length: 100 })
  participantId: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  finAddress: string;

  @Column({ type: 'uuid', nullable: true })
  accountId: string;

  @Column({
    type: 'enum',
    enum: Currency,
    default: Currency.SLE,
  })
  currency: Currency;

  @Column({ type: 'int', default: 0 })
  pinAttempts: number;

  @Column({
    type: 'enum',
    enum: WalletStatus,
    default: WalletStatus.INACTIVE,
  })
  status: WalletStatus;

  @OneToOne(() => Account, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'accountId' })
  account?: Account | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

/////////////////////////
// FILE: src/settings/settings.controller.ts
/////////////////////////
// src/settings/settings.controller.ts
import { Controller, Get, Put, Body, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/auth/roles.guard';
import { Roles } from 'src/common/decorators/auth/roles.decorator';
import { Role } from 'src/common/enums/auth.enums';
import { SettingsService } from './settings.service';
@Controller('api/settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  // Public endpoint for the Mobile App to fetch global variables on startup
  @Get('public')
  getPublicSettings() {
    return this.settingsService.getPublicSettings();
  }

  // Admin-only endpoint to view all system settings
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Get()
  getAllSettings() {
    return this.settingsService.getAllSettings();
  }

  // Admin-only endpoint to update a setting (e.g., changing 'MAX_DAILY_TRANSFER')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Put(':key')
  async updateSetting(@Param('key') key: string, @Body('value') value: string) {
    const updatedSetting = await this.settingsService.updateSetting(key, value);
    // Refresh the in-memory cache so the backend instantly uses the new value
    await this.settingsService.refreshCache();
    return updatedSetting;
  }
}

/////////////////////////
// FILE: src/settings/settings.module.ts
/////////////////////////
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Setting } from './entities/setting.entity';
import { SettingsService } from './settings.service';
import { SettingsController } from './settings.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Setting])],
  providers: [SettingsService],
  controllers: [SettingsController],
  exports: [SettingsService],
})
export class SettingsModule {}

/////////////////////////
// FILE: src/settings/settings.service.ts
/////////////////////////
import { Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Setting } from './entities/setting.entity';

@Injectable()
export class SettingsService implements OnModuleInit {
  private cache = new Map<string, string>();

  constructor(
    @InjectRepository(Setting)
    private readonly settingsRepository: Repository<Setting>,
  ) {}

  async onModuleInit() {
    await this.refreshCache();
  }

  async refreshCache(): Promise<void> {
    const settings = await this.settingsRepository.find();
    this.cache.clear();

    for (const setting of settings) {
      this.cache.set(setting.key, setting.value);
    }
  }

  async getPublicSettings(): Promise<Record<string, string | null>> {
    const settings = await this.settingsRepository.find({
      where: { isPublic: true },
      order: { key: 'ASC' },
    });

    return settings.reduce(
      (acc, setting) => {
        acc[setting.key] = setting.value;
        return acc;
      },
      {} as Record<string, string | null>,
    );
  }

  async getAllSettings(): Promise<Setting[]> {
    return this.settingsRepository.find({
      order: { key: 'ASC' },
    });
  }

  async getSettingValue(key: string): Promise<string | null> {
    if (this.cache.has(key)) {
      return this.cache.get(key) ?? null;
    }

    const setting = await this.settingsRepository.findOne({
      where: { key },
    });

    if (!setting) {
      return null;
    }

    this.cache.set(setting.key, setting.value);
    return setting.value;
  }

  async updateSetting(key: string, value: string): Promise<Setting> {
    let setting = await this.settingsRepository.findOne({
      where: { key },
    });

    if (!setting) {
      throw new NotFoundException(`Setting not found: ${key}`);
    }

    setting.value = value;
    setting = await this.settingsRepository.save(setting);

    this.cache.set(setting.key, setting.value);
    return setting;
  }

  async createSetting(data: {
    key: string;
    value: string;
    isPublic?: boolean;
    description?: string;
  }): Promise<Setting> {
    const setting = this.settingsRepository.create({
      key: data.key,
      value: data.value,
      isPublic: data.isPublic ?? false,
      description: data.description,
    });

    const saved = await this.settingsRepository.save(setting);
    this.cache.set(saved.key, saved.value);
    return saved;
  }
}

/////////////////////////
// FILE: src/settings/dto/update-setting.dto.ts
/////////////////////////
import { IsNotEmpty, IsString } from 'class-validator';

export class UpdateSettingDto {
  @IsString()
  @IsNotEmpty()
  value: string;
}

/////////////////////////
// FILE: src/settings/entities/setting.entity.ts
/////////////////////////
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('settings')
@Index(['key'], { unique: true })
export class Setting {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  key: string;

  @Column({ type: 'text', nullable: true })
  value: string;

  @Column({ default: false })
  isPublic: boolean;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt: Date;
}

/////////////////////////
// FILE: src/otp/otp.controller.ts
/////////////////////////
import { Controller, Param, UseGuards, Body, Post } from '@nestjs/common';
import { OtpService } from './otp.service';
import { Participant } from 'src/common/decorators/participant/participant.decorator';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('api/fp/customers')
export class OtpController {
  constructor(private readonly otpService: OtpService) {}

  @Post(':customerId/otp')
  generate(
    @Participant() participantId: string,
    @Param('customerId') customerId: string,
  ) {
    return this.otpService.generate(participantId, customerId, 'REGISTER');
  }

  @Post(':customerId/otp/verify')
  verify(
    @Participant() participantId: string,
    @Param('customerId') customerId: string,
    @Body('otp') otp: string,
  ) {
    return this.otpService.verify(participantId, customerId, otp, 'REGISTER');
  }

  @Post(':customerId/otp/complete')
  complete(
    @Participant() participantId: string,
    @Param('customerId') customerId: string,
    @Body('otp') otp: string,
  ) {
    return this.otpService.completeRegistration(participantId, customerId, otp);
  }
}

/////////////////////////
// FILE: src/otp/otp.module.ts
/////////////////////////
import { Module } from '@nestjs/common';
import { OtpService } from './otp.service';
import { OtpController } from './otp.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Otp } from './entities/otp.entity';
import { CustomerModule } from 'src/customer/customer.module';
import { SmsModule } from 'src/common/sms/sms.module';
import { EmailModule } from 'src/common/email/email.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Otp]),
    CustomerModule,
    SmsModule,
    EmailModule,
  ],
  providers: [OtpService],
  controllers: [OtpController],
  exports: [OtpService],
})
export class OtpModule {}

/////////////////////////
// FILE: src/otp/otp.service.ts
/////////////////////////
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Otp } from './entities/otp.entity';
import { LessThan, Repository } from 'typeorm';
import { CustomerService } from 'src/customer/customer.service';
import { CustomerStatus } from 'src/common/enums/customer.enums';
import { CronExpression } from '@nestjs/schedule';
import { Cron } from '@nestjs/schedule';
import * as crypto from 'crypto';
import { NotificationsService } from 'src/notifications/notifications.service';
@Injectable()
export class OtpService {
  private readonly logger = new Logger(OtpService.name);

  constructor(
    @InjectRepository(Otp)
    private readonly otpRepo: Repository<Otp>,

    private readonly customerService: CustomerService,
    private readonly notificationsService: NotificationsService,
  ) {}

  // ================= GENERATE =================
  async generate(
    participantId: string,
    customerId: string,
    purpose: string = 'REGISTER',
  ) {
    const customer = await this.customerService.findOne(
      customerId,
      participantId,
    );

    // RATE LIMIT (1 OTP / 30 sec)
    const lastOtp = await this.otpRepo.findOne({
      where: { customerId, participantId },
      order: { createdAt: 'DESC' },
    });

    if (lastOtp && Date.now() - lastOtp.createdAt.getTime() < 30000) {
      throw new BadRequestException('Too many requests. Try after 30 seconds');
    }

    // delete previous OTPs
    await this.otpRepo.delete({ customerId, participantId });

    const otpCode = crypto.randomInt(100000, 999999).toString();

    const otp = this.otpRepo.create({
      customerId,
      participantId,
      otpCode,
      purpose,
      attempts: 0,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    });

    await this.otpRepo.save(otp);

    // send notification
    if (customer.msisdn) {
      await this.notificationsService.sendSms(
        participantId,
        customer.msisdn,
        `Your OTP is ${otpCode}`,
      );
    }

    if (customer.firstEmail) {
      await this.notificationsService.sendEmail(
        participantId,
        customer.firstEmail,
        'OTP Verification',
        `Your OTP is ${otpCode}`,
      );
    }

    return {
      message: 'OTP sent',
      expiresAt: otp.expiresAt,
    };
  }

  // ================= VERIFY =================
  async verify(
    participantId: string,
    customerId: string,
    otpCode: string,
    purpose: string,
  ) {
    const otp = await this.otpRepo.findOne({
      where: { customerId, participantId, purpose },
    });

    if (!otp) throw new BadRequestException('OTP not found');

    if (otp.expiresAt < new Date()) {
      await this.otpRepo.delete({ otpId: otp.otpId });
      throw new BadRequestException('OTP expired');
    }

    if (otp.attempts >= 5) {
      throw new BadRequestException('Too many attempts');
    }

    if (otp.otpCode !== otpCode) {
      otp.attempts += 1;
      await this.otpRepo.save(otp);
      throw new BadRequestException('Invalid OTP');
    }

    await this.otpRepo.delete({ otpId: otp.otpId });

    return { success: true };
  }

  // ================= COMPLETE (ACTIVATE) =================
  async completeRegistration(
    participantId: string,
    customerId: string,
    otpCode: string,
  ) {
    await this.verify(participantId, customerId, otpCode, 'REGISTER');

    const customer = await this.customerService.findOne(
      customerId,
      participantId,
    );

    customer.status = CustomerStatus.ACTIVE;

    return this.customerService.updateStatus(customer);
  }

  // ================== cleanExpiredOtps ==================
  // Scheduled job to remove expired OTP records
  @Cron(CronExpression.EVERY_10_MINUTES)
  async cleanExpiredOtps() {
    const result = await this.otpRepo.delete({
      expiresAt: LessThan(new Date()),
    });

    const count = result?.affected ?? 0;

    if (count > 0) this.logger.log(`Cleaned ${count} expired OTPs`);
  }
}

/////////////////////////
// FILE: src/otp/entities/otp.entity.ts
/////////////////////////
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity('otps')
export class Otp {
  @PrimaryGeneratedColumn('uuid')
  otpId: string;

  @Column()
  customerId: string;

  @Column()
  participantId: string;

  @Column()
  otpCode: string;

  @Column()
  purpose: string; // REGISTER, LOGIN, PAYMENT, MFA

  @Column({ default: 0 })
  attempts: number;

  @Column()
  expiresAt: Date;

  @CreateDateColumn()
  createdAt: Date;
}

/////////////////////////
// FILE: src/accounts/accounts.controller.ts
/////////////////////////
import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { AccountsService } from './accounts.service';
import { CreateAccountDto } from './dto/create-account.dto';
import { UpdateAccountStatusDto } from './dto/update-account-status.dto';
import { AccountType } from './enums/account.enum';
import { Currency } from 'src/common/enums/transaction.enums';
import { Participant } from 'src/common/decorators/participant/participant.decorator';

@Controller('accounts')
export class AccountsController {
  constructor(private readonly accountsService: AccountsService) {}

  @Post('customer-main')
  async createCustomerMain(@Body() dto: CreateAccountDto) {
    return this.accountsService.createCustomerMainAccount({
      ...dto,
      type: AccountType.CUSTOMER_MAIN,
    });
  }

  @Post('wallet')
  async createWallet(
    @Body() dto: CreateAccountDto,
    @Participant() participantId: string,
  ) {
    return this.accountsService.createWalletAccount(
      {
        ...dto,
        type: AccountType.WALLET,
      },
      participantId,
    );
  }

  @Post('system')
  async createSystem(
    @Body()
    body: {
      participantId: string;
      currency?: Currency;
      finAddress?: string;
    },
  ) {
    return this.accountsService.createSystemAccount(
      body.participantId,
      body.currency ?? Currency.SLE,
      body.finAddress,
    );
  }

  @Get(':accountId')
  async getById(
    @Param('accountId') accountId: string,
    @Participant() participantId: string,
  ) {
    return this.accountsService.findById(accountId, participantId);
  }

  @Get('fin-address/:finAddress')
  async getByFinAddress(@Param('finAddress') finAddress: string) {
    return this.accountsService.findByFinAddress(finAddress);
  }

  @Get('customer/:customerId/main')
  async getCustomerMain(@Param('customerId') customerId: string) {
    return this.accountsService.findCustomerMainAccount(customerId);
  }

  @Get('wallet/:walletId')
  async getWalletAccount(@Param('walletId') walletId: string) {
    return this.accountsService.findWalletAccount(walletId);
  }

  @Get('system/default')
  async getSystemAccount() {
    return this.accountsService.getSystemAccount();
  }

  @Patch(':accountId/status')
  async updateStatus(
    @Param('accountId') accountId: string,
    @Body() dto: UpdateAccountStatusDto,
    @Participant() participantId: string,
  ) {
    return this.accountsService.updateStatus(
      accountId,
      participantId,
      dto.status,
    );
  }
}

/*For now acceptable, but future fix:

participantId must come from auth
not body */

/////////////////////////
// FILE: src/accounts/accounts.module.ts
/////////////////////////
import { Module, forwardRef } from '@nestjs/common';
import { AccountsService } from './accounts.service';
import { AccountsController } from './accounts.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Account } from './entities/account.entity';
import { LedgerModule } from 'src/ledger/ledger.module';
import { KycModule } from 'src/kyc/kyc.module';
import { ComplianceModule } from 'src/compliance/compliance.module';
import { Participant } from 'src/auth/entities/participant.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Account, Participant]),
    forwardRef(() => LedgerModule),
    KycModule,
    ComplianceModule,
  ],
  controllers: [AccountsController],
  providers: [AccountsService],
  exports: [AccountsService, TypeOrmModule],
})
export class AccountsModule {}

/////////////////////////
// FILE: src/accounts/accounts.service.ts
/////////////////////////
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { Account } from './entities/account.entity';
import { CreateAccountDto } from './dto/create-account.dto';
import { AccountType, AccountStatus } from './enums/account.enum';
import { Currency } from 'src/common/enums/transaction.enums';

@Injectable()
export class AccountsService {
  constructor(
    @InjectRepository(Account)
    private readonly accountRepo: Repository<Account>,
  ) {}

  private getRepo(manager?: EntityManager): Repository<Account> {
    return manager ? manager.getRepository(Account) : this.accountRepo;
  }

  async createCustomerMainAccount(
    dto: CreateAccountDto,
    manager?: EntityManager,
  ): Promise<Account> {
    if (!dto.customerId) {
      throw new BadRequestException('customerId is required');
    }

    if (!dto.finAddress) {
      throw new BadRequestException('finAddress is required');
    }

    if (dto.type !== AccountType.CUSTOMER_MAIN) {
      throw new BadRequestException('type must be CUSTOMER_MAIN');
    }

    const repo = this.getRepo(manager);

    const existing = await repo.findOne({
      where: {
        customerId: dto.customerId,
        type: AccountType.CUSTOMER_MAIN,
      },
    });

    if (existing) {
      return existing;
    }

    await this.ensureUniqueFinAddress(repo, dto.finAddress, participantId);

    const account = repo.create({
      accountNumber: await this.generateUniqueAccountNumber(repo),
      customerId: dto.customerId,
      walletId: null,
      participantId: dto.participantId,
      currency: dto.currency ?? Currency.SLE,
      type: AccountType.CUSTOMER_MAIN,
      status: AccountStatus.ACTIVE,
      finAddress: dto.finAddress ?? null,
      isDefault: true,
      metadata: dto.metadata ?? null,
    });

    return repo.save(account);
  }

  async createWalletAccount(
    dto: CreateAccountDto,
    manager?: EntityManager,
    participantId: string,
  ): Promise<Account> {
    if (!dto.customerId) {
      throw new BadRequestException('customerId is required');
    }

    if (!dto.finAddress) {
      throw new BadRequestException('finAddress is required');
    }

    if (!dto.walletId) {
      throw new BadRequestException('walletId is required');
    }

    if (dto.type !== AccountType.WALLET) {
      throw new BadRequestException('type must be WALLET');
    }

    const repo = this.getRepo(manager);

    const existing = await repo.findOne({
      where: {
        walletId: dto.walletId,
        type: AccountType.WALLET,
      },
    });

    if (existing) {
      return existing;
    }

    await this.ensureUniqueFinAddress(repo, dto.finAddress, participantId);

    const account = repo.create({
      accountNumber: await this.generateUniqueAccountNumber(repo),
      customerId: dto.customerId,
      walletId: dto.walletId,
      participantId: dto.participantId,
      currency: dto.currency ?? Currency.SLE,
      type: AccountType.WALLET,
      status: AccountStatus.ACTIVE,
      finAddress: dto.finAddress ?? null,
      isDefault: false,
      metadata: dto.metadata ?? null,
    });

    return repo.save(account);
  }

  async createSystemAccount(
    participantId: string,
    currency: Currency = Currency.SLE,
    finAddress?: string,
    manager?: EntityManager,
  ): Promise<Account> {
    if (!finAddress) {
      throw new BadRequestException('finAddress required for system account');
    }
    const repo = this.getRepo(manager);

    const existing = await repo.findOne({
      where: {
        type: AccountType.SYSTEM,
        participantId,
      },
    });

    if (existing) {
      return existing;
    }

    await this.ensureUniqueFinAddress(repo, finAddress, participantId);

    const account = repo.create({
      accountNumber: await this.generateUniqueAccountNumber(repo),
      customerId: null,
      walletId: null,
      participantId,
      currency,
      type: AccountType.SYSTEM,
      status: AccountStatus.ACTIVE,
      finAddress: finAddress ?? null,
      isDefault: false,
      metadata: null,
    });

    return repo.save(account);
  }

  async ensureSystemAccount(
    participantId: string,
    currency: Currency = Currency.SLE,
    finAddress?: string,
    manager?: EntityManager,
  ): Promise<Account> {
    const repo = this.getRepo(manager);

    const existing = await repo.findOne({
      where: { type: AccountType.SYSTEM, participantId },
    });

    if (existing) return existing;

    return this.createSystemAccount(
      participantId,
      currency,
      finAddress,
      manager,
    );
  }

  async findById(
    accountId: string,
    participantId: string,
    manager?: EntityManager,
  ): Promise<Account> {
    const repo = this.getRepo(manager);

    const account = await repo.findOne({
      where: { accountId, participantId },
    });

    if (!account) {
      throw new NotFoundException('Account not found');
    }

    return account;
  }

  async findByFinAddress(
    finAddress: string,
    manager?: EntityManager,
  ): Promise<Account> {
    const repo = this.getRepo(manager);

    const account = await repo.findOne({
      where: { finAddress },
    });

    if (!account) {
      throw new NotFoundException(`Account not found: ${finAddress}`);
    }

    return account;
  }

  async findByIdForParticipant(accountId: string, participantId: string) {
    const account = await this.accountRepo.findOne({
      where: { accountId, participantId },
    });
    if (!account) {
      throw new NotFoundException('Account not found');
    }

    return account;
  }

  async findCustomerMainAccount(
    customerId: string,
    manager?: EntityManager,
  ): Promise<Account> {
    const repo = this.getRepo(manager);

    const account = await repo.findOne({
      where: {
        customerId,
        type: AccountType.CUSTOMER_MAIN,
      },
    });

    if (!account) {
      throw new NotFoundException('Customer main account not found');
    }

    return account;
  }

  async findWalletAccount(
    walletId: string,
    manager?: EntityManager,
  ): Promise<Account> {
    const repo = this.getRepo(manager);

    const account = await repo.findOne({
      where: {
        walletId,
        type: AccountType.WALLET,
      },
    });

    if (!account) {
      throw new NotFoundException('Wallet account not found');
    }

    return account;
  }

  async getSystemAccount(manager?: EntityManager): Promise<Account> {
    const repo = this.getRepo(manager);

    const account = await repo.findOne({
      where: { type: AccountType.SYSTEM },
    });

    if (!account) {
      throw new NotFoundException('System account not found');
    }

    return account;
  }

  async getDefaultCustomerAccount(
    customerId: string,
    participantId: string,
    manager?: EntityManager,
  ): Promise<Account> {
    const repo = this.getRepo(manager);

    const account = await repo.findOne({
      where: {
        customerId,
        participantId,
        type: AccountType.CUSTOMER_MAIN,
        isDefault: true,
      },
    });

    if (!account) {
      throw new NotFoundException('Default account not found');
    }

    return account;
  }

  async updateStatus(
    accountId: string,
    participantId: string,
    status: AccountStatus,
    manager?: EntityManager,
  ): Promise<Account> {
    const repo = this.getRepo(manager);
    const account = await this.findById(accountId, participantId);

    account.status = status;
    return repo.save(account);
  }

  async assertAccountActive(
    accountId: string,
    participantId: string,
    manager?: EntityManager,
  ): Promise<Account> {
    const account = await this.findById(accountId, participantId);

    if (account.status !== AccountStatus.ACTIVE) {
      throw new BadRequestException(`Account ${accountId} is not active`);
    }

    return account;
  }

  async assertFinAddressActive(
    finAddress: string,
    manager?: EntityManager,
    participantId: string,
  ): Promise<Account> {
    const repo = this.getRepo(manager);
    const account = await repo.findOne({
      where: { finAddress, participantId },
    });

    if (!account)
      throw new NotFoundException(`Account not found ${finAddress}`);

    if (account.status !== AccountStatus.ACTIVE) {
      throw new BadRequestException(`Account ${finAddress} is not active`);
    }

    return account;
  }

  private async ensureUniqueFinAddress(
    repo: Repository<Account>,
    finAddress?: string | null,
    participantId: string,
  ): Promise<void> {
    if (!finAddress) return;

    const existing = await repo.findOne({
      where: {
        finAddress,
        participantId: repo.manager?.getRepository(Account)
          ? undefined
          : undefined,
      },
    });

    if (existing) {
      throw new ConflictException(`finAddress already exists: ${finAddress}`);
    }
  }

  private async generateUniqueAccountNumber(
    repo: Repository<Account>,
  ): Promise<string> {
    for (let i = 0; i < 20; i++) {
      const candidate = this.generateAccountNumber();

      const existing = await repo.findOne({
        where: { accountNumber: candidate },
      });

      if (!existing) return candidate;
    }

    throw new ConflictException('Unable to generate unique account number');
  }

  private generateAccountNumber(): string {
    const part1 = Date.now().toString().slice(-6);
    const part2 = Math.floor(100000 + Math.random() * 900000).toString();
    return `${part1}${part2}`;
  }
}

/////////////////////////
// FILE: src/accounts/enums/account.enum.ts
/////////////////////////
export enum AccountType {
  CUSTOMER_MAIN = 'CUSTOMER_MAIN',
  WALLET = 'WALLET',
  SYSTEM = 'SYSTEM',
}

export enum AccountStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  BLOCKED = 'BLOCKED',
  CLOSED = 'CLOSED',
}

/////////////////////////
// FILE: src/accounts/dto/account-balance-response.dto.ts
/////////////////////////
import { AccountType } from '../enums/account.enum';
import { Currency } from 'src/common/enums/transaction.enums';

export class AccountBalanceResponseDto {
  accountId: string; // UUID of the account
  accountNumber: string; // Unique account number
  type: AccountType; // Enum instead of plain string
  currency: Currency; // Enum instead of plain string
  availableBalance: number; // Numeric type for balance
}

/////////////////////////
// FILE: src/accounts/dto/create-account.dto.ts
/////////////////////////
import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { AccountType } from '../enums/account.enum';
import { Currency } from 'src/common/enums/transaction.enums';

export class CreateAccountDto {
  @IsOptional()
  @IsUUID()
  customerId?: string;

  @IsOptional()
  @IsUUID()
  walletId?: string;

  @IsString()
  participantId: string;

  @IsOptional()
  @IsEnum(Currency)
  currency?: Currency;

  @IsEnum(AccountType)
  type: AccountType;

  @IsString()
  finAddress?: string;

  @IsOptional()
  metadata?: Record<string, any>;
}

/////////////////////////
// FILE: src/accounts/dto/create-system-account.dto.ts
/////////////////////////
import { IsEnum, IsOptional, IsString, Length, Matches } from 'class-validator';
import { Currency } from 'src/common/enums/transaction.enums';

export class CreateSystemAccountDto {
  @IsString()
  @Length(2, 100)
  participantId: string;

  @IsOptional()
  @IsEnum(Currency)
  currency?: Currency;

  @IsOptional()
  @IsString()
  @Length(3, 255)
  @Matches(/^[a-zA-Z0-9._@-]+$/, {
    message: 'finAddress contains invalid characters',
  })
  finAddress?: string;
}

/////////////////////////
// FILE: src/accounts/dto/update-account-status.dto.ts
/////////////////////////
import { IsEnum } from 'class-validator';
import { AccountStatus } from '../enums/account.enum';

export class UpdateAccountStatusDto {
  @IsEnum(AccountStatus)
  status: AccountStatus;
}

/////////////////////////
// FILE: src/accounts/entities/account.entity.ts
/////////////////////////
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Currency } from 'src/common/enums/transaction.enums';
import { Customer } from 'src/customer/entities/customer.entity';
import { Wallet } from 'src/wallet/entities/wallet.entity';
import { AccountType, AccountStatus } from '../enums/account.enum';

@Entity('accounts')
@Index('IDX_ACCOUNT_ACCOUNT_NUMBER', ['accountNumber'], { unique: true })
@Index('IDX_ACCOUNT_FIN_ADDRESS', ['finAddress'], { unique: true })
@Index('IDX_ACCOUNT_CUSTOMER_TYPE', ['customerId', 'type'])
@Index('IDX_ACCOUNT_WALLET_TYPE', ['walletId', 'type'])
export class Account {
  @PrimaryGeneratedColumn('uuid')
  accountId: string;

  @Column({ type: 'varchar', length: 30, unique: true })
  accountNumber: string;

  @Column({ type: 'uuid', nullable: true })
  customerId: string | null;

  @Column({ type: 'uuid', nullable: true })
  walletId: string | null;

  @Column({ type: 'varchar', length: 100 })
  participantId: string;

  @Column({
    type: 'enum',
    enum: Currency,
    default: Currency.SLE,
  })
  currency: Currency;

  @Column({
    type: 'enum',
    enum: AccountType,
  })
  type: AccountType;

  @Column({
    type: 'enum',
    enum: AccountStatus,
    default: AccountStatus.ACTIVE,
  })
  status: AccountStatus;

  @Column({ type: 'varchar', length: 255, unique: true })
  finAddress: string;

  @Column({ type: 'boolean', default: false })
  isDefault: boolean;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, any> | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => Customer, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'customerId' })
  customer?: Customer | null;

  @OneToOne(() => Wallet, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'walletId' })
  wallet?: Wallet | null;
}

/////////////////////////
// FILE: src/kyc/kyc.controller.ts
/////////////////////////
import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
  UseInterceptors,
  UploadedFiles,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { KycService } from './kyc.service';
import { SoftKycDto } from './dto/soft-kyc.dto';
import { HardKycDto } from './dto/hard-kyc.dto';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { memoryStorage } from 'multer';
import { Participant } from 'src/common/decorators/participant/participant.decorator';
import { RolesGuard } from 'src/common/guards/auth/roles.guard';
import { Roles } from 'src/common/decorators/auth/roles.decorator';
import { Role } from 'src/common/enums/auth.enums';

const upload = FileFieldsInterceptor(
  [
    { name: 'idFront', maxCount: 1 },
    { name: 'idBack', maxCount: 1 },
    { name: 'selfie', maxCount: 1 },
    { name: 'addressProof', maxCount: 1 },
  ],
  {
    storage: memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB per file
    fileFilter: (_req, file, cb) => {
      const allowed = [
        'image/jpeg',
        'image/png',
        'image/webp',
        'application/pdf',
      ];
      if (allowed.includes(file.mimetype)) cb(null, true);
      else cb(new Error(`File type not allowed: ${file.mimetype}`), false);
    },
  },
);

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('/api/fp/kyc')
export class KycController {
  constructor(private readonly kycService: KycService) {}

  // ── CUSTOMER ROUTES (Dynamic paths last) ────────────────────

  // Get own KYC status
  @Get(':customerId/status')
  @Roles(Role.CUSTOMER)
  getStatus(
    @Param('customerId') customerId: string,
    @Participant() participantId: string,
  ) {
    return this.kycService.getStatus(customerId, participantId);
  }

  // Submit Soft KYC — auto approved
  @Post(':customerId/soft')
  @Roles(Role.CUSTOMER)
  submitSoft(
    @Param('customerId') customerId: string,
    @Body() dto: SoftKycDto,
    @Participant() participantId: string,
  ) {
    return this.kycService.submitSoft(customerId, participantId, dto);
  }

  // Submit Hard KYC — goes to admin review queue
  @Post(':customerId/hard')
  @Roles(Role.CUSTOMER)
  @UseInterceptors(upload)
  submitHard(
    @Param('customerId') customerId: string,
    @Body() dto: HardKycDto,
    @Participant() participantId: string,
    @UploadedFiles()
    files: {
      idFront?: Express.Multer.File[];
      idBack?: Express.Multer.File[];
      selfie?: Express.Multer.File[];
      addressProof?: Express.Multer.File[];
    },
  ) {
    return this.kycService.submitHard(customerId, participantId, dto, files);
  }
}

/////////////////////////
// FILE: src/kyc/kyc.module.ts
/////////////////////////
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { KycRecord } from './entities/kyc.entity';
import { KycService } from './kyc.service';
import { KycController } from './kyc.controller';

@Module({
  imports: [TypeOrmModule.forFeature([KycRecord])],
  providers: [KycService],
  controllers: [KycController],
  exports: [KycService],
})
export class KycModule {}

/////////////////////////
// FILE: src/kyc/kyc.service.ts
/////////////////////////
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { KycRecord } from './entities/kyc.entity';
import { KycTier } from 'src/common/enums/kyc.enums';
import { SoftKycDto } from './dto/soft-kyc.dto';
import { HardKycDto } from './dto/hard-kyc.dto';
import { RejectKycDto } from './dto/review-kyc.dto';
import * as fs from 'fs';
import * as path from 'path';
import { NotificationsService } from 'src/notifications/notifications.service';

interface KycFiles {
  idFront?: Express.Multer.File[];
  idBack?: Express.Multer.File[];
  selfie?: Express.Multer.File[];
  addressProof?: Express.Multer.File[];
}

@Injectable()
export class KycService {
  constructor(
    @InjectRepository(KycRecord)
    private kycRepo: Repository<KycRecord>,
    private readonly notificationsService: NotificationsService,
  ) {}

  // ── CUSTOMER: Submit Soft KYC ─────────────────────────────────
  // Auto-approves — no manual review needed for basic identity info
  async submitSoft(customerId: string, participantId: string, dto: SoftKycDto) {
    let record = await this.kycRepo.findOne({
      where: { customerId, participantId },
    });

    const existing = await this.kycRepo.findOne({
      where: { idNumber: dto.idNumber, participantId },
    });
    if (existing && existing.customerId !== customerId)
      throw new BadRequestException('ID already used');

    if (
      record &&
      ![KycTier.NONE, KycTier.HARD_REJECTED].includes(record.tier)
    ) {
      throw new BadRequestException(
        `Soft KYC already submitted. Current status: ${record.tier}`,
      );
    }

    if (!record) {
      record = this.kycRepo.create({ customerId, participantId });
    }

    const dob = new Date(dto.dateOfBirth);
    const age = new Date().getFullYear() - dob.getFullYear();

    if (age < 18) throw new BadRequestException('Customer must be 18+');

    Object.assign(record, {
      fullName: dto.fullName,
      dateOfBirth: new Date(dto.dateOfBirth),
      nationality: dto.nationality,
      idNumber: dto.idNumber,
      idDocumentType: dto.idDocumentType,
      idExpiryDate: new Date(dto.idExpiryDate),
      tier: KycTier.SOFT_APPROVED, // auto-approve soft KYC
      lastUpdatedBy: customerId,
    });

    await this.kycRepo.save(record);
    return {
      kycId: record.kycId,
      tier: record.tier,
      message: 'Soft KYC approved. You can now access basic wallet features.',
    };
  }

  // ── CUSTOMER: Submit Hard KYC ─────────────────────────────────
  // Requires soft KYC to be approved first
  // Files uploaded via Multer — stored locally or on S3
  async submitHard(
    customerId: string,
    participantId: string,
    dto: HardKycDto,
    files: {
      idFront?: Express.Multer.File[];
      idBack?: Express.Multer.File[];
      selfie?: Express.Multer.File[];
      addressProof?: Express.Multer.File[];
    },
  ) {
    const record = await this.kycRepo.findOne({
      where: { customerId, participantId },
    });

    if (!record || record.tier !== KycTier.SOFT_APPROVED) {
      throw new BadRequestException(
        'Soft KYC must be approved before submitting Hard KYC.',
      );
    }

    // Validate required files
    if (!files.idFront?.[0])
      throw new BadRequestException('ID front image is required');
    if (!files.selfie?.[0])
      throw new BadRequestException('Selfie image is required');

    // Save file paths
    const storePaths = await this.storeFiles(customerId, files);

    Object.assign(record, {
      addressLine1: dto.addressLine1,
      addressLine2: dto.addressLine2,
      city: dto.city,
      state: dto.state,
      postalCode: dto.postalCode,
      country: dto.country,
      idFrontPath: storePaths.idFront,
      idBackPath: storePaths.idBack,
      selfiePath: storePaths.selfie,
      addressProofPath: storePaths.addressProof,
      tier: KycTier.HARD_PENDING,
      rejectionReason: null,
      rejectionNote: null,
      lastUpdatedBy: customerId,
    });

    await this.kycRepo.save(record);
    return {
      kycId: record.kycId,
      tier: record.tier,
      message: 'Hard KYC submitted. Pending admin review.',
    };
  }

  // ── CUSTOMER: Get own KYC status ──────────────────────────────
  async getStatus(customerId: string, participantId: string) {
    const record = await this.kycRepo.findOne({
      where: { customerId, participantId },
    });
    if (!record) return { tier: KycTier.NONE, message: 'No KYC submitted yet' };

    return {
      kycId: record.kycId,
      tier: record.tier,
      rejectionReason: record.rejectionReason ?? null,
      rejectionNote: record.rejectionNote ?? null,
      updatedAt: record.updatedAt,
    };
  }

  async getTier(customerId: string, participantId: string): Promise<KycTier> {
    const record = await this.kycRepo.findOne({
      where: { customerId, participantId },
    });

    return record?.tier ?? KycTier.NONE;
  }

  // ── ADMIN: Get all pending Hard KYC records ───────────────────
  async getPendingReviews(participantId: string) {
    return this.kycRepo.find({
      where: { participantId, tier: KycTier.HARD_PENDING },
      order: { createdAt: 'ASC' },
    });
  }

  // ── ADMIN: Get single record ──────────────────────────────────
  async getRecord(kycId: string) {
    const record = await this.kycRepo.findOne({ where: { kycId } });
    if (!record) throw new NotFoundException('KYC record not found');
    return record;
  }

  // ── ADMIN: Approve Hard KYC ───────────────────────────────────
  async approveHard(kycId: string, adminId: string) {
    const record = await this.getRecord(kycId);

    if (record.tier === KycTier.HARD_APPROVED) {
      // Manage limits
      throw new BadRequestException(
        `Already approved. Current status: ${record.tier}`,
      );
    }

    if (record.tier !== KycTier.HARD_PENDING) {
      throw new BadRequestException(
        `Cannot approve. Current status: ${record.tier}`,
      );
    }

    record.tier = KycTier.HARD_APPROVED;
    record.reviewedBy = adminId;
    record.reviewedAt = new Date();
    record.rejectionReason = null;
    record.rejectionNote = null;
    record.lastUpdatedBy = adminId;

    await this.kycRepo.save(record);
    await this.notificationsService.createInAppNotification(
      record.participantId,
      'Kyc Approved',
      'Your KYC has been approved',
    );
    return { kycId, tier: record.tier, message: 'Hard KYC approved' };
  }

  // ── ADMIN: Reject Hard KYC ────────────────────────────────────
  async rejectHard(kycId: string, adminId: string, dto: RejectKycDto) {
    const record = await this.getRecord(kycId);

    if (record.tier !== KycTier.HARD_PENDING) {
      throw new BadRequestException(
        `Cannot reject. Current status: ${record.tier}`,
      );
    }

    // Rejected → customer must re-submit hard KYC
    record.tier = KycTier.HARD_REJECTED;
    record.reviewedBy = adminId;
    record.reviewedAt = new Date();
    record.rejectionReason = dto.reason;
    record.rejectionNote = dto.note ?? undefined;
    record.lastUpdatedBy = adminId;

    await this.kycRepo.save(record);
    await this.notificationsService.createInAppNotification(
      record.participantId,
      'Kyc Rejected',
      'Your KYC has been rejected',
    );
    return { kycId, tier: record.tier, message: 'Hard KYC rejected' };
  }

  // ── INTERNAL: gate check used by other services ───────────────
  // Call this before allowing Cards or Loans
  async requireTier(
    customerId: string,
    participantId: string,
    required: KycTier,
  ) {
    const record = await this.kycRepo.findOne({
      where: { customerId, participantId },
    });

    const tier = record?.tier ?? KycTier.NONE;

    const order = [
      KycTier.NONE,
      KycTier.SOFT_PENDING,
      KycTier.SOFT_APPROVED,
      KycTier.HARD_PENDING,
      KycTier.HARD_APPROVED,
    ];

    /*
    | Tier          | Allowed                |
| ------------- | ---------------------- |
| NONE          | register               |
| SOFT_APPROVED | small wallet transfers |
| HARD_APPROVED | large transfers        |
| HARD_APPROVED | loans                  |
| HARD_APPROVED | withdrawals            |

    */
    const currentIdx = order.indexOf(tier);
    const requiredIdx = order.indexOf(required);

    if (currentIdx < requiredIdx) {
      throw new ForbiddenException(
        `This feature requires ${required} KYC. Your current level is ${tier}.`,
      );
    }
  }

  // ── PRIVATE: file storage ─────────────────────────────────────
  private async storeFiles(customerId: string, files: KycFiles) {
    const storage = process.env.KYC_STORAGE ?? 'local';

    if (storage === 'local') {
      return this.storeLocal(customerId, files);
    }

    // TODO: swap to S3 in production
    // return this.storeS3(customerId, files);
    return this.storeLocal(customerId, files);
  }

  private storeLocal(customerId: string, files: KycFiles) {
    const base = path.resolve(process.env.KYC_UPLOAD_PATH ?? './uploads/kyc');
    const dir = path.join(base, customerId, Date.now().toString());
    fs.mkdirSync(dir, { recursive: true });

    const save = (
      file?: Express.Multer.File,
      name?: string,
    ): string | undefined => {
      if (!file) return undefined;
      const ext = path.extname(file.originalname) || '.jpg';
      const filePath = path.join(dir, `${name}${ext}`);
      fs.writeFileSync(filePath, file.buffer);
      return filePath;
    };

    return {
      idFront: save(files.idFront?.[0], 'id_front'),
      idBack: save(files.idBack?.[0], 'id_back'),
      selfie: save(files.selfie?.[0], 'selfie'),
      addressProof: save(files.addressProof?.[0], 'address_proof'),
    };
  }
}

/////////////////////////
// FILE: src/kyc/dto/hard-kyc.dto.ts
/////////////////////////
import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

// Hard KYC is submitted as multipart/form-data (files + fields)
// Files are handled by Multer — fields come in as body
export class HardKycDto {
  @IsString()
  @IsNotEmpty()
  addressLine1: string;

  @IsString()
  @IsOptional()
  addressLine2?: string;

  @IsString()
  @IsNotEmpty()
  city: string;

  @IsString()
  @IsNotEmpty()
  state: string;

  @IsString()
  @IsNotEmpty()
  postalCode: string;

  @IsString()
  @IsNotEmpty()
  country: string;
}

/////////////////////////
// FILE: src/kyc/dto/review-kyc.dto.ts
/////////////////////////
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { KycRejectionReason } from 'src/common/enums/kyc.enums';

export class ApproveKycDto {
  // no body needed — action is implied by endpoint
}

export class RejectKycDto {
  @IsEnum(KycRejectionReason)
  reason: KycRejectionReason;

  @IsString()
  @IsOptional()
  note?: string;
}

/////////////////////////
// FILE: src/kyc/dto/soft-kyc.dto.ts
/////////////////////////
import { IsString, IsNotEmpty, IsDateString, IsEnum } from 'class-validator';
import { KycDocumentType } from 'src/common/enums/kyc.enums';

export class SoftKycDto {
  @IsString()
  @IsNotEmpty()
  fullName: string;

  @IsDateString()
  dateOfBirth: string;

  @IsString()
  @IsNotEmpty()
  nationality: string;

  @IsString()
  @IsNotEmpty()
  idNumber: string;

  @IsEnum(KycDocumentType)
  idDocumentType: KycDocumentType;

  @IsDateString()
  idExpiryDate: string;
}

/////////////////////////
// FILE: src/kyc/entities/kyc.entity.ts
/////////////////////////
import {
  KycTier,
  KycDocumentType,
  KycRejectionReason,
} from 'src/common/enums/kyc.enums';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('kyc_records')
@Index(['participantId', 'customerId'], { unique: true })
export class KycRecord {
  @PrimaryGeneratedColumn('uuid')
  kycId: string;

  @Column()
  customerId: string;

  @Column()
  participantId: string;

  // SOFT
  @Column({ nullable: true }) fullName?: string;

  @Column({ type: 'date', nullable: true }) dateOfBirth?: Date;
  @Column({ nullable: true }) nationality?: string;
  @Column({ nullable: true }) idNumber?: string;
  @Column({ type: 'enum', enum: KycDocumentType, nullable: true })
  idDocumentType?: KycDocumentType;
  @Column({ type: 'date', nullable: true }) idExpiryDate?: Date;

  // HARD
  @Column({ nullable: true }) addressLine1?: string;
  @Column({ nullable: true }) addressLine2?: string;
  @Column({ nullable: true }) city?: string;
  @Column({ nullable: true }) state?: string;
  @Column({ nullable: true }) postalCode?: string;
  @Column({ nullable: true }) country?: string;

  @Column({ nullable: true }) idFrontPath?: string;
  @Column({ nullable: true }) idBackPath?: string;
  @Column({ nullable: true }) selfiePath?: string;
  @Column({ nullable: true }) addressProofPath?: string;

  @Column({ type: 'enum', enum: KycTier, default: KycTier.NONE })
  tier: KycTier;

  @Column({ nullable: true }) reviewedBy?: string;
  @Column({ type: 'timestamp', nullable: true }) reviewedAt?: Date;

  @Column({ type: 'enum', enum: KycRejectionReason, nullable: true })
  rejectionReason?: KycRejectionReason | null;

  @Column({ nullable: true }) rejectionNote?: string | null;

  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
  @Column({ nullable: true }) lastUpdatedBy: string;
}

/////////////////////////
// FILE: src/loan/loan-admin.controller.ts
/////////////////////////
import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';

import { LoanService } from './loan.service';
import { ApproveLoanDto, RejectLoanDto } from './dto/approve-loan.dto';
import { LoanStatus } from 'src/common/enums/loan.enums';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/auth/roles.guard';
import { Roles } from 'src/common/decorators/auth/roles.decorator';
import { Role } from 'src/common/enums/auth.enums';

@Controller('admin/loan')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.LOAN_OFFICER)
export class LoanAdminController {
  constructor(private readonly loanService: LoanService) {}

  @Get()
  listAll(
    @Query('status') status?: LoanStatus,
    @Query('participantId') participantId?: string,
  ) {
    return this.loanService.getAllLoans(status, participantId);
  }

  @Post(':loanId/approve')
  approve(
    @Param('loanId', ParseUUIDPipe) loanId: string,
    @Body() dto: ApproveLoanDto,
    @Req() req: Request & { user: { adminId: string } },
  ) {
    return this.loanService.approveLoan(loanId, req.user.adminId, dto);
  }

  @Post(':loanId/reject')
  reject(
    @Param('loanId', ParseUUIDPipe) loanId: string,
    @Body() dto: RejectLoanDto,
    @Req() req: Request & { user: { adminId: string } },
  ) {
    return this.loanService.rejectLoan(loanId, req.user.adminId, dto);
  }

  @Post(':loanId/disburse')
  @Roles(Role.ADMIN)
  disburse(
    @Param('loanId', ParseUUIDPipe) loanId: string,
    @Req() req: Request & { user: { adminId: string } },
  ) {
    return this.loanService.disburseLoan(loanId, req.user.adminId);
  }
}

/////////////////////////
// FILE: src/loan/loan.controller.ts
/////////////////////////
import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';

import { LoanService } from './loan.service';
import { ApplyLoanDto } from './dto/apply-loan.dto';
import { RepayLoanDto } from './dto/repay-loan.dto';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { ParticipantGuard } from 'src/common/guards/participant/participant.guard';
import { Participant } from 'src/common/decorators/participant/participant.decorator';

@Controller('loan')
@UseGuards(JwtAuthGuard, ParticipantGuard)
export class LoanController {
  constructor(private readonly loanService: LoanService) {}

  @Post('apply')
  apply(
    @Participant() participantId: string,
    @Body() dto: ApplyLoanDto,
    @Req() req: Request & { user: { customerId: string } },
  ) {
    return this.loanService.applyLoan(req.user.customerId, participantId, dto);
  }

  @Get()
  getMyLoans(@Req() req: Request & { user: { customerId: string } }) {
    return this.loanService.getLoansByCustomer(req.user.customerId);
  }

  @Get(':loanId')
  getLoan(
    @Participant() participantId: string,
    @Param('loanId', ParseUUIDPipe) loanId: string,
    @Req() req: Request & { user: { customerId: string } },
  ) {
    return this.loanService.getLoanById(
      loanId,
      req.user.customerId,
      participantId,
    );
  }

  @Get(':loanId/repayments')
  getRepayments(
    @Participant() participantId: string,
    @Param('loanId', ParseUUIDPipe) loanId: string,
    @Req() req: Request & { user: { customerId: string } },
  ) {
    return this.loanService.getRepaymentHistory(
      loanId,
      req.user.customerId,
      participantId,
    );
  }

  @Post(':loanId/repay')
  repay(
    @Participant() participantId: string,
    @Param('loanId', ParseUUIDPipe) loanId: string,
    @Body() dto: RepayLoanDto,
    @Req() req: Request & { user: { customerId: string } },
  ) {
    return this.loanService.repayLoan(
      req.user.customerId,
      loanId,
      dto,
      participantId,
    );
  }
}

/////////////////////////
// FILE: src/loan/loan.module.ts
/////////////////////////
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { LoanApplication } from './entities/loan-application.entity';
import { LoanRepayment } from './entities/loan-repayment.entity';

import { LoanService } from './loan.service';
import { LoanController } from './loan.controller';
import { LoanAdminController } from './loan-admin.controller';

import { WalletModule } from 'src/wallet/wallet.module';
import { LedgerModule } from 'src/ledger/ledger.module';
import { KycModule } from 'src/kyc/kyc.module';
import { AuthModule } from 'src/auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([LoanApplication, LoanRepayment]),

    WalletModule,
    LedgerModule,
    KycModule,
    AuthModule,
  ],

  controllers: [LoanController, LoanAdminController],

  providers: [LoanService],

  exports: [LoanService],
})
export class LoanModule {}

/////////////////////////
// FILE: src/loan/loan.service.ts
/////////////////////////
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Cron } from '@nestjs/schedule';
import { DataSource, FindOptionsWhere, In, Repository } from 'typeorm';
import Decimal from 'decimal.js';
import * as crypto from 'crypto';

import { LoanApplication } from './entities/loan-application.entity';
import { LoanRepayment } from './entities/loan-repayment.entity';
import { LoanStatus } from 'src/common/enums/loan.enums';
import { ApplyLoanDto } from './dto/apply-loan.dto';
import { RepayLoanDto } from './dto/repay-loan.dto';
import { ApproveLoanDto, RejectLoanDto } from './dto/approve-loan.dto';

import { LedgerService } from '../ledger/ledger.service';
import { WalletService } from '../wallet/wallet.service';
import { KycService } from '../kyc/kyc.service';
import { KycTier } from 'src/common/enums/kyc.enums';
import { SYSTEM_POOL } from 'src/common/constants';
import { AccountsService } from 'src/accounts/accounts.service';
import { Transaction } from 'src/payments/transaction/entities/transaction.entity';
import {
  Currency,
  TransactionStatus,
  TransactionType,
} from 'src/common/enums/transaction.enums';
/**
 * SYSTEM_POOL — the internal fin-address that acts as the source of
 * disbursed funds and the sink for repayments.  This account must exist
 * as a seeded ledger posting (balance derived from postings, never a raw
 * column) before any loan can be disbursed.
 */

@Injectable()
export class LoanService {
  private readonly logger = new Logger(LoanService.name);

  constructor(
    @InjectRepository(LoanApplication)
    private readonly loanRepo: Repository<LoanApplication>,

    @InjectRepository(LoanRepayment)
    private readonly repayRepo: Repository<LoanRepayment>,

    @InjectRepository(Transaction)
    private readonly txRepo: Repository<Transaction>,

    private readonly ledgerService: LedgerService,
    private readonly walletService: WalletService,
    private readonly kycService: KycService,
    private readonly accountsService: AccountsService,
    private readonly dataSource: DataSource,
  ) {
    Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });
  }

  async applyLoan(
    customerId: string,
    participantId: string,
    dto: ApplyLoanDto,
  ): Promise<LoanApplication> {
    await this.kycService.requireTier(
      customerId,
      participantId,
      KycTier.HARD_APPROVED,
    );

    await this.walletService.findByCustomer(customerId, participantId);

    const amount = new Decimal(dto.amount);
    if (amount.lte(0)) throw new BadRequestException('Invalid amount');

    const existing = await this.loanRepo.findOne({
      where: {
        customerId,
        participantId,
        status: In([
          LoanStatus.PENDING,
          LoanStatus.ACTIVE,
          LoanStatus.APPROVED,
          LoanStatus.OVERDUE,
        ]),
      },
    });

    if (existing) {
      throw new ConflictException('Customer already has active loan');
    }

    return this.loanRepo.save(
      this.loanRepo.create({
        customerId,
        participantId,
        requestedAmount: amount.toFixed(2),
        outstandingBalance: amount.toFixed(2),
        status: LoanStatus.PENDING,
        purpose: dto.purpose ?? null,
      }),
    );
  }

  async repayLoan(
    customerId: string,
    loanId: string,
    dto: RepayLoanDto,
    participantId: string,
  ): Promise<LoanRepayment> {
    return this.dataSource.transaction(async (manager) => {
      if (dto.idempotencyKey) {
        const dup = await manager.findOne(LoanRepayment, {
          where: { idempotencyKey: dto.idempotencyKey },
        });
        if (dup) return dup;
      }

      const loan = await manager.findOne(LoanApplication, {
        where: { loanId, customerId, participantId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!loan) throw new NotFoundException('Loan not found');

      if (![LoanStatus.ACTIVE, LoanStatus.OVERDUE].includes(loan.status)) {
        throw new BadRequestException('Loan not repayable');
      }

      const repayAmount = new Decimal(dto.amount);
      const outstanding = new Decimal(loan.outstandingBalance);

      if (repayAmount.lte(0)) throw new BadRequestException('Invalid amount');
      if (repayAmount.gt(outstanding))
        throw new BadRequestException('Exceeds outstanding');

      const wallet = await this.walletService.findByCustomer(
        customerId,
        loan.participantId,
      );

      const balance = new Decimal(
        await this.ledgerService.getDerivedBalance(
          wallet.finAddress,
          participantId,
        ),
      );

      if (balance.lt(repayAmount)) {
        throw new BadRequestException('Insufficient balance');
      }

      const txId = crypto.randomUUID();

      await this.accountsService.assertFinAddressActive(
        wallet.finAddress,
        manager,
      );
      await this.accountsService.assertFinAddressActive(SYSTEM_POOL, manager);

      const result = await this.ledgerService.postTransfer(
        {
          txId,
          idempotencyKey: dto.idempotencyKey ?? txId,
          reference: `Loan repayment ${loanId}`,
          participantId: loan.participantId,
          postedBy: customerId,
          legs: [
            {
              finAddress: wallet.finAddress,
              amount: repayAmount.toFixed(2),
              isCredit: false,
            },
            {
              finAddress: SYSTEM_POOL,
              amount: repayAmount.toFixed(2),
              isCredit: true,
            },
          ],
        },
        manager,
      );

      await manager.getRepository(Transaction).save(
        manager.getRepository(Transaction).create({
          participantId: loan.participantId,
          channel: TransactionType.CREDIT_TRANSFER,
          customerId,
          senderFinAddress: wallet.finAddress,
          receiverFinAddress: SYSTEM_POOL,
          amount: Number(repayAmount.toFixed(2)),
          currency: Currency.SLE,
          status: TransactionStatus.COMPLETED,
          reference: `Loan repayment for LoanId:  ${loanId}`,
          journalId: result.journalId,
        }),
      );

      const newOutstanding = outstanding.minus(repayAmount);
      const before = loan.outstandingBalance;

      loan.outstandingBalance = newOutstanding.toFixed(2);

      if (newOutstanding.lte(0)) {
        loan.status = LoanStatus.REPAID;
      }

      await manager.save(loan);

      return manager.save(
        manager.create(LoanRepayment, {
          loanId,
          customerId,
          participantId: loan.participantId,
          amount: repayAmount.toFixed(2),
          outstandingBefore: before,
          outstandingAfter: loan.outstandingBalance,
          ledgerJournalId: result.journalId,
          idempotencyKey: dto.idempotencyKey ?? txId,
        }),
      );
    });
  }

  async approveLoan(loanId: string, adminId: string, dto: ApproveLoanDto) {
    const loan = await this.loanRepo.findOne({
      where: { loanId },
    });

    if (!loan) throw new NotFoundException();

    if (loan.status !== LoanStatus.PENDING) throw new BadRequestException();

    const due = new Date(dto.dueDate);
    if (due <= new Date()) throw new BadRequestException('Invalid due date');

    loan.status = LoanStatus.APPROVED;
    loan.approvedAmount = new Decimal(dto.approvedAmount).toFixed(2);
    loan.outstandingBalance = loan.approvedAmount;
    loan.dueDate = due;
    loan.reviewedBy = adminId;
    loan.reviewedAt = new Date();

    return this.loanRepo.save(loan);
  }

  async rejectLoan(loanId: string, adminId: string, dto: RejectLoanDto) {
    const loan = await this.loanRepo.findOne({ where: { loanId } });

    if (!loan) throw new NotFoundException();

    loan.status = LoanStatus.REJECTED;
    loan.rejectionReason = dto.rejectionReason ?? null;
    loan.reviewedBy = adminId;
    loan.reviewedAt = new Date();

    return this.loanRepo.save(loan);
  }

  async disburseLoan(loanId: string, adminId: string) {
    return this.dataSource.transaction(async (manager) => {
      const loan = await manager.findOne(LoanApplication, {
        where: { loanId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!loan) throw new NotFoundException();

      if (loan.disbursedAt) throw new ConflictException('Already disbursed');

      if (loan.status !== LoanStatus.APPROVED) throw new BadRequestException();

      const wallet = await this.walletService.findByCustomer(
        loan.customerId,
        loan.participantId,
      );

      const amount = new Decimal(loan.approvedAmount);

      const txId = crypto.randomUUID();

      const result = await this.ledgerService.postTransfer(
        {
          txId,
          idempotencyKey: `disburse-${loanId}`,
          reference: `Loan disbursement`,
          participantId: loan.participantId,
          postedBy: adminId,
          legs: [
            {
              finAddress: SYSTEM_POOL,
              amount: amount.toFixed(2),
              isCredit: false,
            },
            {
              finAddress: wallet.finAddress,
              amount: amount.toFixed(2),
              isCredit: true,
            },
          ],
        },
        manager,
      );

      loan.status = LoanStatus.ACTIVE;
      loan.disbursedAt = new Date();
      loan.ledgerJournalId = result.journalId;

      return manager.save(loan);
    });
  }

  async getLoansByCustomer(customerId: string) {
    return this.loanRepo.find({
      where: { customerId },
      order: { appliedAt: 'DESC' },
    });
  }

  async getLoanById(loanId: string, customerId: string, participantId: string) {
    const loan = await this.loanRepo.findOne({
      where: { loanId, customerId, participantId },
    });

    if (!loan) throw new NotFoundException();

    return loan;
  }

  async getRepaymentHistory(
    loanId: string,
    customerId: string,
    participantId: string,
  ) {
    await this.getLoanById(loanId, customerId, participantId);

    return this.repayRepo.find({
      where: { loanId, customerId, participantId },
      order: { repaidAt: 'DESC' },
    });
  }

  async getAllLoans(status?: LoanStatus, participantId?: string) {
    if (!participantId) throw new ForbiddenException();
    const where: FindOptionsWhere<LoanApplication> = {};
    if (status) where.status = status;
    if (participantId) where.participantId = participantId;

    return this.loanRepo.find({ where });
  }

  @Cron('0 0 * * *')
  async markOverdueLoans() {
    await this.loanRepo
      .createQueryBuilder()
      .update()
      .set({ status: LoanStatus.OVERDUE })
      .where('status = :s', { s: LoanStatus.ACTIVE })
      .andWhere('dueDate < :d', { d: new Date() })
      .execute();
  }
}

/////////////////////////
// FILE: src/loan/dto/apply-loan.dto.ts
/////////////////////////
import {
  IsNumberString,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class ApplyLoanDto {
  @IsNumberString()
  amount: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  purpose?: string;
}

/////////////////////////
// FILE: src/loan/dto/approve-loan.dto.ts
/////////////////////////
import {
  IsDateString,
  IsNumberString,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class ApproveLoanDto {
  /** Admin may override the requested amount at approval time */
  @IsNumberString()
  approvedAmount: string;

  /** ISO 8601 date string e.g. "2025-12-31" */
  @IsDateString()
  dueDate: string;
}

export class RejectLoanDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  rejectionReason?: string;
}

/////////////////////////
// FILE: src/loan/dto/repay-loan.dto.ts
/////////////////////////
import { IsNumberString, IsOptional, IsString, IsUUID } from 'class-validator';

export class RepayLoanDto {
  @IsNumberString()
  amount: string;

  /** Client-supplied idempotency key — prevents double-processing on retries */
  @IsOptional()
  @IsString()
  @IsUUID()
  idempotencyKey?: string;
}

/////////////////////////
// FILE: src/loan/entities/loan-application.entity.ts
/////////////////////////
import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { LoanStatus } from 'src/common/enums/loan.enums';

@Entity('loan_applications')
@Index(['customerId', 'status'])
export class LoanApplication {
  @PrimaryGeneratedColumn('uuid')
  loanId: string;

  @Column()
  @Index()
  customerId: string;

  @Column()
  participantId: string;

  @Column({ type: 'decimal', precision: 18, scale: 4 })
  requestedAmount: string;

  @Column({ type: 'decimal', precision: 18, scale: 4, nullable: true })
  approvedAmount: string;

  @Column({ type: 'decimal', precision: 18, scale: 4, default: '0.0000' })
  outstandingBalance: string;

  @Column({ type: 'enum', enum: LoanStatus, default: LoanStatus.PENDING })
  status: LoanStatus;

  @Column({ type: 'varchar', nullable: true, length: 500 })
  purpose: string | null;

  @Column({ type: 'varchar', nullable: true, length: 500 })
  rejectionReason: string | null;

  @CreateDateColumn()
  appliedAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  reviewedAt: Date | null;

  @Column({ type: 'varchar', nullable: true })
  reviewedBy: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  disbursedAt: Date | null;

  @Column({ type: 'date', nullable: true })
  dueDate: Date | null;

  @Column({ type: 'varchar', nullable: true })
  ledgerJournalId: string | null;
}

/////////////////////////
// FILE: src/loan/entities/loan-repayment.entity.ts
/////////////////////////
import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('loan_repayments')
@Index(['loanId', 'customerId'])
export class LoanRepayment {
  @PrimaryGeneratedColumn('uuid')
  repaymentId: string;

  @Column()
  @Index()
  loanId: string;

  @Column()
  customerId: string;

  @Column()
  participantId: string;

  @Column({ type: 'decimal', precision: 18, scale: 4 })
  amount: string;

  @Column({ type: 'decimal', precision: 18, scale: 4 })
  outstandingBefore: string;

  @Column({ type: 'decimal', precision: 18, scale: 4 })
  outstandingAfter: string;

  @Column()
  ledgerJournalId: string;

  @Column({ type: 'varchar', nullable: true })
  idempotencyKey: string | null;

  @CreateDateColumn()
  repaidAt: Date;
}

/////////////////////////
// FILE: src/payments/payments.module.ts
/////////////////////////
import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { PaymentsService } from './payments.service';

import { Transaction } from './transaction/entities/transaction.entity';
import { BulkBatch } from './bulk/entities/bulk-batch.entity';
import { BulkItem } from './bulk/entities/bulk-item.entity';
import { RTP } from './rtp/entities/rtp.entity';

import { CasModule } from 'src/cas/cas.module';
import { QrModule } from './qr/qr.module';
import { RtpModule } from './rtp/rtp.module';
import { BulkModule } from './bulk/bulk.module';
import { AccountsModule } from 'src/accounts/accounts.module';
import { TransactionModule } from './transaction/transaction.module';
import { VerifyModule } from './verify/verify.module';
import { FundingModule } from './funding/funding.module';
import { LedgerModule } from 'src/ledger/ledger.module';
import { CreditTransferModule } from './credit-transfer/credit-transfer.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Transaction, BulkBatch, BulkItem, RTP]),

    CasModule,
    QrModule,
    RtpModule,
    BulkModule,
    forwardRef(() => AccountsModule),
    TransactionModule,
    VerifyModule,
    FundingModule,
    LedgerModule,
    CreditTransferModule,
  ],
  providers: [PaymentsService],
  exports: [PaymentsService],
})
export class PaymentsModule {}

/////////////////////////
// FILE: src/payments/payments.service.ts
/////////////////////////
import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';

@Injectable()
export class PaymentsService {
  generateReference(prefix = 'TXN'): string {
    return `${prefix}-${randomUUID()}`;
  }

  generateExternalId(prefix = 'EXT'): string {
    return `${prefix}-${randomUUID()}`;
  }

  generateBulkBatchReference(): string {
    return this.generateReference('BULK');
  }

  generateBulkItemReference(): string {
    return this.generateReference('BULK-ITEM');
  }

  generateRtpReference(): string {
    return this.generateReference('RTP');
  }

  generateQrReference(): string {
    return this.generateReference('QR');
  }

  generateCreditTransferReference(): string {
    return this.generateReference('CT');
  }
}

/////////////////////////
// FILE: src/payments/funding/funding.controller.ts
/////////////////////////
import { Controller, Post, Body, UseGuards, Get, Param } from '@nestjs/common';
import { FundingService } from './funding.service';
import { Participant } from 'src/common/decorators/participant/participant.decorator';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { CreateFundingDto } from './dto/create-funding.dto';

@UseGuards(JwtAuthGuard)
@Controller('api/fp/funding')
export class FundingController {
  constructor(private readonly fundingService: FundingService) {}

  @Post('topup')
  topup(@Body() dto: CreateFundingDto, @Participant() participantId: string) {
    return this.fundingService.topup(participantId, dto);
  }

  @Post('withdraw')
  withdraw(
    @Body() dto: CreateFundingDto,
    @Participant() participantId: string,
  ) {
    return this.fundingService.withdraw(participantId, dto);
  }

  @Get()
  findAll(@Participant() participantId: string) {
    return this.fundingService.findAll(participantId);
  }

  @Get(':fundingId')
  findOne(
    @Participant() participantId: string,
    @Param('fundingId') fundingId: string,
  ) {
    return this.fundingService.findOne(participantId, fundingId);
  }
}

/////////////////////////
// FILE: src/payments/funding/funding.module.ts
/////////////////////////
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { FundingController } from './funding.controller';
import { FundingService } from './funding.service';
import { Funding } from './entities/funding.entity';

import { LedgerModule } from 'src/ledger/ledger.module';
import { AccountsModule } from 'src/accounts/accounts.module';
import { WalletModule } from 'src/wallet/wallet.module';
import { ComplianceModule } from 'src/compliance/compliance.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Funding]),
    LedgerModule,
    AccountsModule,
    ComplianceModule,
    WalletModule,
  ],
  controllers: [FundingController],
  providers: [FundingService],
  exports: [FundingService],
})
export class FundingModule {}

/////////////////////////
// FILE: src/payments/funding/funding.service.ts
/////////////////////////
import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import Decimal from 'decimal.js';
import * as crypto from 'crypto';

import { Funding } from './entities/funding.entity';
import { CreateFundingDto } from './dto/create-funding.dto';

import { LedgerService } from 'src/ledger/ledger.service';
import { AccountsService } from 'src/accounts/accounts.service';
import { WalletService } from 'src/wallet/wallet.service';
import { SYSTEM_POOL } from 'src/common/constants';
import { TransactionStatus } from 'src/common/enums/transaction.enums';
import { ComplianceTxnType } from 'src/compliance/enums/compliance.enum';
import { ComplianceService } from 'src/compliance/compliance.service';
import { TransactionType } from 'src/common/enums/transaction.enums';
import { TransactionService } from '../transaction/transaction.service';

@Injectable()
export class FundingService {
  constructor(
    @InjectRepository(Funding)
    private repo: Repository<Funding>,

    private ledger: LedgerService,
    private accounts: AccountsService,
    private walletService: WalletService,
    private complianceService: ComplianceService,
    private transactionService: TransactionService,
    private dataSource: DataSource,
  ) {
    Decimal.set({ precision: 20 });
  }

  // ======================
  // 🔵 TOPUP (CARD/BANK/MM)
  // ======================
  async topup(participantId: string, dto: CreateFundingDto) {
    if (!dto.customerId) {
      throw new BadRequestException('customerId is required');
    }

    const amount = new Decimal(dto.amount);
    if (amount.lte(0)) {
      throw new BadRequestException('Invalid amount');
    }

    await this.complianceService.validate(
      {
        customerId: dto.customerId,
        type: ComplianceTxnType.FUNDING,
        amount: dto.amount,
        currency: dto.currency,
      },
      participantId,
    );

    if (dto.idempotencyKey) {
      const existing = await this.transactionService.findByExternalId(
        dto.idempotencyKey,
      );
      if (existing) return existing;
    }

    return this.dataSource.transaction(async (manager) => {
      // ✅ FIX 1: TYPE SAFE ACCOUNT
      const account = dto.accountId
        ? await this.accounts.findByIdForParticipant(
            dto.accountId,
            participantId,
          )
        : await this.accounts.findCustomerMainAccount(dto.customerId);

      if (!account) {
        throw new NotFoundException('Account not found');
      }
      const source = dto.sourceFinAddress || SYSTEM_POOL;
      await this.accounts.assertFinAddressActive(account.finAddress, manager);

      let tx = await this.transactionService.createTx(manager, {
        participantId,
        channel: TransactionType.CREDIT_TRANSFER,
        customerId: account.customerId,
        senderFinAddress: source,
        receiverFinAddress: account.finAddress,
        amount: Number(amount.toFixed(2)),
        currency: dto.currency,
        status: TransactionStatus.INITIATED,
        externalId: dto.idempotencyKey,
        reference: 'Funding Topup',
      });

      tx = await this.transactionService.updateTx(manager, tx.txId, {
        status: TransactionStatus.PROCESSING,
      });
      const txId = tx.txId;

      // 🔹 External → Account
      let result;

      try {
        result = await this.ledger.postTransfer(
          {
            txId,
            participantId,
            reference: 'Funding Topup',
            postedBy: 'funding',
            currency: dto.currency,
            legs: [
              {
                finAddress: source,
                amount: amount.toFixed(2),
                isCredit: false,
              },
              {
                finAddress: account.finAddress,
                amount: amount.toFixed(2),
                isCredit: true,
              },
            ],
          },
          manager,
        );
      } catch (error) {
        await this.transactionService.updateTx(manager, tx.txId, {
          status: TransactionStatus.FAILED,
          failureReason: error.message,
        });
        throw error;
      }

      // ✅ FIX 2: DECLARE OUTSIDE
      let destinationFinAddress = account.finAddress;
      let walletId: string | undefined = undefined;

      // 🔹 Optional Account → Wallet
      if (dto.walletId) {
        const wallet = await this.walletService.getWallet(
          dto.walletId,
          participantId,
        );

        if (!wallet) {
          throw new NotFoundException('Wallet not found');
        }

        const walletAccount = await this.accounts.findWalletAccount(
          wallet.walletId,
        );

        await this.ledger.postTransfer(
          {
            txId: crypto.randomUUID(),
            participantId,
            reference: 'Wallet Load',
            postedBy: 'funding',
            currency: dto.currency,
            legs: [
              {
                finAddress: account.finAddress,
                amount: amount.toFixed(2),
                isCredit: false,
              },
              {
                finAddress: walletAccount.finAddress,
                amount: amount.toFixed(2),
                isCredit: true,
              },
            ],
          },
          manager,
        );

        // ✅ FIX 3: STORE DESTINATION CORRECTLY
        destinationFinAddress = walletAccount.finAddress;
        walletId = wallet.walletId;
      }

      await this.transactionService.updateTx(manager, tx.txId, {
        status: TransactionStatus.COMPLETED,
        journalId: result.journalId,
        processedAt: new Date(),
      });

      return manager.getRepository(Funding).save(
        manager.getRepository(Funding).create({
          participantId,
          customerId: account.customerId ?? '', // ✅ FIX 4 (avoid undefined)
          accountId: account.accountId,
          walletId,
          sourceFinAddress: source,
          destinationFinAddress,
          amount: amount.toFixed(2),
          currency: dto.currency,
          method: dto.method,
          status: TransactionStatus.COMPLETED,
          journalId: result.journalId,
          idempotencyKey: dto.idempotencyKey,
        }),
      );
    });
  }

  // ======================
  // 🔴 WITHDRAW (ONLY BANK)
  // ======================
  async withdraw(participantId: string, dto: CreateFundingDto) {
    const amount = new Decimal(dto.amount);

    if (!dto.accountId) {
      throw new BadRequestException('accountId required for withdrawal');
    }

    if (!dto.destinationFinAddress) {
      throw new BadRequestException('destinationFinAddress required');
    }

    await this.complianceService.validate(
      {
        customerId: dto.customerId,
        type: ComplianceTxnType.WITHDRAW,
        amount: dto.amount,
        currency: dto.currency,
      },
      participantId,
    );

    if (dto.idempotencyKey) {
      const existing = await this.transactionService.findByExternalId(
        dto.idempotencyKey,
      );
      if (existing) return existing;
    }

    return this.dataSource.transaction(async (manager) => {
      const account = await this.accounts.findByIdForParticipant(
        dto.accountId,
        participantId,
      );

      if (!account) {
        throw new NotFoundException('Account not found');
      }

      let tx = await this.transactionService.createTx(manager, {
        participantId,
        channel: TransactionType.CREDIT_TRANSFER,
        customerId: account.customerId,
        senderFinAddress: account.finAddress,
        receiverFinAddress: dto.destinationFinAddress,
        amount: Number(amount.toFixed(2)),
        currency: dto.currency,
        status: TransactionStatus.INITIATED,
        externalId: dto.idempotencyKey,
        reference: 'Withdraw',
      });

      tx = await this.transactionService.updateTx(manager, tx.txId, {
        status: TransactionStatus.PROCESSING,
      });
      const txId = tx.txId;

      await this.accounts.assertFinAddressActive(account.finAddress, manager);

      let result;
      try {
        result = await this.ledger.postTransfer(
          {
            txId,
            participantId,
            reference: 'Withdraw',
            postedBy: 'funding',
            currency: dto.currency, // ✅ FIXED
            legs: [
              {
                finAddress: account.finAddress,
                amount: amount.toFixed(2),
                isCredit: false,
              },
              {
                finAddress: dto.destinationFinAddress,
                amount: amount.toFixed(2),
                isCredit: true,
              },
            ],
          },
          manager,
        );
      } catch (error) {
        await this.transactionService.updateTx(manager, tx.txId, {
          status: TransactionStatus.FAILED,
          failureReason: error.message,
        });
        throw error;
      }

      await this.transactionService.updateTx(manager, tx.txId, {
        status: TransactionStatus.COMPLETED,
        journalId: result.journalId,
        processedAt: new Date(),
      });

      return manager.getRepository(Funding).save(
        manager.getRepository(Funding).create({
          participantId,
          customerId: account.customerId,
          accountId: account.accountId,
          destinationFinAddress: dto.destinationFinAddress,
          amount: amount.toFixed(2),
          currency: dto.currency,
          method: dto.method,
          status: TransactionStatus.COMPLETED,
          journalId: result.journalId,
          idempotencyKey: dto.idempotencyKey,
        }),
      );
    });
  }

  findAll(participantId: string) {
    return this.repo.find({
      where: { participantId },
      order: { createdAt: 'DESC' },
    });
  }

  findOne(participantId: string, fundingId: string) {
    return this.repo.findOne({
      where: { fundingId, participantId },
    });
  }
}

/////////////////////////
// FILE: src/payments/funding/dto/create-funding.dto.ts
/////////////////////////
import { IsEnum, IsOptional, IsString, Matches } from 'class-validator';
import { FundMethod } from 'src/common/enums/bulk.enums';
import { Currency } from 'src/common/enums/transaction.enums';

export class CreateFundingDto {
  @IsString()
  customerId: string; // ✅ REQUIRED

  @IsOptional()
  @IsString()
  walletId?: string;

  @IsOptional()
  @IsString()
  accountId?: string;

  @IsEnum(FundMethod)
  method: FundMethod;

  @IsString()
  @Matches(/^\d+(\.\d{1,2})?$/)
  amount: string;

  @IsEnum(Currency)
  currency: Currency;

  @IsOptional()
  @IsString()
  sourceFinAddress?: string;

  @IsOptional()
  @IsString()
  destinationFinAddress?: string;

  @IsOptional()
  @IsString()
  idempotencyKey?: string;
}

/////////////////////////
// FILE: src/payments/funding/entities/funding.entity.ts
/////////////////////////
import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import {
  Currency,
  TransactionStatus,
} from 'src/common/enums/transaction.enums';
import { FundMethod } from 'src/common/enums/bulk.enums';

@Entity('funding')
@Index(['participantId', 'customerId'])
@Index(['idempotencyKey'], { unique: true })
export class Funding {
  @PrimaryGeneratedColumn('uuid')
  fundingId: string;

  @Column()
  participantId: string;

  @Column()
  customerId: string;

  @Column({ nullable: true })
  accountId?: string;

  @Column({ nullable: true })
  walletId?: string;

  @Column({ nullable: true })
  sourceFinAddress?: string;

  @Column({ nullable: true })
  destinationFinAddress?: string;

  @Column({ type: 'enum', enum: FundMethod })
  method: FundMethod;

  @Column({ type: 'decimal', precision: 18, scale: 2 })
  amount: string;

  @Column({ type: 'enum', enum: Currency })
  currency: Currency;

  @Column({
    type: 'enum',
    enum: TransactionStatus,
    default: TransactionStatus.INITIATED,
  })
  status: TransactionStatus;

  @Column({ nullable: true })
  journalId?: string;

  @Column({ nullable: true })
  idempotencyKey?: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

/////////////////////////
// FILE: src/payments/bulk/bulk.controller.ts
/////////////////////////
import {
  Controller,
  Post,
  Get,
  Param,
  UploadedFile,
  UseInterceptors,
  Body,
  UseGuards,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { BulkService } from './bulk.service';
import { BulkUploadDto } from './dto/bulk-upload.dto';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { Participant } from 'src/common/decorators/participant/participant.decorator';

@UseGuards(JwtAuthGuard)
@Controller('/api/fp/payments/bulk')
export class BulkController {
  constructor(private readonly bulkService: BulkService) {}

  @Post()
  @UseInterceptors(FileInterceptor('file'))
  upload(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: BulkUploadDto,
    @Participant() participantId: string,
  ) {
    return this.bulkService.processCSV(participantId, dto, file);
  }

  @Get()
  findAll(@Participant() participantId: string) {
    return this.bulkService.findAll(participantId);
  }

  @Get(':bulkId')
  findOne(@Param('bulkId') id: string, @Participant() participantId: string) {
    return this.bulkService.findOne(participantId, id);
  }

  @Get(':bulkId/items')
  findItems(@Param('bulkId') id: string, @Participant() participantId: string) {
    return this.bulkService.findItems(participantId, id);
  }
}

/////////////////////////
// FILE: src/payments/bulk/bulk.module.ts
/////////////////////////
import { Module, forwardRef } from '@nestjs/common';
import { BulkController } from './bulk.controller';
import { BulkService } from './bulk.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BulkBatch } from './entities/bulk-batch.entity';
import { BulkItem } from './entities/bulk-item.entity';
import { Transaction } from '../transaction/entities/transaction.entity';
import { CasModule } from 'src/cas/cas.module';
import { LedgerModule } from 'src/ledger/ledger.module';
import { AccountsModule } from 'src/accounts/accounts.module';
import { WalletModule } from 'src/wallet/wallet.module';
import { CustomerModule } from 'src/customer/customer.module';
import { PaymentsService } from '../payments.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([BulkBatch, BulkItem, Transaction]),
    CasModule,
    LedgerModule,
    AccountsModule,
    forwardRef(() => WalletModule),
    forwardRef(() => CustomerModule),
  ],
  controllers: [BulkController],
  providers: [BulkService, PaymentsService],
  exports: [BulkService],
})
export class BulkModule {}

/////////////////////////
// FILE: src/payments/bulk/bulk.service.ts
/////////////////////////
import csv = require('csv-parser');
import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { Readable } from 'stream';
import Decimal from 'decimal.js';

import { BulkBatch } from './entities/bulk-batch.entity';
import { BulkItem, ItemStatus } from './entities/bulk-item.entity';
import { Transaction } from '../transaction/entities/transaction.entity';

import { CasService } from 'src/cas/cas.service';
import { AliasType } from 'src/common/enums/alias.enums';
import { BulkStatus } from 'src/common/enums/bulk.enums';
import {
  Currency,
  TransactionStatus,
  TransactionType,
} from 'src/common/enums/transaction.enums';
import { LedgerService } from 'src/ledger/ledger.service';
import { AccountsService } from 'src/accounts/accounts.service';
import { WalletService } from 'src/wallet/wallet.service';
import { CustomerService } from 'src/customer/customer.service';
import { PaymentsService } from '../payments.service';
import { BulkUploadDto } from './dto/bulk-upload.dto';

type ParsedBulkRow = {
  senderAlias: string;
  receiverAlias: string;
  amount: string;
  aliasType?: AliasType;
  reference?: string;
  narration?: string;
};

type ResolvedBulkSource = {
  sourceType: 'ACCOUNT' | 'WALLET';
  customerId?: string;
  senderAlias: string;
  senderFinAddress: string;
  sourceAccountId?: string | null;
  sourceWalletId?: string | null;
};

@Injectable()
export class BulkService {
  constructor(
    @InjectRepository(BulkBatch)
    private readonly batchRepo: Repository<BulkBatch>,

    @InjectRepository(BulkItem)
    private readonly itemRepo: Repository<BulkItem>,

    @InjectRepository(Transaction)
    private readonly txRepo: Repository<Transaction>,

    private readonly cas: CasService,
    private readonly ledgerService: LedgerService,
    private readonly accountsService: AccountsService,

    @Inject(forwardRef(() => WalletService))
    private readonly walletService: WalletService,

    @Inject(forwardRef(() => CustomerService))
    private readonly customerService: CustomerService,

    private readonly paymentsService: PaymentsService,
    private readonly dataSource: DataSource,
  ) {
    Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });
  }

  async processCSV(
    participantId: string,
    dto: BulkUploadDto,
    file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('CSV file is missing');
    }

    if (dto.currency !== Currency.SLE) {
      throw new BadRequestException('Only SLE currency is supported');
    }

    const rows = await this.parseCsv(file.buffer);
    const schemaErrors = this.validateCsvSchema(rows);

    if (schemaErrors.length > 0) {
      throw new BadRequestException(
        `CSV schema invalid: ${schemaErrors.join('; ')}`,
      );
    }

    return this.dataSource.transaction('SERIALIZABLE', async (manager) => {
      const source = await this.resolveSource(participantId, dto, manager);

      if (source.sourceType === 'WALLET') {
        const wallet = await this.walletService.getWallet(
          source.sourceWalletId!,
          participantId,
        );

        if (!wallet) {
          throw new NotFoundException('Wallet not found');
        }

        await this.walletService.verifyPinWithLock(
          wallet,
          participantId,
          dto.pin,
        );
      } else if (source.customerId) {
        await this.customerService.verifyPin(
          source.customerId,
          participantId,
          dto.pin,
        );
      }

      await this.accountsService.assertFinAddressActive(
        source.senderFinAddress,
        manager,
      );

      const totalAmount = rows.reduce(
        (sum, row) => sum.add(new Decimal(row.amount)),
        new Decimal(0),
      );

      const batch = await manager.getRepository(BulkBatch).save(
        manager.getRepository(BulkBatch).create({
          participantId,
          customerId: source.customerId,
          debtorBic: dto.debtorBic,
          sourceType: source.sourceType,
          sourceAccountId: source.sourceAccountId ?? undefined,
          sourceWalletId: source.sourceWalletId ?? undefined,
          sourceFinAddress: source.senderFinAddress,
          fileName: file.originalname,
          currency: Currency.SLE,
          totalRecords: rows.length,
          processedRecords: 0,
          failedRecords: 0,
          totalAmount: totalAmount.toFixed(2),
          processedAmount: '0.00',
          status: BulkStatus.PROCESSING,
          uploadedBy: source.customerId || 'system',
        }),
      );

      let processedAmount = new Decimal(0);
      let processedRecords = 0;
      let failedRecords = 0;

      for (const row of rows) {
        const aliasType: AliasType = row.aliasType ?? AliasType.MSISDN;
        const amount = new Decimal(row.amount);

        try {
          const receiver = await this.cas.resolveAlias(
            aliasType,
            row.receiverAlias,
          );

          if (receiver.finAddress === source.senderFinAddress) {
            throw new BadRequestException('Sender and receiver cannot be same');
          }

          await this.accountsService.assertFinAddressActive(
            receiver.finAddress,
            manager,
          );

          const tx = await manager.getRepository(Transaction).save(
            manager.getRepository(Transaction).create({
              participantId,
              channel: TransactionType.BULK_PAYMENT,
              senderAlias: row.senderAlias || source.senderAlias,
              receiverAlias: row.receiverAlias,
              senderFinAddress: source.senderFinAddress,
              receiverFinAddress: receiver.finAddress,
              amount: Number(amount.toFixed(2)),
              currency: Currency.SLE,
              status: TransactionStatus.INITIATED,
              reference:
                row.reference ||
                `BULK-${batch.bulkId}-${processedRecords + failedRecords + 1}`,
              externalId: this.paymentsService.generateReference(),
            }),
          );

          try {
            await this.ledgerService.postTransfer(
              {
                txId: tx.txId,
                idempotencyKey: dto.idempotencyKey
                  ? `${dto.idempotencyKey}:${processedRecords + failedRecords + 1}`
                  : undefined,
                reference: tx.reference ?? `BULK-${batch.bulkId}`,
                participantId,
                postedBy: 'bulk-service',
                currency: Currency.SLE,
                legs: [
                  {
                    finAddress: tx.senderFinAddress,
                    amount: amount.toFixed(2),
                    isCredit: false,
                    memo:
                      row.narration?.trim() ||
                      `Bulk payment to ${tx.receiverAlias}`,
                  },
                  {
                    finAddress: tx.receiverFinAddress,
                    amount: amount.toFixed(2),
                    isCredit: true,
                    memo:
                      row.narration?.trim() ||
                      `Bulk payment from ${tx.senderAlias}`,
                  },
                ],
              },
              manager,
            );

            tx.status = TransactionStatus.COMPLETED;
            await manager.getRepository(Transaction).save(tx);

            await manager.getRepository(BulkItem).save(
              manager.getRepository(BulkItem).create({
                bulkId: batch.bulkId,
                txId: tx.txId,
                senderAlias: tx.senderAlias,
                receiverAlias: tx.receiverAlias,
                receiverFinAddress: tx.receiverFinAddress,
                amount: amount.toFixed(2),
                currency: Currency.SLE,
                status: ItemStatus.SUCCESS,
                uploadedBy: source.customerId || 'system',
              }),
            );

            processedRecords += 1;
            processedAmount = processedAmount.add(amount);
          } catch (transferError: any) {
            tx.status = TransactionStatus.FAILED;
            await manager.getRepository(Transaction).save(tx);

            await manager.getRepository(BulkItem).save(
              manager.getRepository(BulkItem).create({
                bulkId: batch.bulkId,
                txId: tx.txId,
                senderAlias: tx.senderAlias,
                receiverAlias: tx.receiverAlias,
                receiverFinAddress: tx.receiverFinAddress,
                amount: amount.toFixed(2),
                currency: Currency.SLE,
                status: ItemStatus.FAILED,
                errorMessage:
                  transferError?.message || 'Ledger transfer failed',
                uploadedBy: source.customerId || 'system',
              }),
            );

            failedRecords += 1;
          }
        } catch (error: any) {
          await manager.getRepository(BulkItem).save(
            manager.getRepository(BulkItem).create({
              bulkId: batch.bulkId,
              senderAlias: row.senderAlias || source.senderAlias,
              receiverAlias: row.receiverAlias,
              amount: amount.toFixed(2),
              currency: Currency.SLE,
              status: ItemStatus.FAILED,
              errorMessage: error?.message || 'Bulk item failed',
              uploadedBy: source.customerId || 'system',
            }),
          );

          failedRecords += 1;
        }
      }

      batch.processedRecords = processedRecords;
      batch.failedRecords = failedRecords;
      batch.processedAmount = processedAmount.toFixed(2);

      if (failedRecords === 0) {
        batch.status = BulkStatus.COMPLETED;
      } else if (processedRecords === 0) {
        batch.status = BulkStatus.FAILED;
      } else {
        batch.status = BulkStatus.PARTIAL;
      }

      await manager.getRepository(BulkBatch).save(batch);

      return {
        bulkId: batch.bulkId,
        status: batch.status,
        processed: batch.processedRecords,
        failed: batch.failedRecords,
        totalAmount: batch.totalAmount,
        processedAmount: batch.processedAmount,
        sourceFinAddress: batch.sourceFinAddress,
      };
    });
  }

  private validateCsvSchema(rows: ParsedBulkRow[]): string[] {
    if (!rows || rows.length === 0) {
      return ['CSV file is empty'];
    }

    const errors: string[] = [];

    rows.forEach((row, i) => {
      const rowNum = i + 2;

      for (const field of ['senderAlias', 'receiverAlias', 'amount']) {
        if (
          !row[field as keyof ParsedBulkRow] ||
          String(row[field as keyof ParsedBulkRow]).trim() === ''
        ) {
          errors.push(`Row ${rowNum}: missing required field '${field}'`);
        }
      }

      if (
        row.amount &&
        (!/^\d+(\.\d{1,2})?$/.test(String(row.amount)) ||
          new Decimal(row.amount).lte(0))
      ) {
        errors.push(
          `Row ${rowNum}: 'amount' must be a positive number with up to 2 decimals`,
        );
      }
    });

    return errors;
  }

  private parseCsv(buffer: Buffer): Promise<ParsedBulkRow[]> {
    return new Promise((resolve, reject) => {
      const rows: ParsedBulkRow[] = [];

      Readable.from(buffer)
        .pipe(csv())
        .on('data', (data) =>
          rows.push({
            senderAlias: String(data.senderAlias ?? '').trim(),
            receiverAlias: String(data.receiverAlias ?? '').trim(),
            amount: String(data.amount ?? '').trim(),
            aliasType: data.aliasType
              ? (String(data.aliasType).trim() as AliasType)
              : undefined,
            reference: data.reference
              ? String(data.reference).trim()
              : undefined,
            narration: data.narration
              ? String(data.narration).trim()
              : undefined,
          }),
        )
        .on('end', () => resolve(rows))
        .on('error', reject);
    });
  }

  async findAll(participantId: string) {
    return this.batchRepo.find({
      where: { participantId },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(participantId: string, bulkId: string) {
    const batch = await this.batchRepo.findOne({
      where: { bulkId, participantId },
    });

    if (!batch) {
      throw new NotFoundException(`Batch ${bulkId} not found`);
    }

    return batch;
  }

  async findItems(participantId: string, bulkId: string) {
    const batch = await this.batchRepo.findOne({
      where: { bulkId, participantId },
      select: ['bulkId'],
    });

    if (!batch) {
      throw new NotFoundException(`Batch ${bulkId} not found`);
    }

    return this.itemRepo.find({
      where: { bulkId },
      order: { itemId: 'ASC' },
    });
  }

  private async resolveSource(
    participantId: string,
    dto: BulkUploadDto,
    manager: EntityManager,
  ): Promise<ResolvedBulkSource> {
    if (dto.sourceType === 'WALLET') {
      if (!dto.sourceWalletId) {
        throw new BadRequestException(
          'sourceWalletId is required for wallet source',
        );
      }

      const wallet = await this.walletService.getWallet(
        dto.sourceWalletId,
        participantId,
      );

      if (!wallet) {
        throw new NotFoundException('Wallet not found');
      }

      return {
        sourceType: 'WALLET',
        customerId: wallet.customerId,
        senderAlias: wallet.customerId,
        senderFinAddress: wallet.finAddress,
        sourceWalletId: wallet.walletId,
        sourceAccountId: wallet.accountId,
      };
    }

    if (!dto.sourceFinAddress) {
      throw new BadRequestException(
        'sourceFinAddress is required for account source',
      );
    }

    return {
      sourceType: 'ACCOUNT',
      customerId: dto.customerId,
      senderAlias: dto.customerId || dto.sourceFinAddress,
      senderFinAddress: dto.sourceFinAddress,
      sourceAccountId: dto.sourceAccountId ?? null,
    };
  }
}

/////////////////////////
// FILE: src/payments/bulk/dto/bulk-payment.dto.ts
/////////////////////////
import {
  IsArray,
  IsString,
  IsNumber,
  IsPositive,
  ValidateNested,
  IsEnum,
} from 'class-validator';
import { Type } from 'class-transformer';
import { Currency } from 'src/common/enums/transaction.enums';

export class BulkPaymentItem {
  @IsString()
  senderAlias: string;

  @IsString()
  receiverAlias: string;

  @IsNumber()
  @IsPositive()
  amount: number;

  @IsEnum(Currency) // Validates against SLE, USD, EUR, INR
  currency: Currency;
}

export class BulkPaymentDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BulkPaymentItem)
  payments: BulkPaymentItem[];
}

/////////////////////////
// FILE: src/payments/bulk/dto/bulk-upload.dto.ts
/////////////////////////
import {
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  Length,
  Matches,
} from 'class-validator';
import { Currency } from 'src/common/enums/transaction.enums';

export class BulkUploadDto {
  @IsOptional()
  @IsString()
  customerId?: string;

  @IsOptional()
  @IsString()
  debtorBic?: string;

  @IsIn(['ACCOUNT', 'WALLET'])
  sourceType: 'ACCOUNT' | 'WALLET';

  @IsOptional()
  @IsString()
  sourceAccountId?: string;

  @IsOptional()
  @IsString()
  sourceWalletId?: string;

  @IsOptional()
  @IsString()
  sourceFinAddress?: string;

  @IsEnum(Currency)
  currency: Currency;

  @IsString()
  @Length(4, 6)
  @Matches(/^\d{4,6}$/)
  pin: string;

  @IsOptional()
  @IsString()
  idempotencyKey?: string;
}

/////////////////////////
// FILE: src/payments/bulk/entities/bulk-batch.entity.ts
/////////////////////////
import { BulkStatus } from 'src/common/enums/bulk.enums';
import {
  Column,
  CreateDateColumn,
  PrimaryGeneratedColumn,
  Entity,
  Index,
  UpdateDateColumn,
} from 'typeorm';

@Entity('bulk_batches')
@Index(['participantId', 'status'])
export class BulkBatch {
  @PrimaryGeneratedColumn('uuid')
  bulkId: string;

  @Index()
  @Column()
  participantId: string;

  @Column({ nullable: true })
  customerId?: string;

  @Column({ nullable: true })
  debtorBic?: string;

  @Column()
  sourceType: 'ACCOUNT' | 'WALLET';

  @Column({ nullable: true })
  sourceAccountId?: string;

  @Column({ nullable: true })
  sourceWalletId?: string;

  @Column()
  sourceFinAddress: string;

  @Column()
  fileName: string;

  @Column({ type: 'enum', enum: ['SLE'], default: 'SLE' })
  currency: 'SLE';

  @Column({ default: 0 })
  totalRecords: number;

  @Column({ default: 0 })
  processedRecords: number;

  @Column({ default: 0 })
  failedRecords: number;

  @Column({
    type: 'decimal',
    precision: 18,
    scale: 2,
    default: '0.00',
  })
  totalAmount: string;

  @Column({
    type: 'decimal',
    precision: 18,
    scale: 2,
    default: '0.00',
  })
  processedAmount: string;

  @Column({
    type: 'enum',
    enum: BulkStatus,
    default: BulkStatus.PENDING,
  })
  status: BulkStatus;

  @Column({ nullable: true })
  uploadedBy?: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn({ nullable: true })
  updatedAt: Date;
}

/////////////////////////
// FILE: src/payments/bulk/entities/bulk-item.entity.ts
/////////////////////////
import { Currency } from 'src/common/enums/transaction.enums';
import { Column, PrimaryGeneratedColumn, Entity, Index } from 'typeorm';

export enum ItemStatus {
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
}

@Entity('bulk_items')
@Index(['bulkId', 'status'])
export class BulkItem {
  @PrimaryGeneratedColumn('uuid')
  itemId: string;

  @Index()
  @Column()
  bulkId: string;

  @Column({ nullable: true })
  txId?: string;

  @Column()
  senderAlias: string;

  @Column()
  receiverAlias: string;

  @Column({ nullable: true })
  receiverFinAddress?: string;

  @Column({ type: 'decimal', precision: 18, scale: 2, default: '0.00' })
  amount: string;

  @Column({ type: 'enum', enum: Currency, default: Currency.SLE })
  currency: Currency;

  @Column({ type: 'enum', enum: ItemStatus, default: ItemStatus.FAILED })
  status: ItemStatus;

  @Column({ nullable: true })
  errorMessage?: string;

  @Column({ nullable: true })
  uploadedBy?: string;
}

/////////////////////////
// FILE: src/payments/qr/qr.controller.ts
/////////////////////////
import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { QrService } from './qr.service';
import { QrPaymentDto } from './dto/qr-payment.dto';
import { QrGenerateDto } from './dto/qr-generate.dto';
import { Participant } from 'src/common/decorators/participant/participant.decorator';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('/api/fp/payments')
export class QrController {
  constructor(private readonly qrs: QrService) {}

  @Post('qr/generate')
  generateQR(@Body() dto: QrGenerateDto) {
    return this.qrs.createQR(dto);
  }

  @Post('qr/decode')
  decodeQR(@Body('qrPayload') qrPayload: string) {
    return this.qrs.decode(qrPayload);
  }

  @Post('qr')
  initiate(@Body() dto: QrPaymentDto, @Participant() participantId: string) {
    return this.qrs.process(participantId, dto);
  }
}

/////////////////////////
// FILE: src/payments/qr/qr.module.ts
/////////////////////////
import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Transaction } from '../transaction/entities/transaction.entity';
import { QrController } from './qr.controller';
import { QrService } from './qr.service';
import { CasModule } from 'src/cas/cas.module';
import { LedgerModule } from 'src/ledger/ledger.module';
import { AccountsModule } from 'src/accounts/accounts.module';
import { WalletModule } from 'src/wallet/wallet.module';
import { CustomerModule } from 'src/customer/customer.module';
import { PaymentsService } from '../payments.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Transaction]),
    CasModule,
    LedgerModule,
    AccountsModule,
    forwardRef(() => WalletModule),
    forwardRef(() => CustomerModule),
  ],
  controllers: [QrController],
  providers: [QrService, PaymentsService],
  exports: [QrService],
})
export class QrModule {}

/////////////////////////
// FILE: src/payments/qr/qr.service.ts
/////////////////////////
import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import Decimal from 'decimal.js';
import * as QRCode from 'qrcode';

import { Transaction } from '../transaction/entities/transaction.entity';
import { QrPaymentDto } from './dto/qr-payment.dto';
import { QrGenerateDto } from './dto/qr-generate.dto';

import { CasService } from 'src/cas/cas.service';
import { LedgerService } from 'src/ledger/ledger.service';
import { AccountsService } from 'src/accounts/accounts.service';
import { WalletService } from 'src/wallet/wallet.service';
import { CustomerService } from 'src/customer/customer.service';
import { PaymentsService } from '../payments.service';

import { AliasType } from 'src/common/enums/alias.enums';
import {
  Currency,
  TransactionStatus,
  TransactionType,
} from 'src/common/enums/transaction.enums';

type ParsedQrPayload = {
  aliasType: AliasType;
  aliasValue: string;
  amount?: string;
  currency?: Currency;
  merchantName?: string;
  reference?: string;
};

type ResolvedQrSource = {
  sourceType: 'ACCOUNT' | 'WALLET';
  customerId?: string;
  senderAlias: string;
  senderFinAddress: string;
  sourceAccountId?: string | null;
  sourceWalletId?: string | null;
};

@Injectable()
export class QrService {
  constructor(
    @InjectRepository(Transaction)
    private readonly txRepo: Repository<Transaction>,

    private readonly ledgerService: LedgerService,
    private readonly cas: CasService,
    private readonly accountsService: AccountsService,

    @Inject(forwardRef(() => WalletService))
    private readonly walletService: WalletService,

    @Inject(forwardRef(() => CustomerService))
    private readonly customerService: CustomerService,

    private readonly paymentsService: PaymentsService,
    private readonly dataSource: DataSource,
  ) {
    Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });
  }

  async decode(qrPayload: string) {
    const parsedData = this.parseQrString(qrPayload);

    if (!parsedData.aliasType || !parsedData.aliasValue) {
      throw new BadRequestException('QR missing alias information');
    }

    const merchant = await this.cas.resolveAlias(
      parsedData.aliasType,
      parsedData.aliasValue,
    );

    return {
      merchantName: parsedData.merchantName || parsedData.aliasValue,
      merchantAccount: merchant.finAddress,
      amount: parsedData.amount || null,
      currency: parsedData.currency || Currency.SLE,
      reference: parsedData.reference || null,
      qrPayload,
    };
  }

  async process(participantId: string, dto: QrPaymentDto) {
    return this.dataSource.transaction('SERIALIZABLE', async (manager) => {
      const parsedData = this.parseQrString(dto.qrPayload);

      const merchant = await this.cas.resolveAlias(
        parsedData.aliasType,
        parsedData.aliasValue,
      );

      const source = await this.resolveSource(participantId, dto, manager);

      if (source.senderFinAddress === merchant.finAddress) {
        throw new BadRequestException('Sender and receiver cannot be same');
      }

      const finalAmount = dto.amount || parsedData.amount;
      if (!finalAmount) {
        throw new BadRequestException('Payment amount required');
      }

      const amount = new Decimal(finalAmount);
      if (amount.isNaN() || amount.lte(0)) {
        throw new BadRequestException('Invalid payment amount');
      }

      const currency = dto.currency || parsedData.currency || Currency.SLE;
      if (currency !== Currency.SLE) {
        throw new BadRequestException('Only SLE currency is supported');
      }

      if (dto.pin && source.sourceType === 'WALLET') {
        const wallet = await this.walletService.getWallet(
          source.sourceWalletId!,
          participantId,
        );

        if (!wallet) {
          throw new NotFoundException('Wallet not found');
        }

        await this.walletService.verifyPinWithLock(
          wallet,
          participantId,
          dto.pin,
        );
      }

      if (dto.pin && source.sourceType === 'ACCOUNT' && source.customerId) {
        await this.customerService.verifyPin(
          source.customerId,
          participantId,
          dto.pin,
        );
      }

      await this.accountsService.assertFinAddressActive(
        source.senderFinAddress,
        manager,
      );
      await this.accountsService.assertFinAddressActive(
        merchant.finAddress,
        manager,
      );

      const tx = manager.getRepository(Transaction).create({
        participantId,
        channel: TransactionType.QR_PAYMENT,
        senderAlias: source.senderAlias,
        senderFinAddress: source.senderFinAddress,
        receiverFinAddress: merchant.finAddress,
        receiverAlias: parsedData.aliasValue,
        amount: Number(amount.toFixed(2)),
        currency,
        status: TransactionStatus.INITIATED,
        reference:
          dto.reference ||
          parsedData.reference ||
          `QR Payment to ${parsedData.aliasValue}`,
        externalId:
          dto.idempotencyKey || this.paymentsService.generateReference(),
      });

      const savedTx = await manager.getRepository(Transaction).save(tx);

      try {
        const transferResult = await this.ledgerService.postTransfer(
          {
            txId: savedTx.txId,
            idempotencyKey: dto.idempotencyKey,
            reference: savedTx.reference ?? `QR-${savedTx.txId}`,
            participantId,
            postedBy: 'qr-service',
            currency,
            legs: [
              {
                finAddress: savedTx.senderFinAddress,
                amount: amount.toFixed(2),
                isCredit: false,
                memo:
                  dto.narration?.trim() ||
                  `QR payment to ${savedTx.receiverAlias}`,
              },
              {
                finAddress: savedTx.receiverFinAddress,
                amount: amount.toFixed(2),
                isCredit: true,
                memo:
                  dto.narration?.trim() ||
                  `QR payment from ${savedTx.senderAlias}`,
              },
            ],
          },
          manager,
        );

        savedTx.status = TransactionStatus.COMPLETED;
        await manager.getRepository(Transaction).save(savedTx);

        const [senderBalance, receiverBalance] = await Promise.all([
          this.ledgerService.getDerivedBalance(savedTx.senderFinAddress),
          this.ledgerService.getDerivedBalance(savedTx.receiverFinAddress),
        ]);

        return {
          status: 'success',
          txId: savedTx.txId,
          journalId: transferResult.journalId,
          senderFinAddress: savedTx.senderFinAddress,
          receiverFinAddress: savedTx.receiverFinAddress,
          senderBalance,
          receiverBalance,
        };
      } catch (error) {
        savedTx.status = TransactionStatus.FAILED;
        await manager.getRepository(Transaction).save(savedTx);
        throw error;
      }
    });
  }

  async createQR(dto: QrGenerateDto) {
    if (dto.currency && dto.currency !== Currency.SLE) {
      throw new BadRequestException('Only SLE currency is supported');
    }

    if (dto.amount) {
      const amount = new Decimal(dto.amount);
      if (amount.isNaN() || amount.lte(0)) {
        throw new BadRequestException('Invalid QR amount');
      }
    }

    const payload = JSON.stringify({
      aliasType: dto.aliasType,
      aliasValue: dto.aliasValue,
      amount: dto.amount,
      currency: dto.currency || Currency.SLE,
      merchantName: dto.merchantName,
      reference: dto.reference,
    });

    const qrImage = await QRCode.toDataURL(payload);

    return {
      payload,
      qrImage,
      generatedAt: new Date(),
    };
  }

  private async resolveSource(
    participantId: string,
    dto: QrPaymentDto,
    manager: EntityManager,
  ): Promise<ResolvedQrSource> {
    if (dto.sourceType === 'WALLET') {
      if (!dto.sourceWalletId) {
        throw new BadRequestException(
          'sourceWalletId is required for wallet source',
        );
      }

      const wallet = await this.walletService.getWallet(
        dto.sourceWalletId,
        participantId,
      );

      if (!wallet) {
        throw new NotFoundException('Wallet not found');
      }

      return {
        sourceType: 'WALLET',
        customerId: wallet.customerId,
        senderAlias: dto.senderAlias || wallet.customerId,
        senderFinAddress: wallet.finAddress,
        sourceWalletId: wallet.walletId,
        sourceAccountId: wallet.accountId,
      };
    }

    if (dto.sourceFinAddress) {
      await this.accountsService.assertFinAddressActive(
        dto.sourceFinAddress,
        manager,
      );

      return {
        sourceType: 'ACCOUNT',
        customerId: dto.customerId,
        senderAlias: dto.senderAlias || dto.customerId || dto.sourceFinAddress,
        senderFinAddress: dto.sourceFinAddress,
        sourceAccountId: dto.sourceAccountId ?? null,
      };
    }

    throw new BadRequestException(
      'Provide sourceFinAddress for ACCOUNT source or sourceWalletId for WALLET source',
    );
  }

  private parseQrString(payload: string): ParsedQrPayload {
    try {
      const parsed: unknown = JSON.parse(payload);

      if (
        typeof parsed === 'object' &&
        parsed !== null &&
        'aliasType' in parsed &&
        'aliasValue' in parsed
      ) {
        return parsed as ParsedQrPayload;
      }

      throw new BadRequestException('Invalid QR payload');
    } catch {
      throw new BadRequestException('Invalid QR Payload format');
    }
  }
}

/////////////////////////
// FILE: src/payments/qr/dto/qr-generate.dto.ts
/////////////////////////
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { AliasType } from 'src/common/enums/alias.enums';
import { Currency } from 'src/common/enums/transaction.enums';

export class QrGenerateDto {
  @IsEnum(AliasType)
  aliasType: AliasType;

  @IsString()
  @IsNotEmpty()
  aliasValue: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d+(\.\d{1,2})?$/)
  amount?: string;

  @IsOptional()
  @IsEnum(Currency)
  currency?: Currency;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  merchantName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(140)
  reference?: string;
}

/////////////////////////
// FILE: src/payments/qr/dto/qr-payment.dto.ts
/////////////////////////
import {
  IsEnum,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
} from 'class-validator';
import { Currency } from 'src/common/enums/transaction.enums';

export class QrPaymentDto {
  @IsString()
  @IsNotEmpty()
  qrPayload: string;

  @IsOptional()
  @IsString()
  customerId?: string;

  @IsIn(['ACCOUNT', 'WALLET'])
  sourceType: 'ACCOUNT' | 'WALLET';

  @IsOptional()
  @IsString()
  sourceAccountId?: string;

  @IsOptional()
  @IsString()
  sourceWalletId?: string;

  @IsOptional()
  @IsString()
  sourceFinAddress?: string;

  @IsOptional()
  @IsString()
  senderAlias?: string;

  @IsOptional()
  @IsString()
  debtorName?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d+(\.\d{1,2})?$/)
  amount?: string;

  @IsOptional()
  @IsEnum(Currency)
  currency?: Currency;

  @IsOptional()
  @IsString()
  @MaxLength(140)
  reference?: string;

  @IsOptional()
  @IsString()
  narration?: string;

  @IsOptional()
  @IsString()
  @Length(4, 6)
  @Matches(/^\d{4,6}$/)
  pin?: string;

  @IsOptional()
  @IsString()
  idempotencyKey?: string;
}

/////////////////////////
// FILE: src/payments/transaction/transaction.controller.ts
/////////////////////////
import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { TransactionService } from './transaction.service';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import {
  Currency,
  TransactionStatus,
  TransactionType,
} from 'src/common/enums/transaction.enums';
import { Participant } from 'src/common/decorators/participant/participant.decorator';

@UseGuards(JwtAuthGuard)
@Controller('/api/fp/transactions')
export class TransactionController {
  constructor(private readonly txService: TransactionService) {}

  @Get()
  async findAll(
    @Participant() participantId: string,
    @Query('pageNo') pageNo: number = 1,
    @Query('pageSize') pageSize: number = 20,
    @Query('status') status?: TransactionStatus,
    @Query('channel') channel?: TransactionType,
    @Query('currency') currency?: Currency,
    @Query('customerId') customerId?: string,
    @Query('finAddress') finAddress?: string,
  ) {
    return this.txService.findAll({
      participantId,
      pageNo: Number(pageNo),
      pageSize: Number(pageSize),
      status,
      channel,
      currency,
      customerId,
      finAddress,
    });
  }

  @Get(':txId')
  async findOne(
    @Participant() participantId: string,
    @Param('txId') txId: string,
  ) {
    return this.txService.findOne(participantId, txId);
  }
}

/////////////////////////
// FILE: src/payments/transaction/transaction.module.ts
/////////////////////////
import { Module } from '@nestjs/common';
import { TransactionController } from './transaction.controller';
import { TransactionService } from './transaction.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Transaction } from './entities/transaction.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Transaction])],
  controllers: [TransactionController],
  providers: [TransactionService],
  exports: [TransactionService],
})
export class TransactionModule {}

/////////////////////////
// FILE: src/payments/transaction/transaction.service.ts
/////////////////////////
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Transaction } from './entities/transaction.entity';
import { EntityManager, Repository } from 'typeorm';
import {
  Currency,
  TransactionStatus,
  TransactionType,
} from 'src/common/enums/transaction.enums';
import { Cron } from '@nestjs/schedule';

type FindAllParams = {
  participantId: string;
  pageNo?: number;
  pageSize?: number;
  status?: TransactionStatus;
  channel?: TransactionType;
  currency?: Currency;
  customerId?: string;
  finAddress?: string;
};

@Injectable()
export class TransactionService {
  constructor(
    @InjectRepository(Transaction)
    private readonly txRepo: Repository<Transaction>,
  ) {}

  async createTx(manager, data: Partial<Transaction>) {
    const repo = manager ? manager.getRepository(Transaction) : this.txRepo;
    return repo.save(repo.create(data));
  }

  async updateTx(
    manager: EntityManager,
    txId: string,
    participantId: string,
    updates: Partial<Transaction>,
  ) {
    const repo = manager ? manager.getRepository(Transaction) : this.txRepo;
    const tx = await repo.findOne({ where: { txId, participantId } });

    if (!tx) throw new NotFoundException('Transaction not found');

    Object.assign(tx, updates);

    if (updates.status === TransactionStatus.COMPLETED) {
      tx.processedAt = new Date();
    }

    return repo.save(tx);
  }

  async findByExternalId(externalId: string, participantId: string) {
    return this.txRepo.findOne({
      where: { externalId, participantId },
    });
  }

  async fixStuckTransactions() {
    const timeout = new Date(Date.now() - 5 * 60 * 1000); // 5 min

    const stuck = await this.txRepo.find({
      where: { status: TransactionStatus.PROCESSING },
    });

    for (const tx of stuck) {
      if (!tx.journalId && tx.createdAt < timeout) {
        tx.status = TransactionStatus.FAILED;
        tx.failureReason = 'Timeout Incomplete Transaction';
        tx.processedAt = new Date();
        await this.txRepo.save(tx);
      }
    }
  }

  @Cron('*/2 * * * *') // every 2 minutes
  async handleStuckTxCron() {
    await this.fixStuckTransactions();
  }

  async findOne(participantId: string, txId: string) {
    const tx = await this.txRepo.findOne({
      where: { txId, participantId },
    });

    if (!tx) {
      throw new NotFoundException(`Transaction ${txId} does not exist.`);
    }

    return tx;
  }

  async findAll(params: FindAllParams) {
    const {
      participantId,
      pageNo = 1,
      pageSize = 20,
      status,
      channel,
      currency,
      customerId,
      finAddress,
    } = params;

    const qb = this.txRepo.createQueryBuilder('tx');

    qb.where('tx.participantId = :participantId', { participantId });

    if (status) {
      qb.andWhere('tx.status = :status', { status });
    }

    if (channel) {
      qb.andWhere('tx.channel = :channel', { channel });
    }

    if (currency) {
      qb.andWhere('tx.currency = :currency', { currency });
    }

    if (customerId) {
      qb.andWhere('tx.customerId = :customerId', { customerId });
    }

    if (finAddress) {
      qb.andWhere(
        '(tx.senderFinAddress = :finAddress OR tx.receiverFinAddress = :finAddress)',
        { finAddress },
      );
    }

    qb.orderBy('tx.createdAt', 'DESC')
      .skip((pageNo - 1) * pageSize)
      .take(pageSize);

    const [data, total] = await qb.getManyAndCount();

    return {
      pageNo: Number(pageNo),
      pageSize: Number(pageSize),
      total,
      totalPages: Math.ceil(total / pageSize),
      data,
    };
  }
}

/////////////////////////
// FILE: src/payments/transaction/entities/transaction.entity.ts
/////////////////////////
import {
  Currency,
  TransactionType,
  TransactionStatus,
} from 'src/common/enums/transaction.enums';
import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('transactions')
@Index(['participantId', 'status', 'createdAt'])
@Index(['participantId', 'channel', 'createdAt'])
@Index(['senderFinAddress', 'createdAt'])
@Index(['receiverFinAddress', 'createdAt'])
@Index(['externalId'], { unique: true })
export class Transaction {
  @PrimaryGeneratedColumn('uuid')
  txId: string;

  @Column()
  participantId: string;

  @Column({ type: 'enum', enum: TransactionType })
  channel: TransactionType;

  @Column({ nullable: true })
  customerId?: string;

  @Column({ nullable: true })
  senderAlias?: string;

  @Column({ nullable: true })
  receiverAlias?: string;

  @Column()
  senderFinAddress: string;

  @Column()
  receiverFinAddress: string;

  @Column({ nullable: true })
  sourceType?: 'ACCOUNT' | 'WALLET';

  @Column({ nullable: true })
  sourceAccountId?: string;

  @Column({ nullable: true })
  sourceWalletId?: string;

  @Column({ nullable: true })
  destinationType?: 'ACCOUNT' | 'WALLET';

  @Column({ nullable: true })
  destinationAccountId?: string;

  @Column({ nullable: true })
  destinationWalletId?: string;

  @Column({ type: 'decimal', precision: 18, scale: 2, default: '0.00' })
  amount: number;

  @Column({ type: 'enum', enum: Currency, default: Currency.SLE })
  currency: Currency;

  @Column({
    type: 'enum',
    enum: TransactionStatus,
    default: TransactionStatus.INITIATED,
  })
  status: TransactionStatus;

  @Column({ nullable: true })
  reference?: string;

  @Column({ nullable: true, unique: true })
  externalId?: string;

  @Column({ nullable: true })
  narration?: string;

  @Column({ nullable: true })
  failureReason?: string;

  @Column({ type: 'timestamp', nullable: true })
  processedAt?: Date;

  @Column({ nullable: true })
  journalId?: string;

  @Column({ nullable: true })
  relatedRtpMsgId?: string;

  @Column({ nullable: true })
  relatedBulkId?: string;

  @Column({ nullable: true })
  relatedQrPayload?: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

/////////////////////////
// FILE: src/payments/credit-transfer/credit-transfer.controller.ts
/////////////////////////
import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { CreditTransferService } from './credit-transfer.service';
import { CreditTransferDto } from './dto/credit-transfer.dto';
import { Participant } from 'src/common/decorators/participant/participant.decorator';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('/api/fp/payments')
export class CreditTransferController {
  constructor(private readonly creditTransferService: CreditTransferService) {}

  @Post('credit-transfer')
  initiate(
    @Body() dto: CreditTransferDto,
    @Participant() participantId: string,
  ) {
    return this.creditTransferService.initiate(participantId, dto);
  }
}

/////////////////////////
// FILE: src/payments/credit-transfer/credit-transfer.module.ts
/////////////////////////
import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Transaction } from '../transaction/entities/transaction.entity';
import { CreditTransferService } from './credit-transfer.service';
import { CreditTransferController } from './credit-transfer.controller';

import { LedgerModule } from 'src/ledger/ledger.module';
import { CasModule } from 'src/cas/cas.module';
import { AccountsModule } from 'src/accounts/accounts.module';
import { WalletModule } from 'src/wallet/wallet.module';
import { CustomerModule } from 'src/customer/customer.module';
import { PaymentsService } from '../payments.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Transaction]),
    LedgerModule,
    CasModule,
    AccountsModule,
    forwardRef(() => WalletModule),
    forwardRef(() => CustomerModule),
  ],
  providers: [CreditTransferService, PaymentsService],
  controllers: [CreditTransferController],
  exports: [CreditTransferService],
})
export class CreditTransferModule {}

/////////////////////////
// FILE: src/payments/credit-transfer/credit-transfer.service.ts
/////////////////////////
import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import Decimal from 'decimal.js';

import { Transaction } from '../transaction/entities/transaction.entity';
import { CreditTransferDto } from './dto/credit-transfer.dto';

import { CasService } from 'src/cas/cas.service';
import { LedgerService } from 'src/ledger/ledger.service';
import { AccountsService } from 'src/accounts/accounts.service';
import { WalletService } from 'src/wallet/wallet.service';
import { CustomerService } from 'src/customer/customer.service';
import { PaymentsService } from '../payments.service';

import {
  Currency,
  TransactionStatus,
  TransactionType,
} from 'src/common/enums/transaction.enums';

type ResolvedSource = {
  sourceType: 'ACCOUNT' | 'WALLET';
  customerId?: string;
  senderAlias: string;
  senderFinAddress: string;
  sourceAccountId?: string | null;
  sourceWalletId?: string | null;
};

type ResolvedReceiver = {
  receiverAlias: string;
  receiverFinAddress: string;
};

@Injectable()
export class CreditTransferService {
  constructor(
    @InjectRepository(Transaction)
    private readonly txRepo: Repository<Transaction>,

    private readonly casService: CasService,
    private readonly ledgerService: LedgerService,
    private readonly accountsService: AccountsService,

    @Inject(forwardRef(() => WalletService))
    private readonly walletService: WalletService,

    @Inject(forwardRef(() => CustomerService))
    private readonly customerService: CustomerService,

    private readonly paymentsService: PaymentsService,
    private readonly dataSource: DataSource,
  ) {
    Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });
  }

  async initiate(participantId: string, dto: CreditTransferDto) {
    const amount = new Decimal(dto.amount);

    if (amount.isNaN() || amount.lte(0)) {
      throw new BadRequestException('Invalid amount');
    }

    await this.set

    if (dto.currency !== Currency.SLE) {
      throw new BadRequestException('Only SLE currency is supported');
    }

    return this.dataSource.transaction('SERIALIZABLE', async (manager) => {
      const source = await this.resolveSource(participantId, dto, manager);
      const receiver = await this.resolveReceiver(dto);

      if (source.senderFinAddress === receiver.receiverFinAddress) {
        throw new BadRequestException('Sender and receiver cannot be same');
      }

      if (dto.pin && source.sourceType === 'WALLET') {
        const wallet = await this.walletService.getWallet(
          source.sourceWalletId!,
          participantId,
        );

        if (!wallet) {
          throw new NotFoundException('Wallet not found');
        }

        await this.walletService.verifyPinWithLock(
          wallet,
          participantId,
          dto.pin,
        );
      }

      if (dto.pin && source.sourceType === 'ACCOUNT' && source.customerId) {
        await this.customerService.verifyPin(
          source.customerId,
          participantId,
          dto.pin,
        );
      }

      await this.accountsService.assertFinAddressActive(
        source.senderFinAddress,
        manager,
      );
      await this.accountsService.assertFinAddressActive(
        receiver.receiverFinAddress,
        manager,
      );

      const tx = manager.getRepository(Transaction).create({
        participantId,
        channel: TransactionType.CREDIT_TRANSFER,
        senderAlias: source.senderAlias,
        receiverAlias: receiver.receiverAlias,
        senderFinAddress: source.senderFinAddress,
        receiverFinAddress: receiver.receiverFinAddress,
        amount: Number(amount.toFixed(2)),
        currency: dto.currency,
        status: TransactionStatus.INITIATED,
        reference: dto.reference,
        externalId:
          dto.idempotencyKey || this.paymentsService.generateReference(),
      });

      const savedTx = await manager.getRepository(Transaction).save(tx);

      try {
        const transferResult = await this.ledgerService.postTransfer(
          {
            txId: savedTx.txId,
            idempotencyKey: dto.idempotencyKey,
            reference: savedTx.reference ?? `CT-${savedTx.txId}`,
            participantId,
            postedBy: 'credit-transfer-service',
            currency: dto.currency,
            legs: [
              {
                finAddress: savedTx.senderFinAddress,
                amount: amount.toFixed(2),
                isCredit: false,
                memo:
                  dto.narration?.trim() ||
                  `Credit transfer to ${savedTx.receiverAlias}`,
              },
              {
                finAddress: savedTx.receiverFinAddress,
                amount: amount.toFixed(2),
                isCredit: true,
                memo:
                  dto.narration?.trim() ||
                  `Credit transfer from ${savedTx.senderAlias}`,
              },
            ],
          },
          manager,
        );

        if (transferResult.status === 'already_processed') {
          savedTx.status = TransactionStatus.COMPLETED;
          await manager.getRepository(Transaction).save(savedTx);

          return {
            status: 'success',
            txId: savedTx.txId,
            journalId: transferResult.journalId,
            senderFinAddress: savedTx.senderFinAddress,
            receiverFinAddress: savedTx.receiverFinAddress,
          };
        }

        savedTx.status = TransactionStatus.COMPLETED;
        await manager.getRepository(Transaction).save(savedTx);

        const [senderBalance, receiverBalance] = await Promise.all([
          this.ledgerService.getDerivedBalance(savedTx.senderFinAddress),
          this.ledgerService.getDerivedBalance(savedTx.receiverFinAddress),
        ]);

        return {
          status: 'success',
          txId: savedTx.txId,
          journalId: transferResult.journalId,
          senderFinAddress: savedTx.senderFinAddress,
          receiverFinAddress: savedTx.receiverFinAddress,
          senderBalance,
          receiverBalance,
        };
      } catch (error) {
        savedTx.status = TransactionStatus.FAILED;
        await manager.getRepository(Transaction).save(savedTx);
        throw error;
      }
    });
  }

  private async resolveSource(
    participantId: string,
    dto: CreditTransferDto,
    manager: EntityManager,
  ): Promise<ResolvedSource> {
    if (dto.sourceType === 'WALLET') {
      if (!dto.sourceWalletId) {
        throw new BadRequestException(
          'sourceWalletId is required for wallet source',
        );
      }

      const wallet = await this.walletService.getWallet(
        dto.sourceWalletId,
        participantId,
      );

      if (!wallet) {
        throw new NotFoundException('Wallet not found');
      }

      return {
        sourceType: 'WALLET',
        customerId: wallet.customerId,
        senderAlias: dto.senderAlias || wallet.customerId,
        senderFinAddress: wallet.finAddress,
        sourceWalletId: wallet.walletId,
        sourceAccountId: wallet.accountId,
      };
    }

    if (dto.sourceFinAddress) {
      await this.accountsService.assertFinAddressActive(
        dto.sourceFinAddress,
        manager,
      );

      return {
        sourceType: 'ACCOUNT',
        customerId: dto.customerId,
        senderAlias: dto.senderAlias || dto.customerId || dto.sourceFinAddress,
        senderFinAddress: dto.sourceFinAddress,
        sourceAccountId: dto.sourceAccountId ?? null,
      };
    }

    if (dto.senderAlias && dto.senderAliasType) {
      const sender = await this.casService.resolveAlias(
        dto.senderAliasType,
        dto.senderAlias,
      );

      return {
        sourceType: 'ACCOUNT',
        customerId: dto.customerId,
        senderAlias: dto.senderAlias,
        senderFinAddress: sender.finAddress,
      };
    }

    throw new BadRequestException(
      'Provide sourceFinAddress or senderAlias/senderAliasType for ACCOUNT source',
    );
  }

  private async resolveReceiver(
    dto: CreditTransferDto,
  ): Promise<ResolvedReceiver> {
    if (dto.receiverFinAddress) {
      return {
        receiverAlias: dto.receiverAlias || dto.receiverFinAddress,
        receiverFinAddress: dto.receiverFinAddress,
      };
    }

    if (dto.receiverAlias && dto.receiverAliasType) {
      const receiver = await this.casService.resolveAlias(
        dto.receiverAliasType,
        dto.receiverAlias,
      );

      return {
        receiverAlias: dto.receiverAlias,
        receiverFinAddress: receiver.finAddress,
      };
    }

    throw new BadRequestException(
      'Provide receiverFinAddress or receiverAlias with receiverAliasType',
    );
  }
}

/////////////////////////
// FILE: src/payments/credit-transfer/dto/credit-transfer.dto.ts
/////////////////////////
import {
  IsEnum,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { AliasType } from 'src/common/enums/alias.enums';
import { Currency } from 'src/common/enums/transaction.enums';

export class CreditTransferDto {
  @IsOptional()
  @IsString()
  customerId?: string;

  @IsOptional()
  @IsString()
  sourceAccountId?: string;

  @IsOptional()
  @IsString()
  sourceWalletId?: string;

  @IsOptional()
  @IsString()
  sourceFinAddress?: string;

  @IsIn(['ACCOUNT', 'WALLET'])
  sourceType: 'ACCOUNT' | 'WALLET';

  @IsOptional()
  @IsString()
  senderAlias?: string;

  @IsOptional()
  @IsEnum(AliasType)
  senderAliasType?: AliasType;

  @IsOptional()
  @IsString()
  receiverAlias?: string;

  @IsOptional()
  @IsEnum(AliasType)
  receiverAliasType?: AliasType;

  @IsOptional()
  @IsString()
  receiverFinAddress?: string;

  @IsString()
  @Matches(/^\d+(\.\d{1,2})?$/)
  amount: string;

  @IsEnum(Currency)
  currency: Currency;

  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(140)
  reference: string;

  @IsOptional()
  @IsString()
  narration?: string;

  @IsOptional()
  @IsString()
  @Length(4, 6)
  @Matches(/^\d{4,6}$/)
  pin?: string;

  @IsOptional()
  @IsString()
  idempotencyKey?: string;
}

/////////////////////////
// FILE: src/payments/verify/verify.controller.ts
/////////////////////////
import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { VerifyService } from './verify.service';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { VerifyAccountDto } from './dto/verify-account.dto';

@UseGuards(JwtAuthGuard)
@Controller('/api/fp/verify')
export class VerifyController {
  constructor(private readonly verifyService: VerifyService) {}

  @Post('account')
  verify(@Body() dto: VerifyAccountDto) {
    return this.verifyService.verifyAccount(dto);
  }
}

/////////////////////////
// FILE: src/payments/verify/verify.module.ts
/////////////////////////
import { Module, forwardRef } from '@nestjs/common';
import { VerifyController } from './verify.controller';
import { VerifyService } from './verify.service';
import { CasModule } from 'src/cas/cas.module';
import { AccountsModule } from 'src/accounts/accounts.module';
import { WalletModule } from 'src/wallet/wallet.module';

@Module({
  imports: [CasModule, AccountsModule, forwardRef(() => WalletModule)],
  controllers: [VerifyController],
  providers: [VerifyService],
  exports: [VerifyService],
})
export class VerifyModule {}

/////////////////////////
// FILE: src/payments/verify/verify.service.ts
/////////////////////////
import { Injectable, NotFoundException } from '@nestjs/common';
import { CasService } from 'src/cas/cas.service';
import { VerifyAccountDto } from './dto/verify-account.dto';
import { AccountsService } from 'src/accounts/accounts.service';
import { WalletService } from 'src/wallet/wallet.service';

@Injectable()
export class VerifyService {
  constructor(
    private readonly cas: CasService,
    private readonly accountsService: AccountsService,
    private readonly walletService: WalletService,
  ) {}

  async verifyAccount(dto: VerifyAccountDto) {
    const result = await this.cas.resolveAlias(dto.aliasType, dto.aliasValue);

    const account = await this.accountsService.findByFinAddress(
      result.finAddress,
    );

    if (account) {
      return {
        verified: true,
        type: 'ACCOUNT',
        finAddress: account.finAddress,
        aliasType: dto.aliasType,
        aliasValue: dto.aliasValue,
        accountId: account.accountId,
        customerId: account.customerId ?? null,
        accountNumber: account.accountNumber ?? null,
        currency: account.currency,
        status: account.status,
        message: 'Account verified successfully',
      };
    }

    const wallet = await this.walletService.findByFinAddress(result.finAddress);

    if (wallet) {
      return {
        verified: true,
        type: 'WALLET',
        finAddress: wallet.finAddress,
        aliasType: dto.aliasType,
        aliasValue: dto.aliasValue,
        walletId: wallet.walletId,
        customerId: wallet.customerId,
        currency: wallet.currency,
        status: wallet.status,
        message: 'Wallet verified successfully',
      };
    }

    throw new NotFoundException(
      'Resolved alias but destination record not found',
    );
  }
}

/////////////////////////
// FILE: src/payments/verify/dto/verify-account.dto.ts
/////////////////////////
import { IsEnum, IsOptional, IsString, IsNotEmpty } from 'class-validator';
import { AliasType } from 'src/common/enums/alias.enums';

export class VerifyAccountDto {
  @IsEnum(AliasType)
  aliasType: AliasType;

  @IsString()
  @IsNotEmpty()
  aliasValue: string;

  @IsOptional()
  @IsString()
  participantId?: string;
}

/////////////////////////
// FILE: src/payments/rtp/rtp.controller.ts
/////////////////////////
import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { RtpService } from './rtp.service';
import { RtpInitiateDto } from './dto/rtp-initiate.dto';
import { RespondRtpDto } from './dto/rtp-respond.dto';
import { Participant } from 'src/common/decorators/participant/participant.decorator';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('/api/fp/payments/rtp')
export class RtpController {
  constructor(private readonly rtpService: RtpService) {}

  @Post('initiate')
  create(@Body() dto: RtpInitiateDto, @Participant() participantId: string) {
    return this.rtpService.initiate(participantId, dto);
  }

  @Post(':rtpMsgId/accept')
  accept(
    @Param('rtpMsgId') id: string,
    @Body() body: Omit<RespondRtpDto, 'rtpMsgId'>,
    @Participant() participantId: string,
  ) {
    return this.rtpService.approve(participantId, {
      ...body,
      rtpMsgId: id,
    });
  }

  @Post(':rtpMsgId/reject')
  reject(
    @Param('rtpMsgId') id: string,
    @Body('reason') reason: string,
    @Participant() participantId: string,
  ) {
    return this.rtpService.reject(participantId, id, reason);
  }

  @Get('pending/:payerAlias')
  getPending(
    @Param('payerAlias') payerAlias: string,
    @Participant() participantId: string,
  ) {
    return this.rtpService.findPendingByPayer(participantId, payerAlias);
  }
}

/////////////////////////
// FILE: src/payments/rtp/rtp.module.ts
/////////////////////////
import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RtpController } from './rtp.controller';
import { RtpService } from './rtp.service';
import { Transaction } from '../transaction/entities/transaction.entity';
import { RTP } from './entities/rtp.entity';
import { CasModule } from 'src/cas/cas.module';
import { LedgerModule } from 'src/ledger/ledger.module';
import { AccountsModule } from 'src/accounts/accounts.module';
import { WalletModule } from 'src/wallet/wallet.module';
import { CustomerModule } from 'src/customer/customer.module';
import { PaymentsService } from '../payments.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Transaction, RTP]),
    CasModule,
    LedgerModule,
    AccountsModule,
    forwardRef(() => WalletModule),
    forwardRef(() => CustomerModule),
  ],
  controllers: [RtpController],
  providers: [RtpService, PaymentsService],
  exports: [RtpService],
})
export class RtpModule {}

/////////////////////////
// FILE: src/payments/rtp/rtp.service.ts
/////////////////////////
import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import Decimal from 'decimal.js';

import { RTP } from './entities/rtp.entity';
import { Transaction } from '../transaction/entities/transaction.entity';
import { RtpInitiateDto } from './dto/rtp-initiate.dto';
import { RespondRtpDto } from './dto/rtp-respond.dto';

import { CasService } from 'src/cas/cas.service';
import { LedgerService } from 'src/ledger/ledger.service';
import { AccountsService } from 'src/accounts/accounts.service';
import { WalletService } from 'src/wallet/wallet.service';
import { CustomerService } from 'src/customer/customer.service';
import { PaymentsService } from '../payments.service';

import { RtpStatus } from 'src/common/enums/rtp.enums';
import {
  Currency,
  TransactionStatus,
  TransactionType,
} from 'src/common/enums/transaction.enums';

type ResolvedRtpSource = {
  sourceType: 'ACCOUNT' | 'WALLET';
  senderFinAddress: string;
  senderAlias: string;
  customerId: string;
  sourceAccountId?: string | null;
  sourceWalletId?: string | null;
};

@Injectable()
export class RtpService {
  private readonly logger = new Logger(RtpService.name);

  constructor(
    @InjectRepository(RTP)
    private readonly rtpRepo: Repository<RTP>,

    @InjectRepository(Transaction)
    private readonly txRepo: Repository<Transaction>,

    private readonly ledgerService: LedgerService,
    private readonly cas: CasService,
    private readonly accountsService: AccountsService,

    @Inject(forwardRef(() => WalletService))
    private readonly walletService: WalletService,

    @Inject(forwardRef(() => CustomerService))
    private readonly customerService: CustomerService,

    private readonly paymentsService: PaymentsService,
    private readonly dataSource: DataSource,
  ) {
    Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });
  }

  async initiate(participantId: string, dto: RtpInitiateDto) {
    const amount = new Decimal(dto.amount);
    if (amount.isNaN() || amount.lte(0)) {
      throw new BadRequestException('Invalid RTP amount');
    }

    const currency = dto.currency ?? Currency.SLE;
    if (currency !== Currency.SLE) {
      throw new BadRequestException('Only SLE currency is supported');
    }

    const expiryMs = Number(process.env.RTP_EXPIRY_MINUTES ?? 60) * 60 * 1000;

    const requester = await this.cas.resolveAlias(
      dto.requesterAliasType,
      dto.requesterAlias,
    );

    let payerFinAddress: string | undefined;
    try {
      const payer = await this.cas.resolveAlias(
        dto.payerAliasType ?? dto.requesterAliasType,
        dto.payerAlias,
      );
      payerFinAddress = payer.finAddress;
    } catch {
      payerFinAddress = undefined;
    }

    const rtp = this.rtpRepo.create({
      participantId,
      requesterAlias: dto.requesterAlias,
      requesterAliasType: dto.requesterAliasType,
      payerAlias: dto.payerAlias,
      payerAliasType: dto.payerAliasType,
      requesterFinAddress: requester.finAddress,
      payerFinAddress,
      amount: amount.toFixed(2),
      currency,
      message: dto.message,
      reference: dto.reference,
      status: RtpStatus.PENDING,
      expiresAt: new Date(Date.now() + expiryMs),
    });

    return this.rtpRepo.save(rtp);
  }

  async approve(participantId: string, dto: RespondRtpDto) {
    return this.dataSource.transaction('SERIALIZABLE', async (manager) => {
      const rtp = await manager.getRepository(RTP).findOne({
        where: { rtpMsgId: dto.rtpMsgId, participantId },
      });

      if (!rtp) {
        throw new NotFoundException('RTP not found');
      }

      if (rtp.status !== RtpStatus.PENDING) {
        throw new BadRequestException(
          `RTP cannot be processed. Current status: ${rtp.status}`,
        );
      }

      if (new Date() > rtp.expiresAt) {
        await this.updateStatus(
          manager,
          dto.rtpMsgId,
          RtpStatus.EXPIRED,
          undefined,
          undefined,
          'RTP request has expired',
        );
        throw new BadRequestException('RTP request has expired');
      }

      const creditorFinAddress =
        rtp.requesterFinAddress ||
        (
          await this.cas.resolveAlias(
            rtp.requesterAliasType,
            rtp.requesterAlias,
          )
        ).finAddress;

      const source = await this.resolveSource(participantId, dto, manager);

      if (source.senderFinAddress === creditorFinAddress) {
        throw new BadRequestException('Sender and receiver cannot be same');
      }

      if (source.sourceType === 'WALLET') {
        const wallet = await this.walletService.getWallet(
          source.sourceWalletId!,
          participantId,
        );

        if (!wallet) {
          throw new NotFoundException('Wallet not found');
        }

        await this.walletService.verifyPinWithLock(
          wallet,
          participantId,
          dto.pin,
        );
      } else {
        await this.customerService.verifyPin(
          source.customerId,
          participantId,
          dto.pin,
        );
      }

      await this.accountsService.assertFinAddressActive(
        source.senderFinAddress,
        manager,
      );
      await this.accountsService.assertFinAddressActive(
        creditorFinAddress,
        manager,
      );

      const amount = new Decimal(rtp.amount);
      const tx = manager.getRepository(Transaction).create({
        participantId: rtp.participantId,
        channel: TransactionType.RTP_PAYMENT,
        senderAlias: rtp.payerAlias,
        senderFinAddress: source.senderFinAddress,
        receiverAlias: rtp.requesterAlias,
        receiverFinAddress: creditorFinAddress,
        amount: Number(amount.toFixed(2)),
        currency: rtp.currency,
        status: TransactionStatus.INITIATED,
        reference:
          rtp.reference || rtp.message || `RTP Payment ${rtp.rtpMsgId}`,
        externalId:
          dto.idempotencyKey || this.paymentsService.generateReference(),
      });

      const savedTx = await manager.getRepository(Transaction).save(tx);

      try {
        const transferResult = await this.ledgerService.postTransfer(
          {
            txId: savedTx.txId,
            idempotencyKey: dto.idempotencyKey,
            reference: savedTx.reference ?? `RTP-${rtp.rtpMsgId}`,
            participantId: rtp.participantId,
            postedBy: 'rtp-service',
            currency: rtp.currency,
            legs: [
              {
                finAddress: savedTx.senderFinAddress,
                amount: amount.toFixed(2),
                isCredit: false,
                memo: `RTP payment to ${savedTx.receiverAlias}`,
              },
              {
                finAddress: savedTx.receiverFinAddress,
                amount: amount.toFixed(2),
                isCredit: true,
                memo: `RTP payment from ${savedTx.senderAlias}`,
              },
            ],
          },
          manager,
        );

        savedTx.status = TransactionStatus.COMPLETED;
        await manager.getRepository(Transaction).save(savedTx);

        await this.updateStatus(
          manager,
          dto.rtpMsgId,
          RtpStatus.ACCEPTED,
          savedTx.txId,
          undefined,
          undefined,
        );

        const [senderBalance, receiverBalance] = await Promise.all([
          this.ledgerService.getDerivedBalance(savedTx.senderFinAddress),
          this.ledgerService.getDerivedBalance(savedTx.receiverFinAddress),
        ]);

        return {
          status: 'success',
          rtpMsgId: rtp.rtpMsgId,
          txId: savedTx.txId,
          journalId: transferResult.journalId,
          senderFinAddress: savedTx.senderFinAddress,
          receiverFinAddress: savedTx.receiverFinAddress,
          senderBalance,
          receiverBalance,
        };
      } catch (error: any) {
        savedTx.status = TransactionStatus.FAILED;
        await manager.getRepository(Transaction).save(savedTx);

        await this.updateStatus(
          manager,
          dto.rtpMsgId,
          RtpStatus.FAILED,
          undefined,
          undefined,
          error?.message || 'RTP payment failed',
        );

        throw error;
      }
    });
  }

  async reject(participantId: string, rtpMsgId: string, reason?: string) {
    const rtp = await this.rtpRepo.findOne({
      where: { rtpMsgId, participantId },
    });

    if (!rtp) {
      throw new NotFoundException('RTP not found');
    }

    if (rtp.status !== RtpStatus.PENDING) {
      throw new BadRequestException('RTP already processed');
    }

    this.logger.log(`RTP rejected by payer ${rtp.payerAlias}`);

    await this.updateStatus(
      undefined,
      rtpMsgId,
      RtpStatus.REJECTED,
      undefined,
      reason || 'Rejected by payer',
      undefined,
    );

    return {
      status: 'success',
      rtpMsgId,
      rtpStatus: RtpStatus.REJECTED,
    };
  }

  async findPendingByPayer(participantId: string, payerAlias: string) {
    return this.rtpRepo.find({
      where: {
        participantId,
        payerAlias,
        status: RtpStatus.PENDING,
      },
      order: { createdAt: 'DESC' },
    });
  }

  private async resolveSource(
    participantId: string,
    dto: RespondRtpDto,
    manager: EntityManager,
  ): Promise<ResolvedRtpSource> {
    if (dto.sourceType === 'WALLET') {
      if (!dto.sourceWalletId) {
        throw new BadRequestException(
          'sourceWalletId is required for wallet source',
        );
      }

      const wallet = await this.walletService.getWallet(
        dto.sourceWalletId,
        participantId,
      );

      if (!wallet) {
        throw new NotFoundException('Wallet not found');
      }

      if (wallet.customerId !== dto.customerId) {
        throw new BadRequestException('Wallet does not belong to the customer');
      }

      return {
        sourceType: 'WALLET',
        senderFinAddress: wallet.finAddress,
        senderAlias: wallet.customerId,
        customerId: wallet.customerId,
        sourceWalletId: wallet.walletId,
        sourceAccountId: wallet.accountId,
      };
    }

    if (!dto.sourceFinAddress) {
      throw new BadRequestException(
        'sourceFinAddress is required for account source',
      );
    }

    await this.accountsService.assertFinAddressActive(
      dto.sourceFinAddress,
      manager,
    );

    return {
      sourceType: 'ACCOUNT',
      senderFinAddress: dto.sourceFinAddress,
      senderAlias: dto.customerId,
      customerId: dto.customerId,
      sourceAccountId: dto.sourceAccountId ?? null,
    };
  }

  private async updateStatus(
    manager: EntityManager | undefined,
    rtpMsgId: string,
    status: RtpStatus,
    approvedTxId?: string,
    rejectionReason?: string,
    failureReason?: string,
  ) {
    const repo = manager ? manager.getRepository(RTP) : this.rtpRepo;

    await repo.update(
      { rtpMsgId },
      {
        status,
        approvedTxId,
        rejectionReason,
        failureReason,
      },
    );
  }
}

/////////////////////////
// FILE: src/payments/rtp/dto/rtp-initiate.dto.ts
/////////////////////////
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { AliasType } from 'src/common/enums/alias.enums';
import { Currency } from 'src/common/enums/transaction.enums';

export class RtpInitiateDto {
  @IsString()
  @IsNotEmpty()
  requesterAlias: string;

  @IsEnum(AliasType)
  requesterAliasType: AliasType;

  @IsString()
  @IsNotEmpty()
  payerAlias: string;

  @IsEnum(AliasType)
  @IsOptional()
  payerAliasType: AliasType = AliasType.MSISDN;

  @IsString()
  @Matches(/^\d+(\.\d{1,2})?$/)
  amount: string;

  @IsEnum(Currency)
  @IsOptional()
  currency: Currency = Currency.SLE;

  @IsOptional()
  @IsString()
  @MaxLength(140)
  message?: string;

  @IsOptional()
  @IsString()
  @MaxLength(140)
  reference?: string;
}

/////////////////////////
// FILE: src/payments/rtp/dto/rtp-respond.dto.ts
/////////////////////////
import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
} from 'class-validator';

export class RespondRtpDto {
  @IsUUID()
  @IsNotEmpty()
  rtpMsgId: string;

  @IsIn(['ACCOUNT', 'WALLET'])
  sourceType: 'ACCOUNT' | 'WALLET';

  @IsOptional()
  @IsString()
  sourceAccountId?: string;

  @IsOptional()
  @IsString()
  sourceWalletId?: string;

  @IsOptional()
  @IsString()
  sourceFinAddress?: string;

  @IsString()
  @IsNotEmpty()
  customerId: string;

  @IsString()
  @IsNotEmpty()
  @Length(4, 6)
  @Matches(/^\d{4,6}$/)
  pin: string;

  @IsOptional()
  @IsString()
  idempotencyKey?: string;
}

/////////////////////////
// FILE: src/payments/rtp/entities/rtp.entity.ts
/////////////////////////
import { AliasType } from 'src/common/enums/alias.enums';
import { RtpStatus } from 'src/common/enums/rtp.enums';
import { Currency } from 'src/common/enums/transaction.enums';
import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('rtp_requests')
@Index(['participantId', 'payerAlias', 'status'])
@Index(['participantId', 'requesterAlias', 'status'])
export class RTP {
  @PrimaryGeneratedColumn('uuid')
  rtpMsgId: string;

  @Column()
  participantId: string;

  @Column()
  requesterAlias: string;

  @Column({ type: 'enum', enum: AliasType, default: AliasType.MSISDN })
  requesterAliasType: AliasType;

  @Column()
  payerAlias: string;

  @Column({ type: 'enum', enum: AliasType, default: AliasType.MSISDN })
  payerAliasType: AliasType;

  @Column({ nullable: true })
  requesterFinAddress?: string;

  @Column({ nullable: true })
  payerFinAddress?: string;

  @Column({
    type: 'decimal',
    precision: 18,
    scale: 2,
    default: '0.00',
  })
  amount: string;

  @Column({ type: 'enum', enum: Currency, default: Currency.SLE })
  currency: Currency;

  @Column({ nullable: true })
  message?: string;

  @Column({ nullable: true })
  reference?: string;

  @Column({ type: 'enum', enum: RtpStatus, default: RtpStatus.PENDING })
  status: RtpStatus;

  @Column({ nullable: true })
  approvedTxId?: string;

  @Column({ nullable: true })
  rejectionReason?: string;

  @Column({ nullable: true })
  failureReason?: string;

  @CreateDateColumn()
  createdAt: Date;

  @Column({ type: 'timestamp' })
  expiresAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

/////////////////////////
// FILE: src/common/constants.ts
/////////////////////////
// ================= SYSTEM ACCOUNTS =================

export const SYSTEM_POOL = 'SYSTEM_INTERNAL';

// ================= FIN ADDRESS PREFIXES =================

export const WALLET_FIN_PREFIX = 'WALLET-';

// ================= DEFAULT SETTINGS =================

export const DEFAULT_CURRENCY = 'SLE'; // Sierra Leone Leone

// ================= TRANSACTION PREFIXES =================

export const TX_PREFIX = {
  FUND: 'FUND',
  WITHDRAW: 'WD',
  TRANSFER: 'TRF',
  LOAD: 'LOAD',
};

/////////////////////////
// FILE: src/common/crypto/aes.service.ts
/////////////////////////
import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';

interface EncryptedPayload {
  iv: string;
  content: string;
  tag: string;
}

@Injectable()
export class AesService {
  // AES-GCM encryption algorithm
  private readonly algorithm = 'aes-256-gcm';

  // Secret encryption key buffer
  private readonly key: Buffer;

  constructor() {
    // Validate AES secret from environment
    const secret = process.env.AES_SECRET;

    // Ensure secret exists and is correct length
    if (!secret || secret.length !== 64) {
      throw new Error(
        'AES_SECRET must be set and exactly 64 hex characters (32 bytes)',
      );
    }

    // Convert hex secret into buffer
    this.key = Buffer.from(secret, 'hex');
  }

  // ================== encrypt ==================
  // Encrypts any object using AES-256-GCM
  encrypt<T>(data: T): EncryptedPayload {
    // Generate random initialization vector
    const iv = crypto.randomBytes(12);

    // Create cipher using algorithm, key and IV
    const cipher = crypto.createCipheriv(this.algorithm, this.key, iv);

    // Encrypt JSON stringified data
    const encrypted = Buffer.concat([
      cipher.update(JSON.stringify(data), 'utf8'),
      cipher.final(),
    ]);

    // Return encrypted payload components
    return {
      iv: iv.toString('hex'),
      content: encrypted.toString('hex'),
      tag: cipher.getAuthTag().toString('hex'),
    };
  }

  // ================== decrypt ==================
  // Decrypts AES encrypted payload
  decrypt(payload: EncryptedPayload): unknown {
    const { iv, content, tag } = payload;

    // Create decipher using same algorithm and key
    const decipher = crypto.createDecipheriv(
      this.algorithm,
      this.key,
      Buffer.from(iv, 'hex'),
    );

    // Set authentication tag for integrity check
    decipher.setAuthTag(Buffer.from(tag, 'hex'));

    // Decrypt ciphertext
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(content, 'hex')),
      decipher.final(),
    ]);

    // Parse decrypted JSON back to object
    return JSON.parse(decrypted.toString());
  }
}

// content = ciphertext (encrypted data)
// tag = authentication tag used to verify integrity during decryption
// iv = random initialization vector to ensure different ciphertext for same plaintext

/////////////////////////
// FILE: src/common/sms/sms.module.ts
/////////////////////////
import { Module } from '@nestjs/common';
import { SmsService } from './sms.service';

@Module({
  providers: [SmsService],
  exports: [SmsService],
})
export class SmsModule {}

/////////////////////////
// FILE: src/common/sms/sms.service.ts
/////////////////////////
import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);
  private readonly provider = process.env.SMS_PROVIDER ?? 'mock';

  async sendOtp(msisdn: string, otpCode: string): Promise<void> {
    const message = `Your LINKPAY verification code is: ${otpCode}. Valid for 5 minutes. Do not share this with anyone.`;
    await this.send(msisdn, message);
  }

  async send(msisdn: string, message: string): Promise<void> {
    switch (this.provider) {
      case 'twilio':
        return this.sendViaTwilio(msisdn, message);
      case 'africastalking':
        return this.sendViaAfricasTalking(msisdn, message);
      case 'mock':
      default:
        this.logger.warn(`[MOCK SMS] To: ${msisdn} | Message: ${message}`);
        return;
    }
  }

  // ── PRIMARY: Twilio (India + international) ──────────────────
  private async sendViaTwilio(msisdn: string, message: string): Promise<void> {
    const twilio = require('twilio');
    const client = twilio(
      process.env.TWILIO_ACCOUNT_SID!,
      process.env.TWILIO_AUTH_TOKEN!,
    );

    const result = await client.messages.create({
      body: message,
      from: process.env.TWILIO_FROM!,
      to: msisdn, // must be E.164 format: +919876543210
    });

    this.logger.log(`SMS sent via Twilio | SID: ${result.sid} | To: ${msisdn}`);
  }

  // ── FALLBACK: Africa's Talking (Sierra Leone / Africa) ───────
  private async sendViaAfricasTalking(
    msisdn: string,
    message: string,
  ): Promise<void> {
    const AfricasTalking = require('africastalking');
    const at = AfricasTalking({
      apiKey: process.env.AT_API_KEY!,
      username: process.env.AT_USERNAME!,
    });

    const result = await at.SMS.send({
      to: [msisdn],
      message,
      from: process.env.AT_SENDER_ID,
    });

    this.logger.log(`SMS sent via AfricasTalking`, result);
  }
}

/////////////////////////
// FILE: src/common/enums/alias.enums.ts
/////////////////////////
// AliasType // FREE_FORMAT, EMAIL_ADDRESS, MSISDN, NATIONAL_ID
// AliasStatus // ACTIVE, INACTIVE

export enum AliasType {
  FREE_FORMAT = 'FREE_FORMAT',
  EMAIL_ADDRESS = 'EMAIL_ADDRESS',
  MSISDN = 'MSISDN',
  NATIONAL_ID = 'NATIONAL_ID',
}

export enum AliasStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
}

/////////////////////////
// FILE: src/common/enums/auth.enums.ts
/////////////////////////
export enum Role {
  USER = 'user',
  ADMIN = 'admin',
  CUSTOMER = 'customer',
  LOAN_OFFICER = 'loan_officer',
}

/////////////////////////
// FILE: src/common/enums/banking.enums.ts
/////////////////////////
export enum WalletStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  LOCKED = 'LOCKED',
}

export enum WalletLimit {
  TEN = '10000',
  TWENTY = '20000',
  FIFTY = '50000',
}

/////////////////////////
// FILE: src/common/enums/bulk.enums.ts
/////////////////////////
export enum BulkStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  PARTIAL = 'PARTIAL',
}

export enum FundMethod {
  CARD = 'CARD',
  BANK = 'BANK',
  MOBILE_MONEY = 'MOBILE_MONEY',
}

/////////////////////////
// FILE: src/common/enums/card.enums.ts
/////////////////////////
export enum CardBrand {
  VISA = 'VISA',
  MASTERCARD = 'MASTERCARD',
  AMEX = 'AMEX',
  DISCOVER = 'DISCOVER',
}

/////////////////////////
// FILE: src/common/enums/customer.enums.ts
/////////////////////////
export enum CustomerType {
  INDIVIDUAL = 'INDIVIDUAL',
  COMPANY = 'COMPANY',
}

export enum CustomerStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  BLOCKED = 'BLOCKED',
}

export enum Gender {
  MALE = 'MALE',
  FEMALE = 'FEMALE',
}

export enum LinkageType {
  INDIVIDUAL_DEFAULT = 'INDIVIDUAL_DEFAULT',
  UNIVERSAL_DEFAULT = 'UNIVERSAL_DEFAULT',
}

export enum DocumentType {
  NATIONAL_ID = 'NATIONAL_ID',
  DRIVERS_LICENSE = 'DRIVERS_LICENSE',
}

/////////////////////////
// FILE: src/common/enums/finaddress.enums.ts
/////////////////////////
export enum Type {
  IBAN = 'IBAN',
  BANK_ACCOUNT = 'BANK_ACCOUNT',
  WALLET = 'WALLET',
}

export enum ServicerIdType {
  BIC = 'BIC',
  SRV = 'SRV',
}

/////////////////////////
// FILE: src/common/enums/kyc.enums.ts
/////////////////////////
export enum KycTier {
  NONE = 'NONE',
  SOFT_PENDING = 'SOFT_PENDING',
  SOFT_APPROVED = 'SOFT_APPROVED',
  HARD_PENDING = 'HARD_PENDING',
  HARD_APPROVED = 'HARD_APPROVED',
  HARD_REJECTED = 'HARD_REJECTED',
}

export enum KycDocumentType {
  NATIONAL_ID = 'NATIONAL_ID',
  PASSPORT = 'PASSPORT',
  DRIVERS_LICENSE = 'DRIVERS_LICENSE',
  UTILITY_BILL = 'UTILITY_BILL', // address proof
  SELFIE = 'SELFIE',
}

export enum KycRejectionReason {
  DOCUMENT_UNCLEAR = 'DOCUMENT_UNCLEAR',
  DOCUMENT_EXPIRED = 'DOCUMENT_EXPIRED',
  NAME_MISMATCH = 'NAME_MISMATCH',
  DUPLICATE_ACCOUNT = 'DUPLICATE_ACCOUNT',
  SUSPICIOUS_ACTIVITY = 'SUSPICIOUS_ACTIVITY',
  OTHER = 'OTHER',
}

/////////////////////////
// FILE: src/common/enums/loan.enums.ts
/////////////////////////
export enum LoanStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  ACTIVE = 'ACTIVE',
  REPAID = 'REPAID',
  OVERDUE = 'OVERDUE',
  REJECTED = 'REJECTED',
}

/////////////////////////
// FILE: src/common/enums/notification.enums.ts
/////////////////////////
export enum NotificationType {
  EMAIL = 'EMAIL',
  PUSH = 'PUSH',
  SMS = 'SMS',
  IN_APP = 'IN_APP', // System alerts that don't trigger external delivery
}

export enum NotificationStatus {
  PENDING = 'PENDING',
  SENT = 'SENT',
  FAILED = 'FAILED',
}

/////////////////////////
// FILE: src/common/enums/rtp.enums.ts
/////////////////////////
export enum RtpStatus {
  PENDING = 'PENDING',
  ACCEPTED = 'ACCEPTED',
  REJECTED = 'REJECTED',
  EXPIRED = 'EXPIRED',
  FAILED = 'FAILED',
}

/////////////////////////
// FILE: src/common/enums/transaction.enums.ts
/////////////////////////
export enum TransactionStatus {
  INITIATED = 'INITIATED',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  REVERSED = 'REVERSED'
}

export enum TransactionType {
  CREDIT_TRANSFER = 'CREDIT_TRANSFER',
  QR_PAYMENT = 'QR_PAYMENT',
  RTP_PAYMENT = 'RTP_PAYMENT',
  BULK_PAYMENT = 'BULK_PAYMENT',
  WALLET_FUNDING = 'WALLET_FUNDING',
  WALLET_WITHDRAWAL = 'WALLET_WITHDRAWAL',
  CARD_LOAD = 'CARD_LOAD',
}

export enum Currency {
  SLE = 'SLE', // Sierra Leone Leone
  USD = 'USD',
  EUR = 'EUR',
  INR = 'INR',
}

export enum CrDbType {
  CREDIT = 'CREDIT',
  DEBIT = 'DEBIT',
}

export enum CardTransaction {
  INITIATED = 'INITIATED',
  GATEWAY_SUCCESS = 'GATEWAY_SUCCESS',
  FAILED = 'FAILED',
  COMPLETED = 'COMPLETED',
}

/////////////////////////
// FILE: src/common/guards/participant/participant.guard.ts
/////////////////////////
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Request } from 'express';
import { Participant } from 'src/auth/entities/participant.entity';
import { Repository } from 'typeorm';

@Injectable()
export class ParticipantGuard implements CanActivate {
  constructor(
    @InjectRepository(Participant)
    private readonly parRepo: Repository<Participant>,
  ) {}

  // ================== canActivate ==================
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    const bankId = req.headers['participant-id'] as string;

    // Check if participant exists and is active
    const bank = await this.parRepo.findOne({
      where: {
        participantId: bankId,
        isActive: true,
      },
    });

    if (!bank)
      throw new UnauthorizedException(
        'This Participant ID is not registered or active',
      );

    // Attach participantId to request for downstream usage
    // (req as any).participantId = bankId;

    const rolesArray = Array.isArray(bank.roles) ? bank.roles : [bank.roles];

    // 1. Attach to request root (as requested)
    // const request = req as any;
    (req as any).participantId = bank.participantId;
    (req as any).bankId = bank.participantId;
    (req as any).roles = rolesArray;
    // request.name = bank.username; // Using username as name
    // request.roles = rolesArray;

    // // 2. Attach to req.user for NestJS standard usage
    // req.user = {
    //   id: bank.participantId,
    //   name: bank.username,
    //   roles: rolesArray,
    // };

    return true;
  }
}

/////////////////////////
// FILE: src/common/guards/auth/roles.guard.ts
/////////////////////////
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from 'src/common/decorators/auth/roles.decorator';
import { Role } from 'src/common/enums/auth.enums';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const validRoles = Object.values(Role);
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || !user.roles || !Array.isArray(user.roles)) {
      throw new ForbiddenException('No roles found — access denied');
    }

    // Normalize and filter user roles
    const normalizedUserRoles: Role[] = user.roles
      .map((r: string) => r.toLowerCase())
      .filter((r: string) => validRoles.includes(r as Role)) as Role[];

    if (normalizedUserRoles.length === 0)
      throw new ForbiddenException('Invalid role set');

    // Normalize required roles too, for consistency
    const normalizedRequiredRoles = requiredRoles.map((r) => r.toLowerCase());

    const hasRole = normalizedUserRoles.some((role) =>
      normalizedRequiredRoles.includes(role),
    );

    if (!hasRole)
      throw new ForbiddenException('Access denied: Insufficient permission');

    return true;
  }
}

/////////////////////////
// FILE: src/common/email/email.module.ts
/////////////////////////
import { Module } from '@nestjs/common';
import { EmailService } from './email.service';
import { MailerModule } from '@nestjs-modules/mailer';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    MailerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        transport: {
          host: 'smtp.gmail.com',
          port: 465,
          secure: true, // Use SSL
          auth: {
            user: config.get<string>('EMAIL_USER'),
            pass: config.get<string>('EMAIL_PASS'),
          },
        },
        defaults: {
          from: `"LINKPAY" <${config.get<string>('EMAIL_USER')}>`,
        },
      }),
    }),
  ],
  providers: [EmailService],
  exports: [EmailService],
})
export class EmailModule {}

/////////////////////////
// FILE: src/common/email/email.service.ts
/////////////////////////
import { Injectable, Logger } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(private readonly mailerService: MailerService) {}

  async sendOtp(email: string, otpCode: string): Promise<void> {
    try {
      await this.mailerService.sendMail({
        to: email,
        subject: 'Your LINKPAY Verification Code',
        text: `Your verification code is: ${otpCode}. Valid for 5 minutes.`,
        html: `<b>Your LINKPAY verification code is: <span style="color: blue;">${otpCode}</span></b><p>Valid for 5 minutes.</p>`,
      });
      this.logger.log(`OTP Email sent successfully to ${email}`);
    } catch (error) {
      this.logger.error(`Failed to send OTP email to ${email}`, error);
    }
  }
}

/////////////////////////
// FILE: src/common/filters/global-exception.filter.ts
/////////////////////////
import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const isProduction = process.env.NODE_ENV === 'production';

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let details: any = undefined;

    let message: string | string[] = 'Internal server error';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const response = exception.getResponse();

      if (typeof response === 'string') {
        message = response;
      } else if (typeof response === 'object' && response !== null) {
        // Most common case: validation errors return { message: string | string[], ... }
        if ('message' in response) {
          const msg = (response as any).message;
          message = Array.isArray(msg) ? msg : String(msg ?? 'Error');
        } else {
          message = exception.message;
        }
      } else {
        message = exception.message;
      }
    } else {
      // unknown / non-HTTP exception
      this.logger.error(
        `Unhandled exception on ${request.method} ${request.url}`,
        exception instanceof Error ? exception.stack : String(exception),
      );

      if (!isProduction) {
        message = 'Internal server error (dev mode)';
        details = {
          name: exception instanceof Error ? exception.name : 'Unknown',
          message:
            exception instanceof Error ? exception.message : String(exception),
        };
      }
    }

    // Normalize message to always be string or string[]
    const clientMessage =
      Array.isArray(message) && message.length > 0
        ? message.join('. ') // most common choice for validation errors
        : typeof message === 'string'
          ? message
          : 'An unexpected error occurred';

    const payload: any = {
      statusCode: status,
      message: clientMessage,
      timestamp: new Date().toISOString(),
      path: request.url,
    };

    if (details && !isProduction) {
      payload.details = details;
    }

    // Optional: add correlation id or trace id in future
    // payload.traceId = request.headers['x-request-id'] || uuid();

    response.status(status).json(payload);
  }
}

/////////////////////////
// FILE: src/common/decorators/participant/participant.decorator.ts
/////////////////////////
import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';

// Custom decorator to extract participantId from request
export const Participant = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    // Get HTTP request object
    const request = ctx.switchToHttp().getRequest();

    // Return participantId set by ParticipantGuard
    return request.participantId; // set by ParticipantGuard from participant-id header
  },
);

/////////////////////////
// FILE: src/common/decorators/auth/roles.decorator.ts
/////////////////////////
import { SetMetadata } from '@nestjs/common';
import { Role } from 'src/common/enums/auth.enums';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);

/////////////////////////
// FILE: src/common/interceptors/encryption.interceptor.ts
/////////////////////////
import { Injectable, NestInterceptor } from '@nestjs/common';
import { AesService } from '../crypto/aes.service';
import { map, Observable } from 'rxjs';
import { CallHandler, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';

interface EncryptedPayload {
  iv: string;
  content: string;
  tag: string;
}

@Injectable()
export class EncryptionInterceptor implements NestInterceptor {
  // Inject AES encryption service
  constructor(private readonly aes: AesService) {}

  // ================== intercept ==================
  // Decrypts incoming request body and encrypts outgoing response
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    // Skip encryption in non-production environments
    if (process.env.NODE_ENV !== 'production') {
      return next.handle();
    }

    // Optional feature flag (disabled)
    // if (process.env.ENCRYPTION_ENABLED !== 'true') {
    //   return next.handle();
    // }

    // Get HTTP request object
    const req = context.switchToHttp().getRequest<Request>();

    // Detect encrypted payload structure and decrypt
    if (
      req.body &&
      typeof req.body === 'object' &&
      'content' in req.body &&
      'iv' in req.body &&
      'tag' in req.body
    ) {
      req.body = this.aes.decrypt(req.body as EncryptedPayload);
    }

    // Encrypt outgoing response data
    return next.handle().pipe(map((data) => this.aes.encrypt(data)));
  }
}

// content = ciphertext (encrypted payload)
// tag = authentication tag used to verify data integrity
// iv = random initialization vector ensuring unique ciphertext for same plaintext

/////////////////////////
// FILE: src/payment-instruments/payment-instruments.controller.ts
/////////////////////////
import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Post,
  Req,
  Res,
  UseGuards,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { Participant } from 'src/common/decorators/participant/participant.decorator';
import { PaymentInstrumentsService } from './payment-instruments.service';
import { AddCardDto } from './dto/add-card.dto';
import { AddMobileMoneyDto } from './dto/add-mobile-money.dto';
import { ChargeCardDto } from './dto/charge-card.dto';
import { CashInMobileMoneyDto } from './dto/cashin-mobile-money.dto';

@Controller('/api/fp/payment-instruments')
@UseGuards(JwtAuthGuard)
export class PaymentInstrumentsController {
  constructor(
    private readonly paymentInstrumentsService: PaymentInstrumentsService,
  ) {}

  @Post('cards')
  addCard(@Body() dto: AddCardDto, @Participant() participantId: string) {
    return this.paymentInstrumentsService.addCard(participantId, dto);
  }

  @Get('cards/:customerId')
  listCards(
    @Param('customerId') customerId: string,
    @Participant() participantId: string,
  ) {
    return this.paymentInstrumentsService.listCards(participantId, customerId);
  }

  @Delete('cards/:instrumentId')
  removeCard(
    @Param('instrumentId') instrumentId: string,
    @Participant() participantId: string,
  ) {
    return this.paymentInstrumentsService.removeCard(
      participantId,
      instrumentId,
    );
  }

  @Post('cards/:instrumentId/charge')
  chargeCard(
    @Param('instrumentId') instrumentId: string,
    @Body() dto: ChargeCardDto,
    @Participant() participantId: string,
  ) {
    return this.paymentInstrumentsService.chargeCard(
      participantId,
      instrumentId,
      dto,
    );
  }

  @Post('mobile-money')
  addMobileMoney(
    @Body() dto: AddMobileMoneyDto,
    @Participant() participantId: string,
  ) {
    return this.paymentInstrumentsService.addMobileMoney(participantId, dto);
  }

  @Get('mobile-money/:customerId')
  listMobileMoney(
    @Param('customerId') customerId: string,
    @Participant() participantId: string,
  ) {
    return this.paymentInstrumentsService.listMobileMoney(
      participantId,
      customerId,
    );
  }

  @Delete('mobile-money/:instrumentId')
  removeMobileMoney(
    @Param('instrumentId') instrumentId: string,
    @Participant() participantId: string,
  ) {
    return this.paymentInstrumentsService.removeMobileMoney(
      participantId,
      instrumentId,
    );
  }

  @Post('mobile-money/:instrumentId/cash-in')
  cashInMobileMoney(
    @Param('instrumentId') instrumentId: string,
    @Body() dto: CashInMobileMoneyDto,
    @Participant() participantId: string,
  ) {
    return this.paymentInstrumentsService.cashInFromMobileMoney(
      participantId,
      instrumentId,
      dto,
    );
  }
}

@Controller('webhooks/payment-instruments')
export class PaymentInstrumentsWebhookController {
  private readonly logger = new Logger(
    PaymentInstrumentsWebhookController.name,
  );

  constructor(
    private readonly paymentInstrumentsService: PaymentInstrumentsService,
  ) {}

  @Post('cards/gateway-callback')
  async handleGatewayCallback(
    @Headers('x-gateway-signature') signature: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    try {
      await this.paymentInstrumentsService.handleGatewayCallback(
        req.body,
        signature,
      );
      return res.status(HttpStatus.OK).send({ status: 'Processed' });
    } catch (error: any) {
      this.logger.error(`Webhook processing failed: ${error.message}`);
      return res.status(HttpStatus.OK).send({ error: error.message });
    }
  }
}

/////////////////////////
// FILE: src/payment-instruments/payment-instruments.module.ts
/////////////////////////
import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CardInstrument } from './entities/card.entity';
import { MobileMoneyInstrument } from './entities/mobile-money.entity';
import { Transaction } from 'src/payments/transaction/entities/transaction.entity';

import {
  PaymentInstrumentsController,
  PaymentInstrumentsWebhookController,
} from './payment-instruments.controller';
import { PaymentInstrumentsService } from './payment-instruments.service';

import { WalletModule } from 'src/wallet/wallet.module';
import { LedgerModule } from 'src/ledger/ledger.module';
import { AccountsModule } from 'src/accounts/accounts.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CardInstrument,
      MobileMoneyInstrument,
      Transaction,
    ]),
    forwardRef(() => WalletModule),
    AccountsModule,
    LedgerModule,
  ],
  controllers: [
    PaymentInstrumentsController,
    PaymentInstrumentsWebhookController,
  ],
  providers: [PaymentInstrumentsService],
  exports: [PaymentInstrumentsService],
})
export class PaymentInstrumentsModule {}

/////////////////////////
// FILE: src/payment-instruments/payment-instruments.service.ts
/////////////////////////
import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import Decimal from 'decimal.js';
import * as crypto from 'crypto';

import { CardInstrument } from './entities/card.entity';
import { MobileMoneyInstrument } from './entities/mobile-money.entity';
import {
  PaymentInstrumentStatus,
  PaymentInstrumentType,
} from './enums/payment-instrument.enum';
import { AddCardDto } from './dto/add-card.dto';
import { AddMobileMoneyDto } from './dto/add-mobile-money.dto';
import { ChargeCardDto } from './dto/charge-card.dto';
import { CashInMobileMoneyDto } from './dto/cashin-mobile-money.dto';

import { WalletService } from 'src/wallet/wallet.service';
import { AccountsService } from 'src/accounts/accounts.service';
import { LedgerService } from 'src/ledger/ledger.service';
import { Transaction } from 'src/payments/transaction/entities/transaction.entity';
import {
  Currency,
  TransactionStatus,
  TransactionType,
} from 'src/common/enums/transaction.enums';
import { SYSTEM_POOL } from 'src/common/constants';

@Injectable()
export class PaymentInstrumentsService {
  private readonly logger = new Logger(PaymentInstrumentsService.name);
  private readonly SYSTEM_POOL_FIN = SYSTEM_POOL;

  constructor(
    @InjectRepository(CardInstrument)
    private readonly cardRepo: Repository<CardInstrument>,

    @InjectRepository(MobileMoneyInstrument)
    private readonly mobileMoneyRepo: Repository<MobileMoneyInstrument>,

    @InjectRepository(Transaction)
    private readonly txRepo: Repository<Transaction>,

    private readonly walletService: WalletService,
    private readonly accountsService: AccountsService,
    private readonly ledgerService: LedgerService,
    private readonly dataSource: DataSource,
  ) {
    Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });
  }

  async addCard(
    participantId: string,
    dto: AddCardDto,
  ): Promise<CardInstrument> {
    return this.dataSource.transaction(async (manager) => {
      if (dto.accountId) {
        await this.accountsService.findByIdForParticipant(
          dto.accountId,
          participantId,
        );
      }

      if (dto.walletId) {
        await this.walletService.getWallet(dto.walletId, participantId);
      }

      if (dto.isDefault) {
        await manager.getRepository(CardInstrument).update(
          {
            participantId,
            customerId: dto.customerId,
          },
          { isDefault: false },
        );
      }

      const card = manager.getRepository(CardInstrument).create({
        participantId,
        customerId: dto.customerId,
        accountId: dto.accountId ?? null,
        walletId: dto.walletId ?? null,
        instrumentType: PaymentInstrumentType.CARD,
        status: PaymentInstrumentStatus.ACTIVE,
        isDefault: dto.isDefault ?? false,
        token: dto.token,
        bin: dto.bin,
        last4: dto.last4,
        brand: dto.brand,
        expMonth: dto.expMonth,
        expYear: dto.expYear,
        holderName: dto.holderName,
      });

      return manager.getRepository(CardInstrument).save(card);
    });
  }

  async addMobileMoney(
    participantId: string,
    dto: AddMobileMoneyDto,
  ): Promise<MobileMoneyInstrument> {
    return this.dataSource.transaction(async (manager) => {
      if (dto.accountId) {
        await this.accountsService.findByIdForParticipant(
          dto.accountId,
          participantId,
        );
      }

      if (dto.walletId) {
        await this.walletService.getWallet(dto.walletId, participantId);
      }

      const existing = await manager
        .getRepository(MobileMoneyInstrument)
        .findOne({
          where: {
            participantId,
            customerId: dto.customerId,
            msisdn: dto.msisdn,
          },
        });

      if (existing) {
        return existing;
      }

      if (dto.isDefault) {
        await manager.getRepository(MobileMoneyInstrument).update(
          {
            participantId,
            customerId: dto.customerId,
          },
          { isDefault: false },
        );
      }

      const instrument = manager.getRepository(MobileMoneyInstrument).create({
        participantId,
        customerId: dto.customerId,
        accountId: dto.accountId ?? null,
        walletId: dto.walletId ?? null,
        instrumentType: PaymentInstrumentType.MOBILE_MONEY,
        status: PaymentInstrumentStatus.ACTIVE,
        isDefault: dto.isDefault ?? false,
        provider: dto.provider,
        msisdn: dto.msisdn,
        accountName: dto.accountName,
      });

      return manager.getRepository(MobileMoneyInstrument).save(instrument);
    });
  }

  async listCards(
    participantId: string,
    customerId: string,
  ): Promise<CardInstrument[]> {
    return this.cardRepo.find({
      where: {
        participantId,
        customerId,
        status: PaymentInstrumentStatus.ACTIVE,
      },
      order: { createdAt: 'DESC' },
    });
  }

  async listMobileMoney(
    participantId: string,
    customerId: string,
  ): Promise<MobileMoneyInstrument[]> {
    return this.mobileMoneyRepo.find({
      where: {
        participantId,
        customerId,
        status: PaymentInstrumentStatus.ACTIVE,
      },
      order: { createdAt: 'DESC' },
    });
  }

  async getCardSecure(
    participantId: string,
    instrumentId: string,
  ): Promise<CardInstrument | null> {
    return this.cardRepo
      .createQueryBuilder('card')
      .addSelect('card.token')
      .where('card.instrumentId = :instrumentId', { instrumentId })
      .andWhere('card.participantId = :participantId', { participantId })
      .getOne();
  }

  async chargeCard(
    participantId: string,
    instrumentId: string,
    dto: ChargeCardDto,
  ) {
    const card = await this.cardRepo.findOne({
      where: {
        instrumentId,
        participantId,
        customerId: dto.customerId,
        status: PaymentInstrumentStatus.ACTIVE,
      },
    });

    if (!card) {
      throw new NotFoundException('Card not found');
    }

    const amount = new Decimal(dto.amount);
    if (amount.isNaN() || amount.lte(0)) {
      throw new BadRequestException('Amount must be greater than zero');
    }

    const destination = dto.walletId
      ? await this.walletService.getWallet(dto.walletId, participantId)
      : dto.accountId
        ? await this.accountsService.findByIdForParticipant(
            dto.accountId,
            participantId,
          )
        : card.walletId
          ? await this.walletService.getWallet(card.walletId, participantId)
          : card.accountId
            ? await this.accountsService.findByIdForParticipant(
                card.accountId,
                participantId,
              )
            : null;

    if (!destination) {
      throw new BadRequestException('No destination account or wallet found');
    }

    const destinationFinAddress = (destination as any).finAddress;
    if (!destinationFinAddress) {
      throw new BadRequestException('Destination finAddress not found');
    }

    const transactionRef = `CARD-CHG-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;

    this.logger.log(
      `Charge initiated for card ${card.last4}. Ref: ${transactionRef}`,
    );

    return {
      status: 'PENDING_GATEWAY',
      message: 'Charge initiated. Waiting for gateway webhook confirmation.',
      transactionRef,
      instrumentId: card.instrumentId,
      destinationFinAddress,
      amount: amount.toFixed(2),
    };
  }

  async cashInFromMobileMoney(
    participantId: string,
    instrumentId: string,
    dto: CashInMobileMoneyDto,
  ) {
    const instrument = await this.mobileMoneyRepo.findOne({
      where: {
        instrumentId,
        participantId,
        customerId: dto.customerId,
        status: PaymentInstrumentStatus.ACTIVE,
      },
    });

    if (!instrument) {
      throw new NotFoundException('Mobile money instrument not found');
    }

    const amount = new Decimal(dto.amount);
    if (amount.isNaN() || amount.lte(0)) {
      throw new BadRequestException('Invalid amount');
    }

    const destination = dto.walletId
      ? await this.walletService.getWallet(dto.walletId, participantId)
      : dto.accountId
        ? await this.accountsService.findByIdForParticipant(
            dto.accountId,
            participantId,
          )
        : instrument.walletId
          ? await this.walletService.getWallet(
              instrument.walletId,
              participantId,
            )
          : instrument.accountId
            ? await this.accountsService.findByIdForParticipant(
                instrument.accountId,
                participantId,
              )
            : null;

    if (!destination) {
      throw new BadRequestException('No destination account or wallet found');
    }

    const destinationFinAddress = (destination as any).finAddress;
    const txId = `MOMO-CASHIN-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
    const amountStr = amount.toFixed(2);

    return this.dataSource.transaction('SERIALIZABLE', async (manager) => {
      await this.accountsService.assertFinAddressActive(
        this.SYSTEM_POOL_FIN,
        manager,
      );
      await this.accountsService.assertFinAddressActive(
        destinationFinAddress,
        manager,
      );

      const transfer = await this.ledgerService.postTransfer(
        {
          txId,
          idempotencyKey: dto.idempotencyKey,
          reference: `Mobile money cash-in ${instrument.msisdn}`,
          participantId,
          postedBy: 'mobile-money-service',
          currency: Currency.SLE,
          legs: [
            {
              finAddress: this.SYSTEM_POOL_FIN,
              amount: amountStr,
              isCredit: false,
              memo: `Mobile money settlement -> ${destinationFinAddress}`,
            },
            {
              finAddress: destinationFinAddress,
              amount: amountStr,
              isCredit: true,
              memo: `Cash-in from ${instrument.provider} ${instrument.msisdn}`,
            },
          ],
        },
        manager,
      );

      await manager.getRepository(Transaction).save(
        manager.getRepository(Transaction).create({
          participantId,
          customerId: dto.customerId,
          channel: TransactionType.CREDIT_TRANSFER,
          senderAlias: instrument.msisdn,
          receiverAlias: dto.customerId,
          senderFinAddress: this.SYSTEM_POOL_FIN,
          receiverFinAddress: destinationFinAddress,
          destinationType: dto.walletId ? 'WALLET' : 'ACCOUNT',
          destinationWalletId: dto.walletId ?? instrument.walletId ?? undefined,
          destinationAccountId:
            dto.accountId ?? instrument.accountId ?? undefined,
          amount: amountStr,
          currency: Currency.SLE,
          status: TransactionStatus.COMPLETED,
          reference: txId,
          journalId: transfer.journalId,
          narration: `Mobile money cash-in`,
        }),
      );

      return {
        status: 'SUCCESS',
        txId,
        journalId: transfer.journalId,
      };
    });
  }

  async handleGatewayCallback(payload: any, signature: string) {
    const secret = process.env.CARD_GATEWAY_SECRET;

    if (!secret) {
      this.logger.error('CARD_GATEWAY_SECRET is not configured');
      throw new BadRequestException('Gateway secret not configured');
    }

    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(JSON.stringify(payload))
      .digest('hex');

    if (signature !== expectedSignature) {
      throw new BadRequestException('Invalid Signature');
    }

    if (payload.event !== 'charge.success') {
      return { status: 'ignored' };
    }

    const {
      amount,
      participantId,
      customerId,
      instrumentId,
      walletId,
      accountId,
      transactionRef,
      idempotencyKey,
    } = payload.data;

    const card = await this.getCardSecure(participantId, instrumentId);
    if (!card) {
      throw new NotFoundException('Card not found');
    }

    const destination = walletId
      ? await this.walletService.getWallet(walletId, participantId)
      : accountId
        ? await this.accountsService.findByIdForParticipant(
            accountId,
            participantId,
          )
        : card.walletId
          ? await this.walletService.getWallet(card.walletId, participantId)
          : card.accountId
            ? await this.accountsService.findByIdForParticipant(
                card.accountId,
                participantId,
              )
            : null;

    if (!destination) {
      throw new NotFoundException('Destination account or wallet not found');
    }

    const destinationFinAddress = (destination as any).finAddress;
    const amountStr = new Decimal(amount).toFixed(2);

    await this.dataSource.transaction('SERIALIZABLE', async (manager) => {
      const transfer = await this.ledgerService.postTransfer(
        {
          txId: transactionRef,
          idempotencyKey,
          reference: `Card deposit ${transactionRef}`,
          participantId,
          postedBy: 'card-webhook',
          currency: Currency.SLE,
          legs: [
            {
              finAddress: this.SYSTEM_POOL_FIN,
              amount: amountStr,
              isCredit: false,
              memo: `Gateway settlement for ${transactionRef}`,
            },
            {
              finAddress: destinationFinAddress,
              amount: amountStr,
              isCredit: true,
              memo: `Card topup ${transactionRef}`,
            },
          ],
        },
        manager,
      );

      await manager.getRepository(Transaction).save(
        manager.getRepository(Transaction).create({
          participantId,
          customerId,
          channel: TransactionType.CREDIT_TRANSFER,
          senderAlias: `CARD-${card.last4}`,
          receiverAlias: customerId,
          senderFinAddress: this.SYSTEM_POOL_FIN,
          receiverFinAddress: destinationFinAddress,
          sourceType: 'ACCOUNT',
          destinationType: walletId || card.walletId ? 'WALLET' : 'ACCOUNT',
          destinationWalletId: walletId ?? card.walletId ?? undefined,
          destinationAccountId: accountId ?? card.accountId ?? undefined,
          amount: amountStr,
          currency: Currency.SLE,
          status: TransactionStatus.COMPLETED,
          reference: transactionRef,
          journalId: transfer.journalId,
          narration: `Card funding settlement`,
        }),
      );
    });

    return { status: 'processed' };
  }

  async removeCard(participantId: string, instrumentId: string) {
    const card = await this.cardRepo.findOne({
      where: { instrumentId, participantId },
    });

    if (!card) {
      throw new NotFoundException('Card not found');
    }

    card.status = PaymentInstrumentStatus.INACTIVE;
    card.isDefault = false;
    return this.cardRepo.save(card);
  }

  async removeMobileMoney(participantId: string, instrumentId: string) {
    const instrument = await this.mobileMoneyRepo.findOne({
      where: { instrumentId, participantId },
    });

    if (!instrument) {
      throw new NotFoundException('Mobile money instrument not found');
    }

    instrument.status = PaymentInstrumentStatus.INACTIVE;
    instrument.isDefault = false;
    return this.mobileMoneyRepo.save(instrument);
  }
}

/////////////////////////
// FILE: src/payment-instruments/enums/mobile-money.enum.ts
/////////////////////////
export enum MobileMoneyProvider {
  ORANGE_MONEY = 'ORANGE_MONEY',
  AFRI_MONEY = 'AFRI_MONEY',
  QMONEY = 'QMONEY',
}

/////////////////////////
// FILE: src/payment-instruments/enums/payment-instrument.enum.ts
/////////////////////////
export enum PaymentInstrumentType {
  CARD = 'CARD',
  MOBILE_MONEY = 'MOBILE_MONEY',
}

export enum PaymentInstrumentStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  BLOCKED = 'BLOCKED',
  EXPIRED = 'EXPIRED',
}

/////////////////////////
// FILE: src/payment-instruments/dto/add-card.dto.ts
/////////////////////////
import {
  IsBoolean,
  IsEnum,
  IsNumber,
  IsNumberString,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
} from 'class-validator';
import { CardBrand } from 'src/common/enums/card.enums';

export class AddCardDto {
  @IsString()
  customerId: string;

  @IsOptional()
  @IsString()
  accountId?: string;

  @IsOptional()
  @IsString()
  walletId?: string;

  @IsString()
  token: string;

  @IsNumberString()
  @Length(6, 6)
  bin: string;

  @IsNumberString()
  @Length(4, 4)
  last4: string;

  @IsEnum(CardBrand)
  brand: CardBrand;

  @IsNumber()
  @Min(1)
  @Max(12)
  expMonth: number;

  @IsNumber()
  @Min(new Date().getFullYear())
  expYear: number;

  @IsOptional()
  @IsString()
  holderName?: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

/////////////////////////
// FILE: src/payment-instruments/dto/add-mobile-money.dto.ts
/////////////////////////
import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';
import { MobileMoneyProvider } from '../enums/mobile-money.enum';

export class AddMobileMoneyDto {
  @IsString()
  customerId: string;

  @IsOptional()
  @IsString()
  accountId?: string;

  @IsOptional()
  @IsString()
  walletId?: string;

  @IsEnum(MobileMoneyProvider)
  provider: MobileMoneyProvider;

  @IsString()
  msisdn: string;

  @IsOptional()
  @IsString()
  accountName?: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

/////////////////////////
// FILE: src/payment-instruments/dto/cashin-mobile-money.dto.ts
/////////////////////////
import { IsOptional, IsString, Matches } from 'class-validator';

export class CashInMobileMoneyDto {
  @IsString()
  customerId: string;

  @IsOptional()
  @IsString()
  walletId?: string;

  @IsOptional()
  @IsString()
  accountId?: string;

  @IsString()
  @Matches(/^\d+(\.\d{1,2})?$/)
  amount: string;

  @IsOptional()
  @IsString()
  idempotencyKey?: string;
}

/////////////////////////
// FILE: src/payment-instruments/dto/charge-card.dto.ts
/////////////////////////
import { IsOptional, IsString, Matches } from 'class-validator';

export class ChargeCardDto {
  @IsString()
  customerId: string;

  @IsOptional()
  @IsString()
  walletId?: string;

  @IsOptional()
  @IsString()
  accountId?: string;

  @IsString()
  @Matches(/^\d+(\.\d{1,2})?$/)
  amount: string;

  @IsOptional()
  @IsString()
  idempotencyKey?: string;
}

/////////////////////////
// FILE: src/payment-instruments/entities/card.entity.ts
/////////////////////////
import { ChildEntity, Column, Index } from 'typeorm';
import { CardBrand } from 'src/common/enums/card.enums';
import { PaymentInstrument } from './payment-instrument.entity';
import { PaymentInstrumentType } from '../enums/payment-instrument.enum';

@ChildEntity(PaymentInstrumentType.CARD)
@Index(['participantId', 'customerId', 'last4'])
export class CardInstrument extends PaymentInstrument {
  @Column({ select: false })
  token: string;

  @Column()
  bin: string;

  @Column()
  last4: string;

  @Column({ type: 'enum', enum: CardBrand })
  brand: CardBrand;

  @Column('int')
  expMonth: number;

  @Column('int')
  expYear: number;

  @Column({ nullable: true })
  holderName?: string;

  @Column({ nullable: true })
  schemeReference?: string;
}

/////////////////////////
// FILE: src/payment-instruments/entities/mobile-money.entity.ts
/////////////////////////
import { ChildEntity, Column, Index } from 'typeorm';
import { PaymentInstrument } from './payment-instrument.entity';
import { PaymentInstrumentType } from '../enums/payment-instrument.enum';
import { MobileMoneyProvider } from '../enums/mobile-money.enum';

@ChildEntity(PaymentInstrumentType.MOBILE_MONEY)
@Index(['participantId', 'customerId', 'msisdn'], { unique: true })
export class MobileMoneyInstrument extends PaymentInstrument {
  @Column({
    type: 'enum',
    enum: MobileMoneyProvider,
  })
  provider: MobileMoneyProvider;

  @Column()
  msisdn: string;

  @Column({ nullable: true })
  accountName?: string;

  @Column({ nullable: true })
  providerReference?: string;
}

/////////////////////////
// FILE: src/payment-instruments/entities/payment-instrument.entity.ts
/////////////////////////
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  TableInheritance,
  UpdateDateColumn,
} from 'typeorm';
import {
  PaymentInstrumentStatus,
  PaymentInstrumentType,
} from '../enums/payment-instrument.enum';

@Entity('payment_instruments')
@TableInheritance({ column: { type: 'varchar', name: 'instrumentType' } })
@Index(['participantId', 'customerId'])
@Index(['participantId', 'accountId'])
export abstract class PaymentInstrument {
  @PrimaryGeneratedColumn('uuid')
  instrumentId: string;

  @Column()
  participantId: string;

  @Column()
  customerId: string;

  @Column({ nullable: true })
  accountId?: string | null;

  @Column({ nullable: true })
  walletId?: string | null;

  @Column({
    type: 'enum',
    enum: PaymentInstrumentType,
  })
  instrumentType: PaymentInstrumentType;

  @Column({
    type: 'enum',
    enum: PaymentInstrumentStatus,
    default: PaymentInstrumentStatus.ACTIVE,
  })
  status: PaymentInstrumentStatus;

  @Column({ default: false })
  isDefault: boolean;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, any> | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
