import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import Decimal from 'decimal.js';
import * as crypto from 'crypto';

import { Funding } from './entities/funding.entity';
import { CreateFundingDto } from './dto/create-funding.dto';

import { LedgerService } from 'src/ledger/ledger.service';
import { AccountsService } from 'src/accounts/accounts.service';
import { WalletService } from 'src/wallet/wallet.service';
import { SYSTEM_POOL } from 'src/common/constants';
import { TransactionStatus } from 'src/common/enums/transaction.enums';
import { ComplianceTxnType } from 'src/compliance/enums/compliance.enum';
import { ComplianceService } from 'src/compliance/compliance.service';
import { TransactionType } from 'src/common/enums/transaction.enums';
import { TransactionService } from '../transaction/transaction.service';

@Injectable()
export class FundingService {
  constructor(
    @InjectRepository(Funding)
    private repo: Repository<Funding>,

    private ledger: LedgerService,
    private accounts: AccountsService,
    private walletService: WalletService,
    private complianceService: ComplianceService,
    private transactionService: TransactionService,
    private dataSource: DataSource,
  ) {
    Decimal.set({ precision: 20 });
  }

  // ======================
  // 🔵 TOPUP (CARD/BANK/MM)
  // ======================
  async topup(participantId: string, dto: CreateFundingDto) {
    if (!dto.customerId) {
      throw new BadRequestException('customerId is required');
    }

    const amount = new Decimal(dto.amount);
    if (amount.lte(0)) {
      throw new BadRequestException('Invalid amount');
    }

    await this.complianceService.validate(
      {
        customerId: dto.customerId,
        type: ComplianceTxnType.FUNDING,
        amount: dto.amount,
        currency: dto.currency,
      },
      participantId,
    );

    if (dto.idempotencyKey) {
      const existing = await this.transactionService.findByExternalId(
        dto.idempotencyKey,
      );
      if (existing) return existing;
    }

    return this.dataSource.transaction(async (manager) => {
      // ✅ FIX 1: TYPE SAFE ACCOUNT
      const account = dto.accountId
        ? await this.accounts.findByIdForParticipant(
            dto.accountId,
            participantId,
          )
        : await this.accounts.findCustomerMainAccount(dto.customerId);

      if (!account) {
        throw new NotFoundException('Account not found');
      }
      const source = dto.sourceFinAddress || SYSTEM_POOL;
      await this.accounts.assertFinAddressActive(account.finAddress, manager);

      let tx = await this.transactionService.createTx(manager, {
        participantId,
        channel: TransactionType.CREDIT_TRANSFER,
        customerId: account.customerId,
        senderFinAddress: source,
        receiverFinAddress: account.finAddress,
        amount: Number(amount.toFixed(2)),
        currency: dto.currency,
        status: TransactionStatus.INITIATED,
        externalId: dto.idempotencyKey,
        reference: 'Funding Topup',
      });

      tx = await this.transactionService.updateTx(manager, tx.txId, {
        status: TransactionStatus.PROCESSING,
      });
      const txId = tx.txId;

      // 🔹 External → Account
      let result;

      try {
        result = await this.ledger.postTransfer(
          {
            txId,
            participantId,
            reference: 'Funding Topup',
            postedBy: 'funding',
            currency: dto.currency,
            legs: [
              {
                finAddress: source,
                amount: amount.toFixed(2),
                isCredit: false,
              },
              {
                finAddress: account.finAddress,
                amount: amount.toFixed(2),
                isCredit: true,
              },
            ],
          },
          manager,
        );
      } catch (error) {
        await this.transactionService.updateTx(manager, tx.txId, {
          status: TransactionStatus.FAILED,
          failureReason: error.message,
        });
        throw error;
      }

      // ✅ FIX 2: DECLARE OUTSIDE
      let destinationFinAddress = account.finAddress;
      let walletId: string | undefined = undefined;

      // 🔹 Optional Account → Wallet
      if (dto.walletId) {
        const wallet = await this.walletService.getWallet(
          dto.walletId,
          participantId,
        );

        if (!wallet) {
          throw new NotFoundException('Wallet not found');
        }

        const walletAccount = await this.accounts.findWalletAccount(
          wallet.walletId,
        );

        await this.ledger.postTransfer(
          {
            txId: crypto.randomUUID(),
            participantId,
            reference: 'Wallet Load',
            postedBy: 'funding',
            currency: dto.currency,
            legs: [
              {
                finAddress: account.finAddress,
                amount: amount.toFixed(2),
                isCredit: false,
              },
              {
                finAddress: walletAccount.finAddress,
                amount: amount.toFixed(2),
                isCredit: true,
              },
            ],
          },
          manager,
        );

        // ✅ FIX 3: STORE DESTINATION CORRECTLY
        destinationFinAddress = walletAccount.finAddress;
        walletId = wallet.walletId;
      }

      await this.transactionService.updateTx(manager, tx.txId, {
        status: TransactionStatus.COMPLETED,
        journalId: result.journalId,
        processedAt: new Date(),
      });

      return manager.getRepository(Funding).save(
        manager.getRepository(Funding).create({
          participantId,
          customerId: account.customerId ?? '', // ✅ FIX 4 (avoid undefined)
          accountId: account.accountId,
          walletId,
          sourceFinAddress: source,
          destinationFinAddress,
          amount: amount.toFixed(2),
          currency: dto.currency,
          method: dto.method,
          status: TransactionStatus.COMPLETED,
          journalId: result.journalId,
          idempotencyKey: dto.idempotencyKey,
        }),
      );
    });
  }

