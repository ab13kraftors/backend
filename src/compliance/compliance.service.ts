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
