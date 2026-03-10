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
import Decimal from 'decimal.js'; // npm install decimal.js
import { LedgerJournal } from './entities/ledger-journal.entity';
import { LedgerPosting } from './entities/ledger-posting.entity';
import { Account } from '../accounts/entities/account.entity';
import { LedgerTransferInput, LedgerTransferResult } from './ledger.types';
import { Currency } from 'src/common/enums/transaction.enums';
import { AccountsService } from 'src/accounts/accounts.service';

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
    // Set decimal.js global precision (adjust as needed for SLE)
    Decimal.set({ precision: 18, rounding: Decimal.ROUND_HALF_UP });
  }

  /**
   * Get current balance by finAddress (non-transactional usage)
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
   * Get balance using specific manager (for transactions)
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

  /**
   * Atomic multi-leg transfer
   */
  async postTransfer(
    input: LedgerTransferInput,
    txManager?: EntityManager,
  ): Promise<LedgerTransferResult> {
    const manager = txManager || this.dataSource.manager;

    return manager.transaction('SERIALIZABLE', async (innerManager) => {
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

      // Idempotency
      if (input.idempotencyKey) {
        const existing = await innerManager.findOne(LedgerJournal, {
          where: { idempotencyKey: input.idempotencyKey },
        });
        if (existing) {
          return {
            journalId: existing.journalId,
            txId: existing.txId,
            status: 'already_processed' as const,
          };
        }
      }

      // Lock accounts
      const accounts = new Map<string, Account>();
      for (const leg of input.legs) {
        const acc = await innerManager
          .createQueryBuilder(Account, 'a')
          .where('a.finAddress = :fin', { fin: leg.finAddress })
          .setLock('pessimistic_write')
          .getOne();

        if (!acc) {
          throw new NotFoundException(`Account not found: ${leg.finAddress}`);
        }

        if (acc.currency !== Currency.SLE) {
          throw new BadRequestException(
            `Only SLE supported. Found: ${acc.currency}`,
          );
        }

        accounts.set(leg.finAddress, acc);
      }

      // Balance checks + invariant (inside transaction!)
      let totalDebit = new Decimal(0);
      let totalCredit = new Decimal(0);

      for (const leg of input.legs) {
        const acc = accounts.get(leg.finAddress)!;
        const currentStr = await this.getDerivedBalanceByAccountId(
          innerManager,
          acc.accountId,
        );
        const current = new Decimal(currentStr);
        const amount = new Decimal(leg.amount);

        if (leg.isCredit) {
          // DEBIT leg → money leaving
          if (current.lessThan(amount)) {
            throw new BadRequestException(
              `Insufficient funds on ${leg.finAddress}: ${current.toFixed(2)} < ${amount.toFixed(2)}`,
            );
          }
          totalDebit = totalDebit.add(amount);
        } else {
          // CREDIT leg → money arriving
          totalCredit = totalCredit.add(amount);
        }
      }

      if (!totalDebit.equals(totalCredit)) {
        throw new InternalServerErrorException(
          `Double-entry violation: debit ${totalDebit.toFixed(2)} ≠ credit ${totalCredit.toFixed(2)}`,
        );
      }

      // Create journal
      const journal = innerManager.create(LedgerJournal, {
        txId: input.txId,
        idempotencyKey: input.idempotencyKey,
        reference: input.reference || 'No reference provided',
        participantId: input.participantId,
        postedBy: input.postedBy || 'system',
        postedAt: new Date(),
      });

      journal.postings = input.legs.map((leg) => {
        const acc = accounts.get(leg.finAddress)!;
        const posting = new LedgerPosting();
        posting.accountId = acc.accountId;
        posting.amount = Number(leg.amount);
        posting.side = leg.isCredit ? 'DEBIT' : 'CREDIT';
        posting.memo = leg.memo ?? undefined;
        return posting;
      });

      await innerManager.save(journal);

      return {
        journalId: journal.journalId,
        txId: journal.txId,
        status: 'created' as const,
      };
    });
  }

  /**
   * Reverse / refund existing transfer
   */
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

      if (input.idempotencyKey) {
        const existing = await manager.findOne(LedgerJournal, {
          where: { idempotencyKey: input.idempotencyKey },
        });
        if (existing) {
          return {
            journalId: existing.journalId,
            txId: existing.txId,
            status: 'already_processed' as const,
          };
        }
      }

      const accounts = new Map<string, Account>();
      for (const p of original.postings) {
        const acc = await manager
          .createQueryBuilder(Account, 'a')
          .where('a.accountId = :id', { id: p.accountId })
          .setLock('pessimistic_write')
          .getOne();

        if (!acc) throw new NotFoundException(`Account gone: ${p.accountId}`);

        accounts.set(p.accountId, acc);
      }

      const reverseLegs: {
        finAddress: string;
        amount: string;
        isCredit: boolean;
        memo: string;
      }[] = [];

      for (const p of original.postings) {
        const acc = accounts.get(p.accountId)!;
        reverseLegs.push({
          finAddress: acc.finAddress,
          amount: p.amount.toString(),
          isCredit: p.side === 'DEBIT' ? false : true,
          memo: `Reversal of ${input.originalTxId} – ${input.reason}`,
        });
      }

      // Balance check for reverse debits
      for (const leg of reverseLegs) {
        if (leg.isCredit) {
          // now debiting this account
          const currentStr = await this.getDerivedBalanceByAccountId(
            manager,
            accounts.get(leg.finAddress)!.accountId,
          );
          const current = new Decimal(currentStr);
          const amount = new Decimal(leg.amount);

          if (current.lessThan(amount)) {
            throw new BadRequestException(
              `Cannot reverse: insufficient balance on ${leg.finAddress} (${current.toFixed(2)} < ${amount.toFixed(2)})`,
            );
          }
        }
      }

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

      reverseJournal.postings = reverseLegs.map((leg) => {
        const acc = accounts.get(leg.finAddress)!;
        const posting = new LedgerPosting();
        posting.accountId = acc.accountId;
        posting.amount = Number(leg.amount);
        posting.side = leg.isCredit ? 'DEBIT' : 'CREDIT';
        posting.memo = leg.memo ?? undefined;
        return posting;
      });

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

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private isValidMonetaryString(v: string): boolean {
    return /^\d+(\.\d{1,6})?$/.test(v) || v === '0';
  }

  private compareAmounts(a: string, b: string): number {
    return Number(a) - Number(b); // ← replace with decimal.js later
  }

  private addAmounts(a: string, b: string): string {
    return (Number(a) + Number(b)).toFixed(2); // ← replace with decimal.js
  }
}
