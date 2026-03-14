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
import * as crypto from 'crypto';

// ─── Internal Types

interface TransferLeg {
  finAddress: string;
  amount: string;
  isCredit: boolean; // true = CREDIT (arriving), false = DEBIT (leaving)
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
    private journalRepo: Repository<LedgerJournal>,

    @InjectRepository(LedgerPosting)
    private postingRepo: Repository<LedgerPosting>,

    @InjectRepository(Account)
    private accountRepo: Repository<Account>,

    @Inject(forwardRef(() => AccountsService))
    private accService: AccountsService,

    private dataSource: DataSource,
  ) {
    Decimal.set({ precision: 18, rounding: Decimal.ROUND_HALF_UP });
  }

  // ─── Public: Balance

  /**
   * Get current balance by finAddress (non-transactional usage).
   */
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

  /**
   * Get balance using a specific EntityManager (for use inside transactions).
   */
  async getDerivedBalanceByAccountId(
    manager: EntityManager,
    accountId: string,
  ): Promise<string> {
    const result = await manager
      .createQueryBuilder(LedgerPosting, 'p')
      .where('p.accountId = :accountId', { accountId })
      .select(
        "COALESCE(SUM(CASE WHEN p.side = 'DEBIT' THEN -CAST(p.amount AS numeric) ELSE CAST(p.amount AS numeric) END), '0')",
        'balance',
      )
      .getRawOne();

    return result?.balance?.toString() ?? '0';
  }

  // ─── Public: Transfers

  /**
   * Atomic multi-leg double-entry transfer.
   * Pass txManager when calling from inside an existing transaction to share
   * the same DB transaction; omit it for standalone usage.
   */
  async postTransfer(
    input: LedgerTransferInput,
    txManager?: EntityManager,
  ): Promise<LedgerTransferResult> {
    const manager = txManager || this.dataSource.manager;

    return manager.transaction('SERIALIZABLE', async (innerManager) => {
      // ── Validate input
      if (!input.txId?.trim()) {
        throw new BadRequestException('txId is required');
      }

      if (!input.legs?.length || input.legs.length < 2) {
        throw new BadRequestException(
          'At least two legs required for double-entry',
        );
      }

      for (const leg of input.legs) {
        if (!this.isValidMonetaryString(leg.amount)) {
          throw new BadRequestException(`Invalid amount format: ${leg.amount}`);
        }
      }

      // ── Idempotency check
      const idempotentResult = await this.checkIdempotency(
        innerManager,
        input.idempotencyKey,
      );
      if (idempotentResult) return idempotentResult;

      // ── Lock accounts (pessimistic write)
      const accounts = await this.lockAccountsByFinAddress(
        innerManager,
        input.legs.map((l) => l.finAddress),
      );

      // ── Balance checks + double-entry invariant
      const { totalDebit, totalCredit } = await this.checkBalancesAndInvariant(
        innerManager,
        input.legs,
        accounts,
      );

      if (!totalDebit.equals(totalCredit)) {
        throw new InternalServerErrorException(
          `Double-entry violation: debit ${totalDebit.toFixed(2)} ≠ credit ${totalCredit.toFixed(2)}`,
        );
      }

      // ── Persist journal + postings
      const journal = innerManager.create(LedgerJournal, {
        txId: input.txId,
        idempotencyKey: input.idempotencyKey,
        reference: input.reference || 'No reference provided',
        participantId: input.participantId,
        postedBy: input.postedBy || 'system',
        postedAt: new Date(),
      });

      journal.postings = this.buildPostings(input.legs, accounts);

      await innerManager.save(journal);

      return {
        journalId: journal.journalId,
        txId: journal.txId,
        status: 'created' as const,
      };
    });
  }

  /**
   * Reverse / refund an existing transfer by txId.
   * Swaps each DEBIT↔CREDIT leg and posts a new journal that references the
   * original, marking it as reversed.
   */
  async reverseTransfer(input: {
    originalTxId: string;
    reason: string;
    postedBy: string;
    participantId: string;
    idempotencyKey?: string;
  }): Promise<LedgerTransferResult> {
    return this.dataSource.transaction('SERIALIZABLE', async (manager) => {
      // ── Load original journal
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

      // ── Idempotency check
      const idempotentResult = await this.checkIdempotency(
        manager,
        input.idempotencyKey,
      );
      if (idempotentResult) return idempotentResult;

      // ── Lock accounts by accountId (we have postings, not legs)
      const accounts = await this.lockAccountsByAccountId(
        manager,
        original.postings.map((p) => p.accountId),
      );

      // ── Build reversed legs
      const reverseLegs: ReverseLeg[] = original.postings.map((p) => {
        const acc = accounts.get(p.accountId)!;
        return {
          finAddress: acc.finAddress,
          amount: p.amount.toString(),
          isCredit: p.side !== 'CREDIT', // flip each side
          memo: `Reversal of ${input.originalTxId} – ${input.reason}`,
        };
      });

      // ── Balance check on the new debit legs
      await this.checkReverseBalances(manager, reverseLegs, accounts);

      // ── Persist reverse journal + postings
      const reverseTxId = `REV-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;

      const reverseJournal = manager.create(LedgerJournal, {
        txId: reverseTxId,
        idempotencyKey: input.idempotencyKey,
        reference: `Reversal of ${input.originalTxId}: ${input.reason}`,
        participantId: input.participantId,
        postedBy: input.postedBy,
        postedAt: new Date(),
        reversesTxId: input.originalTxId,
      });

      reverseJournal.postings = this.buildPostings(reverseLegs, accounts);

      original.reversedByTxId = reverseTxId;

      await manager.save(original);
      await manager.save(reverseJournal);

      return {
        journalId: reverseJournal.journalId,
        txId: reverseTxId,
        status: 'created' as const,
      };
    });
  }

  async findJournalByTxId(txId: string): Promise<LedgerJournal | null> {
    return this.journalRepo.findOne({
      where: { txId },
      relations: ['postings'],
    });
  }

  // ─── Private: Reusable Helpers

  /**
   * Check for an existing journal with the given idempotency key.
   * Returns the short-circuit result if already processed, or null to continue.
   */
  private async checkIdempotency(
    manager: EntityManager,
    idempotencyKey?: string,
  ): Promise<LedgerTransferResult | null> {
    if (!idempotencyKey) return null;

    const existing = await manager.findOne(LedgerJournal, {
      where: { idempotencyKey },
    });

    if (existing) {
      return {
        journalId: existing.journalId,
        txId: existing.txId,
        status: 'already_processed' as const,
      };
    }

    return null;
  }

  /**
   * Lock a set of accounts by their finAddress using pessimistic_write.
   * Returns a Map<finAddress, Account> for downstream use.
   * Validates each account exists and is in SLE currency.
   */
  private async lockAccountsByFinAddress(
    manager: EntityManager,
    finAddresses: string[],
  ): Promise<Map<string, Account>> {
    const accounts = new Map<string, Account>();

    for (const finAddress of finAddresses) {
      const acc = await manager
        .createQueryBuilder(Account, 'a')
        .where('a.finAddress = :fin', { fin: finAddress })
        .setLock('pessimistic_write')
        .getOne();

      if (!acc) {
        throw new NotFoundException(`Account not found: ${finAddress}`);
      }

      if (acc.currency !== Currency.SLE) {
        throw new BadRequestException(
          `Only SLE supported. Found: ${acc.currency}`,
        );
      }

      accounts.set(finAddress, acc);
    }

    return accounts;
  }

  /**
   * Lock a set of accounts by their accountId using pessimistic_write.
   * Returns a Map<accountId, Account> for downstream use.
   * Used by reverseTransfer where we have postings (accountId) not legs (finAddress).
   */
  private async lockAccountsByAccountId(
    manager: EntityManager,
    accountIds: string[],
  ): Promise<Map<string, Account>> {
    const accounts = new Map<string, Account>();

    for (const accountId of accountIds) {
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

  /**
   * For each leg, verify sufficient balance on DEBIT legs and accumulate
   * debit/credit totals for double-entry invariant checking.
   * Accounts map is keyed by finAddress.
   */
  private async checkBalancesAndInvariant(
    manager: EntityManager,
    legs: TransferLeg[],
    accounts: Map<string, Account>,
  ): Promise<{ totalDebit: Decimal; totalCredit: Decimal }> {
    let totalDebit = new Decimal(0);
    let totalCredit = new Decimal(0);

    for (const leg of legs) {
      const acc = accounts.get(leg.finAddress)!;
      const amount = new Decimal(leg.amount);

      if (!leg.isCredit) {
        const current = new Decimal(
          await this.getDerivedBalanceByAccountId(manager, acc.accountId),
        );

        if (current.lessThan(amount)) {
          throw new BadRequestException(
            `Insufficient funds on ${leg.finAddress}: ${current.toFixed(2)} < ${amount.toFixed(2)}`,
          );
        }

        totalDebit = totalDebit.add(amount);
      } else {
        // CREDIT leg — money is arriving at this account
        totalCredit = totalCredit.add(amount);
      }
    }

    return { totalDebit, totalCredit };
  }

  /**
   * For reversal legs, check that every new DEBIT leg has sufficient balance.
   * Accounts map is keyed by finAddress (derived from the reverseLegs).
   */
  private async checkReverseBalances(
    manager: EntityManager,
    reverseLegs: ReverseLeg[],
    accounts: Map<string, Account>,
  ): Promise<void> {
    for (const leg of reverseLegs) {
      if (leg.isCredit) continue;

      const acc = accounts.get(leg.finAddress)!;
      const current = new Decimal(
        await this.getDerivedBalanceByAccountId(manager, acc.accountId),
      );
      const amount = new Decimal(leg.amount);

      if (current.lessThan(amount)) {
        throw new BadRequestException(
          `Cannot reverse: insufficient balance on ${leg.finAddress} (${current.toFixed(2)} < ${amount.toFixed(2)})`,
        );
      }
    }
  }

  /**
   * Build LedgerPosting objects from a set of legs and their resolved accounts.
   * Accepts any leg shape that has finAddress, amount, isCredit, and optional memo.
   * The accounts map must be keyed by finAddress.
   */
  private buildPostings(
    legs: Array<{
      finAddress: string;
      amount: string;
      isCredit: boolean;
      memo?: string;
    }>,
    accounts: Map<string, Account>,
  ): LedgerPosting[] {
    return legs.map((leg) => {
      const acc = accounts.get(leg.finAddress)!;
      const posting = new LedgerPosting();
      posting.accountId = acc.accountId;
      posting.amount = leg.amount;
      posting.side = leg.isCredit ? 'CREDIT' : 'DEBIT';
      posting.memo = leg.memo ?? undefined;
      return posting;
    });
  }

  /**
   * Validates that a string is a properly formatted monetary value.
   * Accepts integers and decimals up to 6 places.
   */
  private isValidMonetaryString(v: string): boolean {
    return /^\d+(\.\d{1,6})?$/.test(v) || v === '0';
  }
}
// replace with decimal.js
