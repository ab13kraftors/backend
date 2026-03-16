
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

  /**
   * GET /admin/loan
   * List all loans. Optional filters: ?status=PENDING&participantId=xxx
   */
  @Get()
  listAll(
    @Query('status') status?: LoanStatus,
    @Query('participantId') participantId?: string,
  ) {
    return this.loanService.getAllLoans(status, participantId);
  }

  /**
   * POST /admin/loan/:loanId/approve
   * Approve a PENDING loan application and set the approved amount + due date.
   */
  @Post(':loanId/approve')
  approve(
    @Param('loanId', ParseUUIDPipe) loanId: string,
    @Body() dto: ApproveLoanDto,
    @Req() req: Request & { user: { adminId: string } },
  ) {
    return this.loanService.approveLoan(loanId, req.user.adminId, dto);
  }

  /**
   * POST /admin/loan/:loanId/reject
   * Reject a PENDING loan application.
   */
  @Post(':loanId/reject')
  reject(
    @Param('loanId', ParseUUIDPipe) loanId: string,
    @Body() dto: RejectLoanDto,
    @Req() req: Request & { user: { adminId: string } },
  ) {
    return this.loanService.rejectLoan(loanId, req.user.adminId, dto);
  }

  /**
   * POST /admin/loan/:loanId/disburse
   * Disburse an APPROVED loan into the customer's wallet via the ledger engine.
   * Idempotent — the ledger key `disburse-{loanId}` prevents double-disbursement.
   */
  @Post(':loanId/disburse')
  @Roles(Role.ADMIN) // Disburse is ADMIN-only, not LOAN_OFFICER
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

  /**
   * POST /loan/apply
   * Submit a new loan application.
   */
  @Post('apply')
  apply(
    @Participant() participantId: string,
    @Body() dto: ApplyLoanDto,
    @Req() req: Request & { user: { ccuuid: string } },
  ) {
    return this.loanService.applyLoan(req.user.ccuuid, participantId, dto);
  }

  /**
   * GET /loan
   * Retrieve all loans for the authenticated customer.
   */
  @Get()
  getMyLoans(@Req() req: Request & { user: { ccuuid: string } }) {
    return this.loanService.getLoansByCustomer(req.user.ccuuid);
  }

  /**
   * GET /loan/:loanId
   * Retrieve a single loan (must belong to the authenticated customer).
   */
  @Get(':loanId')
  getLoan(
    @Param('loanId', ParseUUIDPipe) loanId: string,
    @Req() req: Request & { user: { ccuuid: string } },
  ) {
    return this.loanService.getLoanById(loanId, req.user.ccuuid);
  }

  /**
   * GET /loan/:loanId/repayments
   * Retrieve repayment history for a specific loan.
   */
  @Get(':loanId/repayments')
  getRepayments(
    @Param('loanId', ParseUUIDPipe) loanId: string,
    @Req() req: Request & { user: { ccuuid: string } },
  ) {
    return this.loanService.getRepaymentHistory(loanId, req.user.ccuuid);
  }

  /**
   * POST /loan/:loanId/repay
   * Submit a repayment (full or partial) against an active loan.
   */
  @Post(':loanId/repay')
  repay(
    @Param('loanId', ParseUUIDPipe) loanId: string,
    @Body() dto: RepayLoanDto,
    @Req() req: Request & { user: { ccuuid: string } },
  ) {
    return this.loanService.repayLoan(req.user.ccuuid, loanId, dto);
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

import { WalletModule } from '../wallet/wallet.module';
import { LedgerModule } from '../ledger/ledger.module';
import { KycModule } from '../kyc/kyc.module';
import { AuthModule } from 'src/auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([LoanApplication, LoanRepayment]),
    WalletModule,
    LedgerModule,
    KycModule,
    AuthModule,
  ],
  providers: [LoanService],
  controllers: [LoanController, LoanAdminController],
  exports: [LoanService],
})
export class LoanModule {}

/////////////////////////
// FILE: src/loan/loan.service.ts
/////////////////////////
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
              finAddress: SYSTEM_POOL,
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
   *   • SYSTEM_POOL LOSES funds → isCredit: false  (DEBIT  pool)
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
              finAddress: SYSTEM_POOL,
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
// FILE: src/loan/dto/loan-config.dto.ts
/////////////////////////
import { IsBoolean, IsNumberString, IsOptional } from 'class-validator';

export class LoanConfigDto {
  /** Toggle whether loan applications are accepted at all */
  @IsOptional()
  @IsBoolean()
  loansEnabled?: boolean;

  /** Platform-wide minimum loan amount */
  @IsOptional()
  @IsNumberString()
  minAmount?: string;

  /** Platform-wide maximum loan amount */
  @IsOptional()
  @IsNumberString()
  maxAmount?: string;

  /** Maximum number of loan applications a single customer may submit per day */
  @IsOptional()
  @IsNumberString()
  maxApplicationsPerDay?: string;
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
@Index(['ccuuid', 'status'])
export class LoanApplication {
  @PrimaryGeneratedColumn('uuid')
  loanId: string;

  @Column()
  @Index()
  ccuuid: string;

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
export class LoanRepayment {
  @PrimaryGeneratedColumn('uuid')
  repaymentId: string;

  @Column()
  @Index()
  loanId: string;

  @Column()
  ccuuid: string;

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
