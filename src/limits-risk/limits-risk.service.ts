import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LimitConfig } from './entities/limit-config.entity';
import { LimitUsage } from './entities/limit-usage.entity';
import { Repository } from 'typeorm';
import Decimal from 'decimal.js';

@Injectable()
export class LimitsRiskService {
  constructor(
    @InjectRepository(LimitConfig)
    private readonly configRepo: Repository<LimitConfig>,

    @InjectRepository(LimitUsage)
    private readonly usageRepo: Repository<LimitUsage>,
  ) {
    Decimal.set({ precision: 20 });
  }

  // ================= GET CONFIG =================
  async getConfig(participantId: string, level: string) {
    const config = await this.configRepo.findOne({
      where: { participantId, level },
    });

    if (!config) {
      throw new BadRequestException('Limit config not found');
    }

    return config;
  }

  // ================= GET / CREATE USAGE =================
  async getOrCreateUsage(
    participantId: string,
    customerId: string,
  ): Promise<LimitUsage> {
    const today = new Date().toISOString().slice(0, 10);

    let usage = await this.usageRepo.findOne({
      where: { participantId, customerId, date: today },
    });

    if (!usage) {
      usage = this.usageRepo.create({
        participantId,
        customerId,
        date: today,
        dailySent: '0',
        dailyReceived: '0',
        monthlyTotal: '0',
      });

      usage = await this.usageRepo.save(usage);
    }

    return usage;
  }

  // ================= CHECK LIMIT =================
  async check(
    participantId: string,
    customerId: string,
    level: string,
    amountStr: string,
    direction: 'DEBIT' | 'CREDIT',
  ) {
    const config = await this.getConfig(participantId, level);
    const usage = await this.getOrCreateUsage(participantId, customerId);

    const amount = new Decimal(amountStr);

    if (amount.gt(config.singleTxLimit)) {
      throw new BadRequestException('Exceeds single transaction limit');
    }

    if (direction === 'DEBIT') {
      const newDaily = new Decimal(usage.dailySent).add(amount);
      if (newDaily.gt(config.dailySendLimit)) {
        throw new BadRequestException('Daily send limit exceeded');
      }
    } else {
      const newDaily = new Decimal(usage.dailyReceived).add(amount);
      if (newDaily.gt(config.dailyReceiveLimit)) {
        throw new BadRequestException('Daily receive limit exceeded');
      }
    }

    const newMonthly = new Decimal(usage.monthlyTotal).add(amount);
    if (newMonthly.gt(config.monthlyLimit)) {
      throw new BadRequestException('Monthly limit exceeded');
    }

    return true;
  }

  // ================= CONSUME LIMIT =================
  async consume(
    participantId: string,
    customerId: string,
    amountStr: string,
    direction: 'DEBIT' | 'CREDIT',
  ) {
    const usage = await this.getOrCreateUsage(participantId, customerId);
    const amount = new Decimal(amountStr);

    if (direction === 'DEBIT') {
      usage.dailySent = new Decimal(usage.dailySent).add(amount).toString();
    } else {
      usage.dailyReceived = new Decimal(usage.dailyReceived)
        .add(amount)
        .toString();
    }

    usage.monthlyTotal = new Decimal(usage.monthlyTotal).add(amount).toString();

    return this.usageRepo.save(usage);
  }
}
