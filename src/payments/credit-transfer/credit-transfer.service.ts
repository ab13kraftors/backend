import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import Decimal from 'decimal.js';

import { Transaction } from '../transaction/entities/transaction.entity';
import { CreditTransferDto } from './dto/credit-transfer.dto';

import { CasService } from 'src/cas/cas.service';
import { LedgerService } from 'src/ledger/ledger.service';
import { AccountsService } from 'src/accounts/accounts.service';
import { WalletService } from 'src/wallet/wallet.service';
import { CustomerService } from 'src/customer/customer.service';
import { PaymentsService } from '../payments.service';

import {
  Currency,
  TransactionStatus,
  TransactionType,
} from 'src/common/enums/transaction.enums';

type ResolvedSource = {
  sourceType: 'ACCOUNT' | 'WALLET';
  customerId?: string;
  senderAlias: string;
  senderFinAddress: string;
  sourceAccountId?: string | null;
  sourceWalletId?: string | null;
};

type ResolvedReceiver = {
  receiverAlias: string;
  receiverFinAddress: string;
};

@Injectable()
export class CreditTransferService {
  constructor(
    @InjectRepository(Transaction)
    private readonly txRepo: Repository<Transaction>,

    private readonly casService: CasService,
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

  async initiate(participantId: string, dto: CreditTransferDto) {
    const amount = new Decimal(dto.amount);

    if (amount.isNaN() || amount.lte(0)) {
      throw new BadRequestException('Invalid amount');
    }

    await this.set

    if (dto.currency !== Currency.SLE) {
      throw new BadRequestException('Only SLE currency is supported');
    }

    return this.dataSource.transaction('SERIALIZABLE', async (manager) => {
      const source = await this.resolveSource(participantId, dto, manager);
      const receiver = await this.resolveReceiver(dto);

      if (source.senderFinAddress === receiver.receiverFinAddress) {
        throw new BadRequestException('Sender and receiver cannot be same');
      }

      if (dto.pin && source.sourceType === 'WALLET') {
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
      }

      if (dto.pin && source.sourceType === 'ACCOUNT' && source.customerId) {
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
      await this.accountsService.assertFinAddressActive(
        receiver.receiverFinAddress,
        manager,
      );

      const tx = manager.getRepository(Transaction).create({
        participantId,
        channel: TransactionType.CREDIT_TRANSFER,
        senderAlias: source.senderAlias,
        receiverAlias: receiver.receiverAlias,
        senderFinAddress: source.senderFinAddress,
        receiverFinAddress: receiver.receiverFinAddress,
        amount: Number(amount.toFixed(2)),
        currency: dto.currency,
        status: TransactionStatus.INITIATED,
        reference: dto.reference,
        externalId:
          dto.idempotencyKey || this.paymentsService.generateReference(),
      });

      const savedTx = await manager.getRepository(Transaction).save(tx);

      try {
        const transferResult = await this.ledgerService.postTransfer(
          {
            txId: savedTx.txId,
            idempotencyKey: dto.idempotencyKey,
            reference: savedTx.reference ?? `CT-${savedTx.txId}`,
            participantId,
            postedBy: 'credit-transfer-service',
            currency: dto.currency,
            legs: [
              {
                finAddress: savedTx.senderFinAddress,
                amount: amount.toFixed(2),
                isCredit: false,
                memo:
                  dto.narration?.trim() ||
                  `Credit transfer to ${savedTx.receiverAlias}`,
              },
              {
                finAddress: savedTx.receiverFinAddress,
                amount: amount.toFixed(2),
                isCredit: true,
                memo:
                  dto.narration?.trim() ||
                  `Credit transfer from ${savedTx.senderAlias}`,
              },
            ],
          },
          manager,
        );

        if (transferResult.status === 'already_processed') {
          savedTx.status = TransactionStatus.COMPLETED;
          await manager.getRepository(Transaction).save(savedTx);

          return {
            status: 'success',
            txId: savedTx.txId,
            journalId: transferResult.journalId,
            senderFinAddress: savedTx.senderFinAddress,
            receiverFinAddress: savedTx.receiverFinAddress,
          };
        }

        savedTx.status = TransactionStatus.COMPLETED;
        await manager.getRepository(Transaction).save(savedTx);

        const [senderBalance, receiverBalance] = await Promise.all([
          this.ledgerService.getDerivedBalance(savedTx.senderFinAddress),
          this.ledgerService.getDerivedBalance(savedTx.receiverFinAddress),
        ]);

        return {
          status: 'success',
          txId: savedTx.txId,
          journalId: transferResult.journalId,
          senderFinAddress: savedTx.senderFinAddress,
          receiverFinAddress: savedTx.receiverFinAddress,
          senderBalance,
          receiverBalance,
        };
      } catch (error) {
        savedTx.status = TransactionStatus.FAILED;
        await manager.getRepository(Transaction).save(savedTx);
        throw error;
      }
    });
  }

  private async resolveSource(
    participantId: string,
    dto: CreditTransferDto,
    manager: EntityManager,
  ): Promise<ResolvedSource> {
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
        senderAlias: dto.senderAlias || wallet.customerId,
        senderFinAddress: wallet.finAddress,
        sourceWalletId: wallet.walletId,
        sourceAccountId: wallet.accountId,
      };
    }

    if (dto.sourceFinAddress) {
      await this.accountsService.assertFinAddressActive(
        dto.sourceFinAddress,
        manager,
      );

      return {
        sourceType: 'ACCOUNT',
        customerId: dto.customerId,
        senderAlias: dto.senderAlias || dto.customerId || dto.sourceFinAddress,
        senderFinAddress: dto.sourceFinAddress,
        sourceAccountId: dto.sourceAccountId ?? null,
      };
    }

    if (dto.senderAlias && dto.senderAliasType) {
      const sender = await this.casService.resolveAlias(
        dto.senderAliasType,
        dto.senderAlias,
      );

      return {
        sourceType: 'ACCOUNT',
        customerId: dto.customerId,
        senderAlias: dto.senderAlias,
        senderFinAddress: sender.finAddress,
      };
    }

    throw new BadRequestException(
      'Provide sourceFinAddress or senderAlias/senderAliasType for ACCOUNT source',
    );
  }

  private async resolveReceiver(
    dto: CreditTransferDto,
  ): Promise<ResolvedReceiver> {
    if (dto.receiverFinAddress) {
      return {
        receiverAlias: dto.receiverAlias || dto.receiverFinAddress,
        receiverFinAddress: dto.receiverFinAddress,
      };
    }

    if (dto.receiverAlias && dto.receiverAliasType) {
      const receiver = await this.casService.resolveAlias(
        dto.receiverAliasType,
        dto.receiverAlias,
      );

      return {
        receiverAlias: dto.receiverAlias,
        receiverFinAddress: receiver.finAddress,
      };
    }

    throw new BadRequestException(
      'Provide receiverFinAddress or receiverAlias with receiverAliasType',
    );
  }
}
