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
import { LedgerService } from 'src/ledger/ledger.service';

@Injectable()
export class BulkService {
  constructor(
    // Inject repositories
    @InjectRepository(BulkBatch) private batchRepo: Repository<BulkBatch>,
    @InjectRepository(BulkItem) private itemRepo: Repository<BulkItem>,
    @InjectRepository(Transaction) private txRepo: Repository<Transaction>,

    // Inject services
    private cas: CasService,
    private ledgerService: LedgerService,
  ) {}

  // ================== processCSV ==================
  // Processes CSV bulk payment file
  async processCSV(
    participantId: string,
    debtorBic: string,
    debtorAccount: string,
    currency: Currency,
    file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('CSV file is missing');

    // Create initial batch record
    const batch = await this.batchRepo.save(
      this.batchRepo.create({
        participantId,
        debtorBic,
        debtorAccount,
        fileName: file.originalname,
        status: BulkStatus.PENDING,
      }),
    );

    // Parse CSV file
    const rows = await this.parseCsv(file.buffer);

    // Validate CSV schema
    const schemaErrors = this.validateCsvSchema(rows);
    if (schemaErrors.length > 0) {
      await this.batchRepo.update(batch.bulkId, { status: BulkStatus.FAILED });
      throw new BadRequestException(
        `CSV schema invalid: ${schemaErrors.join('; ')}`,
      );
    }

    batch.totalRecords = rows.length;
    batch.status = BulkStatus.PROCESSING;
    await this.batchRepo.save(batch);

    // Process each CSV row
    for (const row of rows) {
      const aliasType: AliasType =
        (row.aliasType as AliasType) ?? AliasType.MSISDN;

      try {
        // Resolve receiver alias to FIN address
        const receiver = await this.cas.resolveAlias(
          aliasType,
          row.receiverAlias,
        );

        // Create transaction record
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

        try {
          // Perform ledger transfer
          await this.ledgerService.postTransfer({
            txId: tx.txId,
            reference: `BULK-${batch.bulkId}`,
            participantId,
            postedBy: 'system',
            legs: [
              {
                finAddress: tx.senderFinAddress,
                amount: String(tx.amount),
                isCredit: true, // DEBIT leg — money leaving sender
                memo: `Bulk payment to ${tx.receiverAlias}`,
              },
              {
                finAddress: tx.receiverFinAddress,
                amount: String(tx.amount),
                isCredit: false, // CREDIT leg — money arriving at receiver
                memo: `Bulk payment from ${tx.senderAlias}`,
              },
            ],
          });

          // Mark transaction completed
          tx.status = TransactionStatus.COMPLETED;
          await this.txRepo.save(tx);

          // Record successful item
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
          // Mark transaction failed if ledger transfer fails
          tx.status = TransactionStatus.FAILED;
          await this.txRepo.save(tx);

          throw new Error(`Ledger Transfer Failed: ${transferError.message}`);
        }
      } catch (error) {
        // Record failed item and continue processing
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

    // Determine final batch status
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

  // ================== validateCsvSchema ==================
  // Validates CSV required fields and data format
  private validateCsvSchema(rows: any[]): string[] {
    if (!rows || rows.length === 0) return ['CSV file is empty'];

    const errors: string[] = [];

    rows.forEach((row, i) => {
      const rowNum = i + 2; // account for header row

      // Check required fields
      for (const field of ['senderAlias', 'receiverAlias', 'amount']) {
        if (!row[field] || String(row[field]).trim() === '') {
          errors.push(`Row ${rowNum}: missing required field '${field}'`);
        }
      }

      // Validate amount
      if (
        row.amount &&
        (isNaN(Number(row.amount)) || Number(row.amount) <= 0)
      ) {
        errors.push(
          `Row ${rowNum}: 'amount' must be a positive number, got '${row.amount}'`,
        );
      }
    });

    return errors;
  }

  // ================== parseCsv ==================
  // Converts CSV buffer into JSON rows
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

  // ================== findAll ==================
  // Returns all bulk batches for a participant
  async findAll(participantId: string) {
    return this.batchRepo.find({
      where: { participantId },
      order: { createdAt: 'DESC' },
    });
  }

  // ================== findOne ==================
  // Returns a specific bulk batch
  async findOne(bulkId: string) {
    const batch = await this.batchRepo.findOne({ where: { bulkId } });

    if (!batch) throw new NotFoundException(`Batch ${bulkId} not found`);

    return batch;
  }
}
