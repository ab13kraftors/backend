import csv = require('csv-parser');
import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { Readable } from 'stream';
import Decimal from 'decimal.js';

import { BulkBatch } from './entities/bulk-batch.entity';
import { BulkItem, ItemStatus } from './entities/bulk-item.entity';
import { Transaction } from '../transaction/entities/transaction.entity';

import { CasService } from 'src/cas/cas.service';
import { AliasType } from 'src/common/enums/alias.enums';
import { BulkStatus } from 'src/common/enums/bulk.enums';
import {
  Currency,
  TransactionStatus,
  TransactionType,
} from 'src/common/enums/transaction.enums';
import { LedgerService } from 'src/ledger/ledger.service';
import { AccountsService } from 'src/accounts/accounts.service';
import { WalletService } from 'src/wallet/wallet.service';
import { CustomerService } from 'src/customer/customer.service';
import { PaymentsService } from '../payments.service';
import { BulkUploadDto } from './dto/bulk-upload.dto';

type ParsedBulkRow = {
  senderAlias: string;
  receiverAlias: string;
  amount: string;
  aliasType?: AliasType;
  reference?: string;
  narration?: string;
};

type ResolvedBulkSource = {
  sourceType: 'ACCOUNT' | 'WALLET';
  customerId?: string;
  senderAlias: string;
  senderFinAddress: string;
  sourceAccountId?: string | null;
  sourceWalletId?: string | null;
};

