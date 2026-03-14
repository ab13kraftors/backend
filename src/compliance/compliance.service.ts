import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ComplianceLog } from './entities/compliance-log.entity';

@Injectable()
export class ComplianceService {
  constructor(
    @InjectRepository(ComplianceLog) private logRepo: Repository<ComplianceLog>,
  ) {}

  async log(
    action: string,
    userId: string,
    participantId: string,
    metadata?: any,
  ) {
    const log = this.logRepo.create({
      action,
      userId,
      participantId,
      metadata,
      reported: metadata?.amount > 500000, // set before save
    });
    return await this.logRepo.save(log);
  }

  // Cron for EOD reports (use ScheduleModule)
  async generateDailyReport() {
    // Query logs, export to BSL format (CSV/API)
  }
}
