import {
  BadRequestException,
  ConflictException,
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

/**
 * SYSTEM_LOAN_POOL — the internal fin-address that acts as the source of
 * disbursed funds and the sink for repayments.  This account must exist
 * as a seeded ledger posting (balance derived from postings, never a raw
 * column) before any loan can be disbursed.
 */
export const SYSTEM_LOAN_POOL = 'SYSTEM_LOAN_POOL';

@Injectable()
export class LoanService {
  private readonly logger = new Logger(LoanService.name);

  constructor(
    @InjectRepository(LoanApplication)
    private readonly loanRepo: Repository<LoanApplication>,

    @InjectRepository(LoanRepayment)
    private readonly repayRepo: Repository<LoanRepayment>,

    private readonly ledgerService: LedgerService,
    private readonly walletService: WalletService,
    private readonly kycService: KycService,
    private readonly dataSource: DataSource,
  ) {}

  // CUSTOMER-FACING OPERATIONS

  /**
   * Submit a new loan application.
   * Prerequisites: KYC HARD_APPROVED, active wallet, no existing PENDING/ACTIVE loan.
   */
  async applyLoan(
    ccuuid: string,
    participantId: string,
    dto: ApplyLoanDto,
  ): Promise<LoanApplication> {
    // 1. KYC gate
    await this.kycService.requireTier(ccuuid, KycTier.HARD_APPROVED);

    // 2. Wallet must exist
    await this.walletService.findByCustomer(ccuuid);

    // 3. No existing open loan
    const existing = await this.loanRepo.findOneBy({
      ccuuid,
      status: In([
        LoanStatus.PENDING,
        LoanStatus.ACTIVE,
        LoanStatus.APPROVED,
        LoanStatus.OVERDUE,
      ]),
    });

    if (existing) {
      throw new ConflictException(
        `Customer already has an open loan (${existing.loanId}, status: ${existing.status})`,
      );
    }

    const loan = this.loanRepo.create({
      ccuuid,
      participantId,
      requestedAmount: dto.amount,
      outstandingBalance: dto.amount,
      status: LoanStatus.PENDING,
      purpose: dto.purpose ?? null,
    });

    const saved = await this.loanRepo.save(loan);
    this.logger.log(
      `Loan application created: ${saved.loanId} for customer ${ccuuid}`,
    );
    return saved;
  }

  /**
   * Repay an amount against an ACTIVE loan from the customer's wallet.
   * Supports partial and full repayments.
   * Idempotent: providing the same idempotencyKey twice is a no-op.
   */
  async repayLoan(
    ccuuid: string,
    loanId: string,
    dto: RepayLoanDto,
  ): Promise<LoanRepayment> {
    return this.dataSource.transaction(async (manager) => {
      // ── Idempotency check ──────────────────────────────────────────────────
      if (dto.idempotencyKey) {
        const duplicate = await manager.findOne(LoanRepayment, {
          where: { idempotencyKey: dto.idempotencyKey },
        });
        if (duplicate) {
          this.logger.warn(
            `Duplicate repayment attempt (idempotencyKey=${dto.idempotencyKey})`,
          );
          return duplicate;
        }
      }

      // ── Load & validate loan ───────────────────────────────────────────────
      const loan = await manager.findOneBy(LoanApplication, {
        loanId,
        ccuuid,
      });

      if (!loan) throw new NotFoundException(`Loan ${loanId} not found`);

      if (
        loan.status !== LoanStatus.ACTIVE &&
        loan.status !== LoanStatus.OVERDUE
      ) {
        throw new BadRequestException(
          `Loan is not repayable in status: ${loan.status}`,
        );
      }

      // ── Amount guards ──────────────────────────────────────────────────────
      const repayAmount = new Decimal(dto.amount);
      const outstanding = new Decimal(loan.outstandingBalance);

      if (repayAmount.lte(0)) {
        throw new BadRequestException(
          'Repayment amount must be greater than zero',
        );
      }

      if (repayAmount.gt(outstanding)) {
        throw new BadRequestException(
          `Repayment amount (${dto.amount}) exceeds outstanding balance (${loan.outstandingBalance})`,
        );
      }

      // ── Wallet balance check ───────────────────────────────────────────────
      const wallet = await this.walletService.findByCustomer(ccuuid);
      const walletBalance = new Decimal(
        await this.ledgerService.getDerivedBalance(wallet.finAddress),
      );

      if (walletBalance.lt(repayAmount)) {
        throw new BadRequestException(
          'Insufficient wallet balance for repayment',
        );
      }

      // ── Post ledger transfer ───────────────────────────────────────────────

      const txId = crypto.randomUUID();
      const result = await this.ledgerService.postTransfer(
        {
          txId,
          idempotencyKey: dto.idempotencyKey ?? txId,
          reference: `Loan repayment ${loanId}`,
          participantId: loan.participantId,
          postedBy: ccuuid,
          legs: [
            {
              finAddress: wallet.finAddress,
              amount: repayAmount.toFixed(4),
              isCredit: false, // DEBIT — money leaving wallet
              memo: `Loan repayment for ${loanId}`,
            },
            {
              finAddress: SYSTEM_LOAN_POOL,
              amount: repayAmount.toFixed(4),
              isCredit: true, // CREDIT — money arriving at pool
              memo: `Loan repayment from ${ccuuid}`,
            },
          ],
        },
        manager,
      );

      // ── Update loan outstanding balance ────────────────────────────────────
      const newOutstanding = outstanding.minus(repayAmount);
      const outstandingBefore = loan.outstandingBalance;
      loan.outstandingBalance = newOutstanding.toFixed(4);

      if (newOutstanding.lte(0)) {
        loan.status = LoanStatus.REPAID;
        this.logger.log(`Loan ${loanId} fully repaid by customer ${ccuuid}`);
      }

      await manager.save(LoanApplication, loan);

      // ── Persist repayment record ───────────────────────────────────────────
      const repayment = manager.create(LoanRepayment, {
        loanId,
        ccuuid,
        amount: repayAmount.toFixed(4),
        outstandingBefore,
        outstandingAfter: loan.outstandingBalance,
        ledgerJournalId: result.journalId,
        idempotencyKey: dto.idempotencyKey ?? txId,
      });

      return manager.save(LoanRepayment, repayment);
    });
  }

  // READ / QUERY

  async getLoansByCustomer(ccuuid: string): Promise<LoanApplication[]> {
    return this.loanRepo.find({
      where: { ccuuid },
      order: { appliedAt: 'DESC' },
    });
  }

  async getLoanById(loanId: string, ccuuid: string): Promise<LoanApplication> {
    const loan = await this.loanRepo.findOneBy({ loanId, ccuuid });
    if (!loan) throw new NotFoundException(`Loan ${loanId} not found`);
    return loan;
  }

  async getRepaymentHistory(
    loanId: string,
    ccuuid: string,
  ): Promise<LoanRepayment[]> {
    // Verify ownership first
    await this.getLoanById(loanId, ccuuid);
    return this.repayRepo.find({
      where: { loanId },
      order: { repaidAt: 'DESC' },
    });
  }

  // ADMIN OPERATIONS

  async approveLoan(
    loanId: string,
    adminId: string,
    dto: ApproveLoanDto,
  ): Promise<LoanApplication> {
    const loan = await this.loanRepo.findOne({ where: { loanId } });
    if (!loan) throw new NotFoundException(`Loan ${loanId} not found`);

    if (loan.status !== LoanStatus.PENDING) {
      throw new BadRequestException(`Loan ${loanId} is not in PENDING status`);
    }

    loan.status = LoanStatus.APPROVED;
    loan.approvedAmount = new Decimal(dto.approvedAmount).toFixed(4);
    loan.outstandingBalance = loan.approvedAmount;
    loan.dueDate = new Date(dto.dueDate);
    loan.reviewedAt = new Date();
    loan.reviewedBy = adminId;

    const saved = await this.loanRepo.save(loan);
    this.logger.log(`Loan ${loanId} approved by admin ${adminId}`);
    return saved;
  }

  async rejectLoan(
    loanId: string,
    adminId: string,
    dto: RejectLoanDto,
  ): Promise<LoanApplication> {
    const loan = await this.loanRepo.findOne({ where: { loanId } });
    if (!loan) throw new NotFoundException(`Loan ${loanId} not found`);

    if (loan.status !== LoanStatus.PENDING) {
      throw new BadRequestException(`Loan ${loanId} is not in PENDING status`);
    }

    loan.status = LoanStatus.REJECTED;
    loan.rejectionReason = dto.rejectionReason ?? null;
    loan.reviewedAt = new Date();
    loan.reviewedBy = adminId;

    const saved = await this.loanRepo.save(loan);
    this.logger.log(`Loan ${loanId} rejected by admin ${adminId}`);
    return saved;
  }

  /**
   * Disburse an APPROVED loan into the customer's wallet.
   *
   * Ledger direction (inverted naming convention):
   *   • SYSTEM_LOAN_POOL LOSES funds → isCredit: false  (DEBIT  pool)
   *   • Customer wallet GAINS funds  → isCredit: true (CREDIT wallet)
   */
  async disburseLoan(
    loanId: string,
    adminId: string,
  ): Promise<LoanApplication> {
    return this.dataSource.transaction(async (manager) => {
      const loan = await manager.findOne(LoanApplication, {
        where: { loanId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!loan) throw new NotFoundException(`Loan ${loanId} not found`);

      if (loan.status !== LoanStatus.APPROVED) {
        throw new BadRequestException(
          `Loan must be in APPROVED status to disburse (current: ${loan.status})`,
        );
      }

      const wallet = await this.walletService.findByCustomer(loan.ccuuid);

      const disbursementAmount = new Decimal(loan.approvedAmount);
      const txId = crypto.randomUUID();

      const result = await this.ledgerService.postTransfer(
        {
          txId,
          idempotencyKey: `disburse-${loanId}`, // guaranteed unique per loan
          reference: `Loan disbursement ${loanId}`,
          participantId: loan.participantId,
          postedBy: adminId,
          legs: [
            {
              finAddress: SYSTEM_LOAN_POOL,
              amount: disbursementAmount.toFixed(4),
              isCredit: false, // DEBIT — money leaving the pool
              memo: `Disburse loan ${loanId} to ${loan.ccuuid}`,
            },
            {
              finAddress: wallet.finAddress,
              amount: disbursementAmount.toFixed(4),
              isCredit: true, // CREDIT — money arriving in wallet
              memo: `Loan disbursement ${loanId}`,
            },
          ],
        },
        manager,
      );

      loan.status = LoanStatus.ACTIVE;
      loan.disbursedAt = new Date();
      loan.ledgerJournalId = result.journalId;

      await manager.save(LoanApplication, loan);

      this.logger.log(
        `Loan ${loanId} disbursed to wallet ${wallet.finAddress} by admin ${adminId}`,
      );
      return loan;
    });
  }

  async getAllLoans(
    status?: LoanStatus,
    participantId?: string,
  ): Promise<LoanApplication[]> {
    const where: FindOptionsWhere<LoanApplication> = {};
    if (status) where.status = status;
    if (participantId) where.participantId = participantId;

    return this.loanRepo.find({
      where,
      order: { appliedAt: 'DESC' },
    });
  }

  // SCHEDULED JOB — OVERDUE DETECTION

  /**
   * Runs at midnight every day.   * Marks any ACTIVE loans whose dueDate has passed as OVERDUE.
   */
  @Cron('0 0 * * *')
  async markOverdueLoans(): Promise<void> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const result = await this.loanRepo
      .createQueryBuilder()
      .update(LoanApplication)
      .set({ status: LoanStatus.OVERDUE })
      .where('status = :status', { status: LoanStatus.ACTIVE })
      .andWhere('dueDate < :today', { today })
      .andWhere('outstandingBalance > :zero', { zero: 0 })
      .execute();

    if (result.affected && result.affected > 0) {
      this.logger.warn(`Marked ${result.affected} loan(s) as OVERDUE`);
    }
  }
}