  // ======================
  // 🔴 WITHDRAW (ONLY BANK)
  // ======================
  async withdraw(participantId: string, dto: CreateFundingDto) {
    const amount = new Decimal(dto.amount);

    if (!dto.accountId) {
      throw new BadRequestException('accountId required for withdrawal');
    }

    if (!dto.destinationFinAddress) {
      throw new BadRequestException('destinationFinAddress required');
    }

    await this.complianceService.validate(
      {
        customerId: dto.customerId,
        type: ComplianceTxnType.WITHDRAW,
        amount: dto.amount,
        currency: dto.currency,
      },
      participantId,
    );

    if (dto.idempotencyKey) {
      const existing = await this.transactionService.findByExternalId(
        dto.idempotencyKey,
      );
      if (existing) return existing;
    }

    return this.dataSource.transaction(async (manager) => {
      const account = await this.accounts.findByIdForParticipant(
        dto.accountId,
        participantId,
      );

      if (!account) {
        throw new NotFoundException('Account not found');
      }

      let tx = await this.transactionService.createTx(manager, {
        participantId,
        channel: TransactionType.CREDIT_TRANSFER,
        customerId: account.customerId,
        senderFinAddress: account.finAddress,
        receiverFinAddress: dto.destinationFinAddress,
        amount: Number(amount.toFixed(2)),
        currency: dto.currency,
        status: TransactionStatus.INITIATED,
        externalId: dto.idempotencyKey,
        reference: 'Withdraw',
      });

      tx = await this.transactionService.updateTx(manager, tx.txId, {
        status: TransactionStatus.PROCESSING,
      });
      const txId = tx.txId;

      await this.accounts.assertFinAddressActive(account.finAddress, manager);

      let result;
      try {
        result = await this.ledger.postTransfer(
          {
            txId,
            participantId,
            reference: 'Withdraw',
            postedBy: 'funding',
            currency: dto.currency, // ✅ FIXED
            legs: [
              {
                finAddress: account.finAddress,
                amount: amount.toFixed(2),
                isCredit: false,
              },
              {
                finAddress: dto.destinationFinAddress,
                amount: amount.toFixed(2),
                isCredit: true,
              },
            ],
          },
          manager,
        );
      } catch (error) {
        await this.transactionService.updateTx(manager, tx.txId, {
          status: TransactionStatus.FAILED,
          failureReason: error.message,
        });
        throw error;
      }

      await this.transactionService.updateTx(manager, tx.txId, {
        status: TransactionStatus.COMPLETED,
        journalId: result.journalId,
        processedAt: new Date(),
      });

      return manager.getRepository(Funding).save(
        manager.getRepository(Funding).create({
          participantId,
          customerId: account.customerId,
          accountId: account.accountId,
          destinationFinAddress: dto.destinationFinAddress,
          amount: amount.toFixed(2),
          currency: dto.currency,
          method: dto.method,
          status: TransactionStatus.COMPLETED,
          journalId: result.journalId,
          idempotencyKey: dto.idempotencyKey,
        }),
      );
    });
  }

  findAll(participantId: string) {
    return this.repo.find({
      where: { participantId },
      order: { createdAt: 'DESC' },
    });
  }

  findOne(participantId: string, fundingId: string) {
    return this.repo.findOne({
      where: { fundingId, participantId },
    });
  }
}
