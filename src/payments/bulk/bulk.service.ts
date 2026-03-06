import csv = require('csv-parser');
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Readable } from 'stream';
import { BulkBatch } from '../entities/bulk-batch.entity';
import { BulkItem, ItemStatus } from '../entities/bulk-item.entity';
import { Transaction } from '../entities/transaction.entity';
import { CasService } from 'src/cas/cas.service';
import { AliasType } from 'src/common/enums/alias.enums';
import { BulkStatus } from 'src/common/enums/bulk.enums';
import {
  Currency,
  TransactionStatus,
  TransactionType,
} from 'src/common/enums/transaction.enums';

@Injectable()
export class BulkService {
  constructor(
    @InjectRepository(BulkBatch) private batchRepo: Repository<BulkBatch>,
    @InjectRepository(BulkItem) private itemRepo: Repository<BulkItem>,
    @InjectRepository(Transaction) private txRepo: Repository<Transaction>,
    private cas: CasService,
  ) {}

  async processCSV(
    participantId: string,
    debtorBic: string,
    debtorAccount: string,
    currency: Currency,
    file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('CSV file is missing');

    // Create batch — status starts as VALIDATING
    const batch = await this.batchRepo.save(
      this.batchRepo.create({
        participantId,
        debtorBic,
        debtorAccount,
        fileName: file.originalname,
        status: BulkStatus.PENDING,
      }),
    );

    const rows = await this.parseCsv(file.buffer);
    batch.totalRecords = rows.length;
    batch.status = BulkStatus.PROCESSING;
    await this.batchRepo.save(batch);

    for (const row of rows) {
      const aliasType: AliasType =
        (row.aliasType as AliasType) ?? AliasType.MSISDN;

      try {
        const receiver = await this.cas.resolveAlias(
          aliasType,
          row.receiverAlias,
        );

        const tx = this.txRepo.create({
          participantId,
          channel: TransactionType.BULK_PAYMENT,
          senderAlias: row.senderAlias,
          receiverAlias: row.receiverAlias,
          senderFinAddress: debtorAccount,
          receiverFinAddress: receiver.finAddress,
          amount: Number(row.amount),
          currency,
          status: TransactionStatus.COMPLETED,
          reference: `BULK-${batch.bulkId}`,
        });
        await this.txRepo.save(tx);

        await this.itemRepo.save(
          this.itemRepo.create({
            bulkId: batch.bulkId,
            senderAlias: row.senderAlias,
            receiverAlias: row.receiverAlias,
            amount: Number(row.amount),
            currency,
            status: ItemStatus.SUCCESS,
          }),
        );
        batch.processedRecords++;
      } catch (error) {
        await this.itemRepo.save(
          this.itemRepo.create({
            bulkId: batch.bulkId,
            senderAlias: row.senderAlias,
            receiverAlias: row.receiverAlias,
            amount: Number(row.amount),
            currency,
            status: ItemStatus.FAILED,
            errorMessage: error.message,
          }),
        );
        batch.failedRecords++;
      }
    }

    if (batch.failedRecords === 0) {
      batch.status = BulkStatus.COMPLETED;
    } else if (batch.processedRecords === 0) {
      batch.status = BulkStatus.FAILED;
    } else {
      batch.status = BulkStatus.PARTIAL;
    }
    await this.batchRepo.save(batch);

    return { bulkId: batch.bulkId, status: batch.status };
  }

  private parseCsv(buffer: Buffer): Promise<any[]> {
    return new Promise((resolve, reject) => {
      const rows: any[] = [];
      Readable.from(buffer)
        .pipe(csv())
        .on('data', (data) => rows.push(data))
        .on('end', () => resolve(rows))
        .on('error', reject);
    });
  }

  async findAll(participantId: string) {
    // FIX: scope by participantId
    return this.batchRepo.find({
      where: { participantId },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(bulkId: string) {
    const batch = await this.batchRepo.findOne({ where: { bulkId } });
    if (!batch) throw new NotFoundException(`Batch ${bulkId} not found`);
    return batch;
  }
}
