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
import { SYSTEM_POOL } from 'src/common/constants';
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

    private readonly ledgerService: LedgerService,
    private readonly walletService: WalletService,
    private readonly kycService: KycService,
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
        requestedAmount: amount.toFixed(4),
        outstandingBalance: amount.toFixed(4),
        status: LoanStatus.PENDING,
        purpose: dto.purpose ?? null,
      }),
    );
  }

  async repayLoan(
    customerId: string,
    loanId: string,
    dto: RepayLoanDto,
  ): Promise<LoanRepayment> {
    return this.dataSource.transaction(async (manager) => {
      if (dto.idempotencyKey) {
        const dup = await manager.findOne(LoanRepayment, {
          where: { idempotencyKey: dto.idempotencyKey },
        });
        if (dup) return dup;
      }

      const loan = await manager.findOne(LoanApplication, {
        where: { loanId, customerId },
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
        await this.ledgerService.getDerivedBalance(wallet.finAddress),
      );

      if (balance.lt(repayAmount)) {
        throw new BadRequestException('Insufficient balance');
      }

      const txId = crypto.randomUUID();

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
              amount: repayAmount.toFixed(4),
              isCredit: false,
            },
            {
              finAddress: SYSTEM_POOL,
              amount: repayAmount.toFixed(4),
              isCredit: true,
            },
          ],
        },
        manager,
      );

      const newOutstanding = outstanding.minus(repayAmount);
      const before = loan.outstandingBalance;

      loan.outstandingBalance = newOutstanding.toFixed(4);

      if (newOutstanding.lte(0)) {
        loan.status = LoanStatus.REPAID;
      }

      await manager.save(loan);

      return manager.save(
        manager.create(LoanRepayment, {
          loanId,
          customerId,
          participantId: loan.participantId,
          amount: repayAmount.toFixed(4),
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
    loan.approvedAmount = new Decimal(dto.approvedAmount).toFixed(4);
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
              amount: amount.toFixed(4),
              isCredit: false,
            },
            {
              finAddress: wallet.finAddress,
              amount: amount.toFixed(4),
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

  async getLoanById(loanId: string, customerId: string) {
    const loan = await this.loanRepo.findOne({
      where: { loanId, customerId },
    });

    if (!loan) throw new NotFoundException();

    return loan;
  }

  async getRepaymentHistory(loanId: string, customerId: string) {
    await this.getLoanById(loanId, customerId);

    return this.repayRepo.find({
      where: { loanId, customerId },
      order: { repaidAt: 'DESC' },
    });
  }

  async getAllLoans(status?: LoanStatus, participantId?: string) {
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
