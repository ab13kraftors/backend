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

    await this.ensureUniqueFinAddress(repo, dto.finAddress);

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
  ): Promise<Account> {
    if (!dto.customerId) {
      throw new BadRequestException('customerId is required');
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

    await this.ensureUniqueFinAddress(repo, dto.finAddress);

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
    const repo = this.getRepo(manager);

    const existing = await repo.findOne({
      where: {
        type: AccountType.SYSTEM,
      },
    });

    if (existing) {
      return existing;
    }

    await this.ensureUniqueFinAddress(repo, finAddress);

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
      where: { type: AccountType.SYSTEM },
    });

    if (existing) return existing;

    return this.createSystemAccount(
      participantId,
      currency,
      finAddress,
      manager,
    );
  }

  async findById(accountId: string, manager?: EntityManager): Promise<Account> {
    const repo = this.getRepo(manager);

    const account = await repo.findOne({
      where: { accountId },
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

  async updateStatus(
    accountId: string,
    status: AccountStatus,
    manager?: EntityManager,
  ): Promise<Account> {
    const repo = this.getRepo(manager);
    const account = await this.findById(accountId, manager);

    account.status = status;
    return repo.save(account);
  }

  async assertAccountActive(
    accountId: string,
    manager?: EntityManager,
  ): Promise<Account> {
    const account = await this.findById(accountId, manager);

    if (account.status !== AccountStatus.ACTIVE) {
      throw new BadRequestException(`Account ${accountId} is not active`);
    }

    return account;
  }

  async assertFinAddressActive(
    finAddress: string,
    manager?: EntityManager,
  ): Promise<Account> {
    const account = await this.findByFinAddress(finAddress, manager);

    if (account.status !== AccountStatus.ACTIVE) {
      throw new BadRequestException(`Account ${finAddress} is not active`);
    }

    return account;
  }

  private async ensureUniqueFinAddress(
    repo: Repository<Account>,
    finAddress?: string | null,
  ): Promise<void> {
    if (!finAddress) return;

    const existing = await repo.findOne({
      where: { finAddress },
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
