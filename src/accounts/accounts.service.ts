import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ForbiddenException,
  forwardRef,
  Inject,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, EntityManager, DataSource } from 'typeorm';
import { Account, AccountStatus } from './entities/account.entity';
import { CreateAccountDto } from './dto/create-account.dto';
import { Currency } from 'src/common/enums/transaction.enums';
import { LedgerService } from 'src/ledger/ledger.service';
import { KycService } from 'src/kyc/kyc.service';
import { ComplianceService } from 'src/compliance/compliance.service';
import Decimal from 'decimal.js';
import { SYSTEM_POOL } from 'src/common/constants';

@Injectable()
export class AccountsService {
  constructor(
    @InjectRepository(Account)
    private accountRepo: Repository<Account>,

    @Inject(forwardRef(() => LedgerService))
    private ledgerService: LedgerService,

    private kycService: KycService,
    private complianceService: ComplianceService,
    private dataSource: DataSource,
  ) {}

  /**
   * Create ledger account for authenticated participant
   */
  async create(
    participantId: string,
    dto: CreateAccountDto,
    manager?: EntityManager,
  ): Promise<Account> {
    // // AML Screening (BSL mandatory)
    // const kycTier = await this.kycService.getTierByParticipant(participantId);
    // if (kycTier === KycTier.NONE || kycTier === KycTier.HARD_REJECTED) {
    //   throw new ForbiddenException('KYC approval required (BSL compliance)');
    // }

    const accRepo = manager ? manager.getRepository(Account) : this.accountRepo;

    // 1. Check uniqueness
    const existing = await accRepo.findOne({
      where: { finAddress: dto.finAddress },
    });

    if (existing) {
      if (existing.participantId === participantId) {
        throw new BadRequestException('You already own this FIN address');
      }
      throw new BadRequestException('FIN address already in use');
    }

    // 2. Create
    const account = accRepo.create({
      finAddress: dto.finAddress,
      participantId,
      currency: dto.currency,
      status: AccountStatus.ACTIVE,
      // kycTier, // Bank-grade: Link tier for limits
    });

    const saved = await accRepo.save(account);

    // Audit (BSL)
    // await this.complianceService.log('account_create', participantId, participantId, { finAddress: dto.finAddress });

    return saved;
  }

  /**
   * Get account by FIN address (public view - no sensitive data)
   */
  async getByFinAddress(finAddress: string) {
    const account = await this.accountRepo.findOne({
      where: { finAddress },
      select: ['accountId', 'finAddress', 'currency', 'status', 'createdAt'],
    });

    if (!account) {
      throw new NotFoundException(`Account not found: ${finAddress}`);
    }

    return account;
  }

  /**
   * Get all accounts owned by participant
   */
  async getAll(participantId: string) {
    return this.accountRepo.find({
      where: { participantId },
      select: ['accountId', 'finAddress', 'currency', 'status', 'createdAt'],
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Soft-delete / close account (only owner or admin)
   */
  async close(accountId: string, participantId: string, reason?: string) {
    const account = await this.accountRepo.findOne({
      where: { accountId },
    });

    if (!account) throw new NotFoundException('Account not found');

    if (account.participantId !== participantId)
      throw new ForbiddenException('You do not own this account');

    if (account.status === AccountStatus.CLOSED)
      throw new BadRequestException('Account already closed');

    // TODO: Check balance == 0 before closing (ledger query)
    // BSL: Zero balance + reconciliation
    const balance = new Decimal(
      await this.ledgerService.getDerivedBalance(account.finAddress),
    );
    if (balance.gt(0))
      throw new BadRequestException(
        `Balance ${balance.toFixed(2)} SLE must be zero`,
      );

    account.status = AccountStatus.CLOSED;
    // account.closedAt = new Date();
    // account.closeReason = reason;

    return this.accountRepo.save(account);
  }

  /**
   * Called at startup - ensure system accounts exist
   */
  // temporary test version
  async ensureSystemAccounts() {
    const fin = SYSTEM_POOL;
    const bankId = 'BANK_SL_001';

    let acc = await this.accountRepo.findOne({ where: { finAddress: fin } });

    if (!acc) {
      console.log(`Creating account ${fin}`);
      acc = await this.create(bankId, {
        finAddress: fin,
        currency: Currency.SLE,
      });
    }

    // Force simple credit
    try {
      await this.ledgerService.postTransfer({
        txId: `FORCE-SEED-${fin}-${Date.now()}`,
        reference: 'Force seed credit',
        participantId: bankId,
        postedBy: 'system-debug',
        legs: [
          {
            finAddress: fin,
            amount: '500000', // smaller number to test
            isCredit: true,
            memo: 'Debug seed',
          },
        ],
      });
      console.log(`→ Credit posted to ${fin}`);
    } catch (e) {
      console.error(`Credit failed for ${fin}:`, e.message || e);
    }
  }
}
