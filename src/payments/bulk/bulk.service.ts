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
import { AccountsService } from 'src/accounts/accounts.service';

@Injectable()
export class BulkService {
  constructor(
    @InjectRepository(BulkBatch) private batchRepo: Repository<BulkBatch>,
    @InjectRepository(BulkItem) private itemRepo: Repository<BulkItem>,
    @InjectRepository(Transaction) private txRepo: Repository<Transaction>,
    private accService: AccountsService,
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

    // Initial Batch Creation
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

    // Process each row
    for (const row of rows) {
      const aliasType: AliasType =
        (row.aliasType as AliasType) ?? AliasType.MSISDN;

      try {
        // Resolve Alias
        const receiver = await this.cas.resolveAlias(
          aliasType,
          row.receiverAlias,
        );

        // Create Transaction
        const tx = await this.txRepo.save(
          this.txRepo.create({
            participantId,
            channel: TransactionType.BULK_PAYMENT,
            senderAlias: row.senderAlias,
            receiverAlias: row.receiverAlias,
            senderFinAddress: debtorAccount,
            receiverFinAddress: receiver.finAddress,
            amount: Number(row.amount),
            currency,
            status: TransactionStatus.INITIATED,
            reference: `BULK-${batch.bulkId}`,
          }),
        );

        // Ledger Transfer
        try {
          await this.accService.transfer(
            tx.txId,
            tx.senderFinAddress,
            tx.receiverFinAddress,
            Number(tx.amount),
          );

          // Update Transaction to COMPLETED
          tx.status = TransactionStatus.COMPLETED;
          await this.txRepo.save(tx);

          // Record Item Success
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
        } catch (transferError) {
          // Handle specific ledger failure (e.g., Insufficient Funds)
          tx.status = TransactionStatus.FAILED;
          await this.txRepo.save(tx);

          // Re-throw to catch block below to log item failure
          throw new Error(`Ledger Transfer Failed: ${transferError.message}`);
        }
      } catch (error) {
        // Log failure and CONTINUE loop
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

    // 3. Finalize Batch Status
    if (batch.failedRecords === 0) {
      batch.status = BulkStatus.COMPLETED;
    } else if (batch.processedRecords === 0) {
      batch.status = BulkStatus.FAILED;
    } else {
      batch.status = BulkStatus.PARTIAL;
    }

    await this.batchRepo.save(batch);
    return {
      bulkId: batch.bulkId,
      status: batch.status,
      processed: batch.processedRecords,
      failed: batch.failedRecords,
    };
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
