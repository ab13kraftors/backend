import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, In } from 'typeorm';
import * as crypto from 'crypto';

import { LoanApplication } from './entities/loan-application.entity';
import { LoanRepayment } from './entities/loan-repayment.entity';
import { ApplyLoanDto } from './dto/apply-loan.dto';

import { WalletService } from 'src/wallet/wallet.service';
import { LedgerService } from 'src/ledger/ledger.service';
import { KycService } from 'src/kyc/kyc.service';

@Injectable()
export class LoanService {
  constructor(
    @InjectRepository(LoanApplication)
    private loanRepo: Repository<LoanApplication>,

    @InjectRepository(LoanRepayment)
    private repayRepo: Repository<LoanRepayment>,

    private walletService: WalletService,
    private ledgerService: LedgerService,
    private kycService: KycService,
    private dataSource: DataSource,
  ) {}

  async applyLoan(ccuuid: string, participantId: string, dto: ApplyLoanDto) {
    await this.kycService.requireTier(ccuuid, 'HARD_APPROVED');

    const existing = await this.loanRepo.findOne({
      where: {
        ccuuid,
        status: In(['PENDING', 'ACTIVE']),
      },
    });

    if (existing) throw new ConflictException('Existing loan active');

    const loan = this.loanRepo.create({
      ccuuid,
      participantId,
      requestedAmount: dto.amount,
      outstandingBalance: dto.amount,
      status: 'PENDING',
      purpose: dto.purpose,
    });

    return this.loanRepo.save(loan);
  }

  async disburseLoan(loanId: string, adminId: string) {
    return this.dataSource.transaction(async (manager) => {
      const loan = await manager.findOne(LoanApplication, {
        where: { loanId },
      });

      if (!loan) throw new NotFoundException();

      const wallet = await this.walletService.findByCustomer(loan.ccuuid);

      const txId = crypto.randomUUID();

      const result = await this.ledgerService.postTransfer({
        txId,
        reference: `Loan disbursement ${loan.loanId}`,
        participantId: loan.participantId,
        postedBy: adminId,
        legs: [
          {
            finAddress: 'SYSTEM_LOAN_POOL',
            amount: loan.approvedAmount,
            isCredit: false,
          },
          {
            finAddress: wallet.finAddress,
            amount: loan.approvedAmount,
            isCredit: true,
          },
        ],
      });

      loan.status = 'ACTIVE';
      loan.disbursedAt = new Date();
      loan.ledgerJournalId = result.journalId;

      await manager.save(loan);

      return loan;
    });
  }

  async repayLoan(ccuuid: string, loanId: string, amount: string) {
    return this.dataSource.transaction(async (manager) => {
      const loan = await manager.findOne(LoanApplication, {
        where: { loanId },
      });

      const wallet = await this.walletService.findByCustomer(ccuuid);

      const balance = await this.ledgerService.getDerivedBalance(
        wallet.finAddress,
      );

      if (Number(balance) < Number(amount))
        throw new BadRequestException('Insufficient funds');

      const txId = crypto.randomUUID();

      const result = await this.ledgerService.postTransfer({
        txId,
        reference: `Loan repayment ${loan.loanId}`,
        participantId: loan.participantId,
        postedBy: ccuuid,
        legs: [
          {
            finAddress: wallet.finAddress,
            amount,
            isCredit: false,
          },
          {
            finAddress: 'SYSTEM_LOAN_POOL',
            amount,
            isCredit: true,
          },
        ],
      });

      loan.outstandingBalance = String(
        Number(loan.outstandingBalance) - Number(amount),
      );

      if (Number(loan.outstandingBalance) <= 0) loan.status = 'REPAID';

      await manager.save(loan);

      const repayment = manager.create(LoanRepayment, {
        loanId,
        amount,
        ledgerJournalId: result.journalId,
      });

      await manager.save(repayment);

      return repayment;
    });
  }
}