@Injectable()
export class BulkService {
  constructor(
    @InjectRepository(BulkBatch)
    private readonly batchRepo: Repository<BulkBatch>,

    @InjectRepository(BulkItem)
    private readonly itemRepo: Repository<BulkItem>,

    @InjectRepository(Transaction)
    private readonly txRepo: Repository<Transaction>,

    private readonly cas: CasService,
    private readonly ledgerService: LedgerService,
    private readonly accountsService: AccountsService,

    @Inject(forwardRef(() => WalletService))
    private readonly walletService: WalletService,

    @Inject(forwardRef(() => CustomerService))
    private readonly customerService: CustomerService,

    private readonly paymentsService: PaymentsService,
    private readonly dataSource: DataSource,
  ) {
    Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });
  }

  async processCSV(
    participantId: string,
    dto: BulkUploadDto,
    file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('CSV file is missing');
    }

    if (dto.currency !== Currency.SLE) {
      throw new BadRequestException('Only SLE currency is supported');
    }

    const rows = await this.parseCsv(file.buffer);
    const schemaErrors = this.validateCsvSchema(rows);

    if (schemaErrors.length > 0) {
      throw new BadRequestException(
        `CSV schema invalid: ${schemaErrors.join('; ')}`,
      );
    }

    return this.dataSource.transaction('SERIALIZABLE', async (manager) => {
      const source = await this.resolveSource(participantId, dto, manager);

      if (source.sourceType === 'WALLET') {
        const wallet = await this.walletService.getWallet(
          source.sourceWalletId!,
          participantId,
        );

        if (!wallet) {
          throw new NotFoundException('Wallet not found');
        }

        await this.walletService.verifyPinWithLock(
          wallet,
          participantId,
          dto.pin,
        );
      } else if (source.customerId) {
        await this.customerService.verifyPin(
          source.customerId,
          participantId,
          dto.pin,
        );
      }

      await this.accountsService.assertFinAddressActive(
        source.senderFinAddress,
        manager,
      );

      const totalAmount = rows.reduce(
        (sum, row) => sum.add(new Decimal(row.amount)),
        new Decimal(0),
      );

      const batch = await manager.getRepository(BulkBatch).save(
        manager.getRepository(BulkBatch).create({
          participantId,
          customerId: source.customerId,
          debtorBic: dto.debtorBic,
          sourceType: source.sourceType,
          sourceAccountId: source.sourceAccountId ?? undefined,
          sourceWalletId: source.sourceWalletId ?? undefined,
          sourceFinAddress: source.senderFinAddress,
          fileName: file.originalname,
          currency: Currency.SLE,
          totalRecords: rows.length,
          processedRecords: 0,
          failedRecords: 0,
          totalAmount: totalAmount.toFixed(2),
          processedAmount: '0.00',
          status: BulkStatus.PROCESSING,
          uploadedBy: source.customerId || 'system',
        }),
      );

      let processedAmount = new Decimal(0);
      let processedRecords = 0;
      let failedRecords = 0;

      for (const row of rows) {
        const aliasType: AliasType = row.aliasType ?? AliasType.MSISDN;
        const amount = new Decimal(row.amount);

        try {
          const receiver = await this.cas.resolveAlias(
            aliasType,
            row.receiverAlias,
          );

          if (receiver.finAddress === source.senderFinAddress) {
            throw new BadRequestException('Sender and receiver cannot be same');
          }

          await this.accountsService.assertFinAddressActive(
            receiver.finAddress,
            manager,
          );

          const tx = await manager.getRepository(Transaction).save(
            manager.getRepository(Transaction).create({
              participantId,
              channel: TransactionType.BULK_PAYMENT,
              senderAlias: row.senderAlias || source.senderAlias,
              receiverAlias: row.receiverAlias,
              senderFinAddress: source.senderFinAddress,
              receiverFinAddress: receiver.finAddress,
              amount: Number(amount.toFixed(2)),
              currency: Currency.SLE,
              status: TransactionStatus.INITIATED,
              reference:
                row.reference ||
                `BULK-${batch.bulkId}-${processedRecords + failedRecords + 1}`,
              externalId: this.paymentsService.generateReference(),
            }),
          );

          try {
            await this.ledgerService.postTransfer(
              {
                txId: tx.txId,
                idempotencyKey: dto.idempotencyKey
                  ? `${dto.idempotencyKey}:${processedRecords + failedRecords + 1}`
                  : undefined,
                reference: tx.reference ?? `BULK-${batch.bulkId}`,
                participantId,
                postedBy: 'bulk-service',
                currency: Currency.SLE,
                legs: [
                  {
                    finAddress: tx.senderFinAddress,
                    amount: amount.toFixed(2),
                    isCredit: false,
                    memo:
                      row.narration?.trim() ||
                      `Bulk payment to ${tx.receiverAlias}`,
                  },
                  {
                    finAddress: tx.receiverFinAddress,
                    amount: amount.toFixed(2),
                    isCredit: true,
                    memo:
                      row.narration?.trim() ||
                      `Bulk payment from ${tx.senderAlias}`,
                  },
                ],
              },
              manager,
            );

            tx.status = TransactionStatus.COMPLETED;
            await manager.getRepository(Transaction).save(tx);

            await manager.getRepository(BulkItem).save(
              manager.getRepository(BulkItem).create({
                bulkId: batch.bulkId,
                txId: tx.txId,
                senderAlias: tx.senderAlias,
                receiverAlias: tx.receiverAlias,
                receiverFinAddress: tx.receiverFinAddress,
                amount: amount.toFixed(2),
                currency: Currency.SLE,
                status: ItemStatus.SUCCESS,
                uploadedBy: source.customerId || 'system',
              }),
            );

            processedRecords += 1;
            processedAmount = processedAmount.add(amount);
          } catch (transferError: any) {
            tx.status = TransactionStatus.FAILED;
            await manager.getRepository(Transaction).save(tx);

            await manager.getRepository(BulkItem).save(
              manager.getRepository(BulkItem).create({
                bulkId: batch.bulkId,
                txId: tx.txId,
                senderAlias: tx.senderAlias,
                receiverAlias: tx.receiverAlias,
                receiverFinAddress: tx.receiverFinAddress,
                amount: amount.toFixed(2),
                currency: Currency.SLE,
                status: ItemStatus.FAILED,
                errorMessage:
                  transferError?.message || 'Ledger transfer failed',
                uploadedBy: source.customerId || 'system',
              }),
            );

            failedRecords += 1;
          }
        } catch (error: any) {
          await manager.getRepository(BulkItem).save(
            manager.getRepository(BulkItem).create({
              bulkId: batch.bulkId,
              senderAlias: row.senderAlias || source.senderAlias,
              receiverAlias: row.receiverAlias,
              amount: amount.toFixed(2),
              currency: Currency.SLE,
              status: ItemStatus.FAILED,
              errorMessage: error?.message || 'Bulk item failed',
              uploadedBy: source.customerId || 'system',
            }),
          );

          failedRecords += 1;
        }
      }

      batch.processedRecords = processedRecords;
      batch.failedRecords = failedRecords;
      batch.processedAmount = processedAmount.toFixed(2);

      if (failedRecords === 0) {
        batch.status = BulkStatus.COMPLETED;
      } else if (processedRecords === 0) {
        batch.status = BulkStatus.FAILED;
      } else {
        batch.status = BulkStatus.PARTIAL;
      }

      await manager.getRepository(BulkBatch).save(batch);

      return {
        bulkId: batch.bulkId,
        status: batch.status,
        processed: batch.processedRecords,
        failed: batch.failedRecords,
        totalAmount: batch.totalAmount,
        processedAmount: batch.processedAmount,
        sourceFinAddress: batch.sourceFinAddress,
      };
    });
  }

  private validateCsvSchema(rows: ParsedBulkRow[]): string[] {
    if (!rows || rows.length === 0) {
      return ['CSV file is empty'];
    }

    const errors: string[] = [];

    rows.forEach((row, i) => {
      const rowNum = i + 2;

      for (const field of ['senderAlias', 'receiverAlias', 'amount']) {
        if (
          !row[field as keyof ParsedBulkRow] ||
          String(row[field as keyof ParsedBulkRow]).trim() === ''
        ) {
          errors.push(`Row ${rowNum}: missing required field '${field}'`);
        }
      }

      if (
        row.amount &&
        (!/^\d+(\.\d{1,2})?$/.test(String(row.amount)) ||
          new Decimal(row.amount).lte(0))
      ) {
        errors.push(
          `Row ${rowNum}: 'amount' must be a positive number with up to 2 decimals`,
        );
      }
    });

    return errors;
  }

  private parseCsv(buffer: Buffer): Promise<ParsedBulkRow[]> {
    return new Promise((resolve, reject) => {
      const rows: ParsedBulkRow[] = [];

      Readable.from(buffer)
        .pipe(csv())
        .on('data', (data) =>
          rows.push({
            senderAlias: String(data.senderAlias ?? '').trim(),
            receiverAlias: String(data.receiverAlias ?? '').trim(),
            amount: String(data.amount ?? '').trim(),
            aliasType: data.aliasType
              ? (String(data.aliasType).trim() as AliasType)
              : undefined,
            reference: data.reference
              ? String(data.reference).trim()
              : undefined,
            narration: data.narration
              ? String(data.narration).trim()
              : undefined,
          }),
        )
        .on('end', () => resolve(rows))
        .on('error', reject);
    });
  }

  async findAll(participantId: string) {
    return this.batchRepo.find({
      where: { participantId },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(participantId: string, bulkId: string) {
    const batch = await this.batchRepo.findOne({
      where: { bulkId, participantId },
    });

    if (!batch) {
      throw new NotFoundException(`Batch ${bulkId} not found`);
    }

    return batch;
  }

  async findItems(participantId: string, bulkId: string) {
    const batch = await this.batchRepo.findOne({
      where: { bulkId, participantId },
      select: ['bulkId'],
    });

    if (!batch) {
      throw new NotFoundException(`Batch ${bulkId} not found`);
    }

    return this.itemRepo.find({
      where: { bulkId },
      order: { itemId: 'ASC' },
    });
  }

  private async resolveSource(
    participantId: string,
    dto: BulkUploadDto,
    manager: EntityManager,
  ): Promise<ResolvedBulkSource> {
    if (dto.sourceType === 'WALLET') {
      if (!dto.sourceWalletId) {
        throw new BadRequestException(
          'sourceWalletId is required for wallet source',
        );
      }

      const wallet = await this.walletService.getWallet(
        dto.sourceWalletId,
        participantId,
      );

      if (!wallet) {
        throw new NotFoundException('Wallet not found');
      }

      return {
        sourceType: 'WALLET',
        customerId: wallet.customerId,
        senderAlias: wallet.customerId,
        senderFinAddress: wallet.finAddress,
        sourceWalletId: wallet.walletId,
        sourceAccountId: wallet.accountId,
      };
    }

    if (!dto.sourceFinAddress) {
      throw new BadRequestException(
        'sourceFinAddress is required for account source',
      );
    }

    return {
      sourceType: 'ACCOUNT',
      customerId: dto.customerId,
      senderAlias: dto.customerId || dto.sourceFinAddress,
      senderFinAddress: dto.sourceFinAddress,
      sourceAccountId: dto.sourceAccountId ?? null,
    };
  }
}
