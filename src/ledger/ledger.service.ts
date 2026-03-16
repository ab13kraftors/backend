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

  async getDerivedBalance(finAddress: string): Promise<string> {
    const account = await this.accountRepo.findOne({
      where: { finAddress },
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
  ): Promise<Map<string, Account>> {
    const uniqueFinAddresses = [...new Set(finAddresses)];
    const accounts = new Map<string, Account>();

    for (const finAddress of uniqueFinAddresses) {
      const acc = await manager
        .createQueryBuilder(Account, 'a')
        .where('a.finAddress = :fin', { fin: finAddress })
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
  ): Promise<Map<string, Account>> {
    const uniqueAccountIds = [...new Set(accountIds)];
    const accounts = new Map<string, Account>();

    for (const accountId of uniqueAccountIds) {
      const acc = await manager
        .createQueryBuilder(Account, 'a')
        .where('a.accountId = :id', { id: accountId })
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
