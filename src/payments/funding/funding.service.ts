import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import Decimal from 'decimal.js';

import { FundingWallet } from './entities/funding.entity';
import { Wallet } from 'src/wallet/entities/wallet.entity';
import { Transaction } from '../entities/transaction.entity';

import { CreateFundingDto } from './dto/create-funding.dto';
import {
  Currency,
  TransactionStatus,
  TransactionType,
} from 'src/common/enums/transaction.enums';

import { LedgerService } from 'src/ledger/ledger.service';
import { AccountsService } from 'src/accounts/accounts.service';
import { PaymentsService } from '../payments.service';
import { SYSTEM_POOL } from 'src/common/constants';

@Injectable()
export class FundingService {
  private readonly SYSTEM_POOL_FIN = SYSTEM_POOL;

  constructor(
    @InjectRepository(FundingWallet)
    private readonly fundingRepo: Repository<FundingWallet>,

    @InjectRepository(Wallet)
    private readonly walletRepo: Repository<Wallet>,

    @InjectRepository(Transaction)
    private readonly txRepo: Repository<Transaction>,

    private readonly ledgerService: LedgerService,
    private readonly accountsService: AccountsService,
    private readonly paymentsService: PaymentsService,
    private readonly dataSource: DataSource,
  ) {
    Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });
  }

  async fundingWallet(participantId: string, dto: CreateFundingDto) {
    const wallet = await this.walletRepo.findOne({
      where: { walletId: dto.walletId, participantId },
    });

    if (!wallet) {
      throw new NotFoundException('Wallet does not exist or access denied');
    }

    if (dto.currency !== Currency.SLE) {
      throw new BadRequestException('Only SLE funding is supported');
    }

    const amount = new Decimal(dto.amount);
    if (amount.isNaN() || amount.lte(0)) {
      throw new BadRequestException('Invalid amount');
    }

    const amountStr = amount.toFixed(2);
    const sourceFinAddress =
      dto.sourceFinAddress?.trim() || this.SYSTEM_POOL_FIN;
    const destinationFinAddress = wallet.finAddress;
    const ledgerTxId = this.paymentsService.generateReference('FUND');

    return this.dataSource.transaction('SERIALIZABLE', async (manager) => {
      if (dto.idempotencyKey) {
        const existing = await manager.getRepository(FundingWallet).findOne({
          where: { idempotencyKey: dto.idempotencyKey },
        });

        if (existing) {
          return existing;
        }
      }

      await this.accountsService.assertFinAddressActive(
        sourceFinAddress,
        manager,
      );
      await this.accountsService.assertFinAddressActive(
        destinationFinAddress,
        manager,
      );

      const funding = manager.getRepository(FundingWallet).create({
        walletId: wallet.walletId,
        participantId,
        customerId: wallet.customerId,
        accountId: wallet.accountId ?? undefined,
        sourceFinAddress,
        destinationFinAddress,
        method: dto.method,
        amount: amountStr,
        currency: dto.currency,
        status: TransactionStatus.INITIATED,
        externalReference:
          dto.externalReference ||
          this.paymentsService.generateExternalId('FUND'),
        idempotencyKey: dto.idempotencyKey,
        ledgerTxId,
      });

      const savedFunding = await manager
        .getRepository(FundingWallet)
        .save(funding);

      try {
        const transfer = await this.ledgerService.postTransfer(
          {
            txId: ledgerTxId,
            idempotencyKey: dto.idempotencyKey,
            reference: `Wallet funding ${wallet.walletId}`,
            participantId,
            postedBy: 'funding-service',
            currency: wallet.currency,
            legs: [
              {
                finAddress: sourceFinAddress,
                amount: amountStr,
                isCredit: false,
                memo: `Wallet funding source -> ${destinationFinAddress}`,
              },
              {
                finAddress: destinationFinAddress,
                amount: amountStr,
                isCredit: true,
                memo: `Wallet funded from ${sourceFinAddress}`,
              },
            ],
          },
          manager,
        );

        savedFunding.status = TransactionStatus.COMPLETED;
        savedFunding.journalId = transfer.journalId;

        await manager.getRepository(FundingWallet).save(savedFunding);

        await manager.getRepository(Transaction).save(
          manager.getRepository(Transaction).create({
            participantId,
            customerId: wallet.customerId,
            channel: TransactionType.CREDIT_TRANSFER,
            senderAlias: sourceFinAddress,
            receiverAlias: wallet.customerId,
            senderFinAddress: sourceFinAddress,
            receiverFinAddress: destinationFinAddress,
            sourceType:
              sourceFinAddress === this.SYSTEM_POOL_FIN ? 'ACCOUNT' : 'ACCOUNT',
            destinationType: 'WALLET',
            destinationWalletId: wallet.walletId,
            destinationAccountId: wallet.accountId ?? undefined,
            amount: amountStr,
            currency: wallet.currency,
            status: TransactionStatus.COMPLETED,
            reference: savedFunding.externalReference,
            externalId: this.paymentsService.generateExternalId('TXN'),
            journalId: transfer.journalId,
            narration: `Wallet funding ${wallet.walletId}`,
          }),
        );

        return {
          fundingId: savedFunding.fundingId,
          walletId: savedFunding.walletId,
          status: savedFunding.status,
          amount: savedFunding.amount,
          currency: savedFunding.currency,
          journalId: savedFunding.journalId,
          ledgerTxId: savedFunding.ledgerTxId,
          externalReference: savedFunding.externalReference,
        };
      } catch (error: any) {
        savedFunding.status = TransactionStatus.FAILED;
        savedFunding.failureReason = error?.message || 'Wallet funding failed';

        await manager.getRepository(FundingWallet).save(savedFunding);
        throw error;
      }
    });
  }

  async findAll(participantId: string) {
    return this.fundingRepo.find({
      where: { participantId },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(participantId: string, fundingId: string) {
    const funding = await this.fundingRepo.findOne({
      where: { fundingId, participantId },
    });

    if (!funding) {
      throw new NotFoundException('Funding record not found');
    }

    return funding;
  }
}
