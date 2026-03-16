import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import Decimal from 'decimal.js';
import * as crypto from 'crypto';

import { CardInstrument } from './entities/card.entity';
import { MobileMoneyInstrument } from './entities/mobile-money.entity';
import {
  PaymentInstrumentStatus,
  PaymentInstrumentType,
} from './enums/payment-instrument.enum';
import { AddCardDto } from './dto/add-card.dto';
import { AddMobileMoneyDto } from './dto/add-mobile-money.dto';
import { ChargeCardDto } from './dto/charge-card.dto';
import { CashInMobileMoneyDto } from './dto/cashin-mobile-money.dto';

import { WalletService } from 'src/wallet/wallet.service';
import { AccountsService } from 'src/accounts/accounts.service';
import { LedgerService } from 'src/ledger/ledger.service';
import { Transaction } from 'src/payments/entities/transaction.entity';
import {
  Currency,
  TransactionStatus,
  TransactionType,
} from 'src/common/enums/transaction.enums';
import { SYSTEM_POOL } from 'src/common/constants';

@Injectable()
export class PaymentInstrumentsService {
  private readonly logger = new Logger(PaymentInstrumentsService.name);
  private readonly SYSTEM_POOL_FIN = SYSTEM_POOL;

  constructor(
    @InjectRepository(CardInstrument)
    private readonly cardRepo: Repository<CardInstrument>,

    @InjectRepository(MobileMoneyInstrument)
    private readonly mobileMoneyRepo: Repository<MobileMoneyInstrument>,

    @InjectRepository(Transaction)
    private readonly txRepo: Repository<Transaction>,

    private readonly walletService: WalletService,
    private readonly accountsService: AccountsService,
    private readonly ledgerService: LedgerService,
    private readonly dataSource: DataSource,
  ) {
    Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });
  }

  async addCard(
    participantId: string,
    dto: AddCardDto,
  ): Promise<CardInstrument> {
    return this.dataSource.transaction(async (manager) => {
      if (dto.accountId) {
        await this.accountsService.findByIdForParticipant(
          dto.accountId,
          participantId,
        );
      }

      if (dto.walletId) {
        await this.walletService.getWallet(dto.walletId, participantId);
      }

      if (dto.isDefault) {
        await manager.getRepository(CardInstrument).update(
          {
            participantId,
            customerId: dto.customerId,
          },
          { isDefault: false },
        );
      }

      const card = manager.getRepository(CardInstrument).create({
        participantId,
        customerId: dto.customerId,
        accountId: dto.accountId ?? null,
        walletId: dto.walletId ?? null,
        instrumentType: PaymentInstrumentType.CARD,
        status: PaymentInstrumentStatus.ACTIVE,
        isDefault: dto.isDefault ?? false,
        token: dto.token,
        bin: dto.bin,
        last4: dto.last4,
        brand: dto.brand,
        expMonth: dto.expMonth,
        expYear: dto.expYear,
        holderName: dto.holderName,
      });

      return manager.getRepository(CardInstrument).save(card);
    });
  }

  async addMobileMoney(
    participantId: string,
    dto: AddMobileMoneyDto,
  ): Promise<MobileMoneyInstrument> {
    return this.dataSource.transaction(async (manager) => {
      if (dto.accountId) {
        await this.accountsService.findByIdForParticipant(
          dto.accountId,
          participantId,
        );
      }

      if (dto.walletId) {
        await this.walletService.getWallet(dto.walletId, participantId);
      }

      const existing = await manager
        .getRepository(MobileMoneyInstrument)
        .findOne({
          where: {
            participantId,
            customerId: dto.customerId,
            msisdn: dto.msisdn,
          },
        });

      if (existing) {
        return existing;
      }

      if (dto.isDefault) {
        await manager.getRepository(MobileMoneyInstrument).update(
          {
            participantId,
            customerId: dto.customerId,
          },
          { isDefault: false },
        );
      }

      const instrument = manager.getRepository(MobileMoneyInstrument).create({
        participantId,
        customerId: dto.customerId,
        accountId: dto.accountId ?? null,
        walletId: dto.walletId ?? null,
        instrumentType: PaymentInstrumentType.MOBILE_MONEY,
        status: PaymentInstrumentStatus.ACTIVE,
        isDefault: dto.isDefault ?? false,
        provider: dto.provider,
        msisdn: dto.msisdn,
        accountName: dto.accountName,
      });

      return manager.getRepository(MobileMoneyInstrument).save(instrument);
    });
  }

  async listCards(
    participantId: string,
    customerId: string,
  ): Promise<CardInstrument[]> {
    return this.cardRepo.find({
      where: {
        participantId,
        customerId,
        status: PaymentInstrumentStatus.ACTIVE,
      },
      order: { createdAt: 'DESC' },
    });
  }

  async listMobileMoney(
    participantId: string,
    customerId: string,
  ): Promise<MobileMoneyInstrument[]> {
    return this.mobileMoneyRepo.find({
      where: {
        participantId,
        customerId,
        status: PaymentInstrumentStatus.ACTIVE,
      },
      order: { createdAt: 'DESC' },
    });
  }

  async getCardSecure(
    participantId: string,
    instrumentId: string,
  ): Promise<CardInstrument | null> {
    return this.cardRepo
      .createQueryBuilder('card')
      .addSelect('card.token')
      .where('card.instrumentId = :instrumentId', { instrumentId })
      .andWhere('card.participantId = :participantId', { participantId })
      .getOne();
  }

  async chargeCard(
    participantId: string,
    instrumentId: string,
    dto: ChargeCardDto,
  ) {
    const card = await this.cardRepo.findOne({
      where: {
        instrumentId,
        participantId,
        customerId: dto.customerId,
        status: PaymentInstrumentStatus.ACTIVE,
      },
    });

    if (!card) {
      throw new NotFoundException('Card not found');
    }

    const amount = new Decimal(dto.amount);
    if (amount.isNaN() || amount.lte(0)) {
      throw new BadRequestException('Amount must be greater than zero');
    }

    const destination = dto.walletId
      ? await this.walletService.getWallet(dto.walletId, participantId)
      : dto.accountId
        ? await this.accountsService.findByIdForParticipant(
            dto.accountId,
            participantId,
          )
        : card.walletId
          ? await this.walletService.getWallet(card.walletId, participantId)
          : card.accountId
            ? await this.accountsService.findByIdForParticipant(
                card.accountId,
                participantId,
              )
            : null;

    if (!destination) {
      throw new BadRequestException('No destination account or wallet found');
    }

    const destinationFinAddress = (destination as any).finAddress;
    if (!destinationFinAddress) {
      throw new BadRequestException('Destination finAddress not found');
    }

    const transactionRef = `CARD-CHG-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;

    this.logger.log(
      `Charge initiated for card ${card.last4}. Ref: ${transactionRef}`,
    );

    return {
      status: 'PENDING_GATEWAY',
      message: 'Charge initiated. Waiting for gateway webhook confirmation.',
      transactionRef,
      instrumentId: card.instrumentId,
      destinationFinAddress,
      amount: amount.toFixed(2),
    };
  }

  async cashInFromMobileMoney(
    participantId: string,
    instrumentId: string,
    dto: CashInMobileMoneyDto,
  ) {
    const instrument = await this.mobileMoneyRepo.findOne({
      where: {
        instrumentId,
        participantId,
        customerId: dto.customerId,
        status: PaymentInstrumentStatus.ACTIVE,
      },
    });

    if (!instrument) {
      throw new NotFoundException('Mobile money instrument not found');
    }

    const amount = new Decimal(dto.amount);
    if (amount.isNaN() || amount.lte(0)) {
      throw new BadRequestException('Invalid amount');
    }

    const destination = dto.walletId
      ? await this.walletService.getWallet(dto.walletId, participantId)
      : dto.accountId
        ? await this.accountsService.findByIdForParticipant(
            dto.accountId,
            participantId,
          )
        : instrument.walletId
          ? await this.walletService.getWallet(
              instrument.walletId,
              participantId,
            )
          : instrument.accountId
            ? await this.accountsService.findByIdForParticipant(
                instrument.accountId,
                participantId,
              )
            : null;

    if (!destination) {
      throw new BadRequestException('No destination account or wallet found');
    }

    const destinationFinAddress = (destination as any).finAddress;
    const txId = `MOMO-CASHIN-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
    const amountStr = amount.toFixed(2);

    return this.dataSource.transaction('SERIALIZABLE', async (manager) => {
      await this.accountsService.assertFinAddressActive(
        this.SYSTEM_POOL_FIN,
        manager,
      );
      await this.accountsService.assertFinAddressActive(
        destinationFinAddress,
        manager,
      );

      const transfer = await this.ledgerService.postTransfer(
        {
          txId,
          idempotencyKey: dto.idempotencyKey,
          reference: `Mobile money cash-in ${instrument.msisdn}`,
          participantId,
          postedBy: 'mobile-money-service',
          currency: Currency.SLE,
          legs: [
            {
              finAddress: this.SYSTEM_POOL_FIN,
              amount: amountStr,
              isCredit: false,
              memo: `Mobile money settlement -> ${destinationFinAddress}`,
            },
            {
              finAddress: destinationFinAddress,
              amount: amountStr,
              isCredit: true,
              memo: `Cash-in from ${instrument.provider} ${instrument.msisdn}`,
            },
          ],
        },
        manager,
      );

      await manager.getRepository(Transaction).save(
        manager.getRepository(Transaction).create({
          participantId,
          customerId: dto.customerId,
          channel: TransactionType.CREDIT_TRANSFER,
          senderAlias: instrument.msisdn,
          receiverAlias: dto.customerId,
          senderFinAddress: this.SYSTEM_POOL_FIN,
          receiverFinAddress: destinationFinAddress,
          destinationType: dto.walletId ? 'WALLET' : 'ACCOUNT',
          destinationWalletId: dto.walletId ?? instrument.walletId ?? undefined,
          destinationAccountId:
            dto.accountId ?? instrument.accountId ?? undefined,
          amount: amountStr,
          currency: Currency.SLE,
          status: TransactionStatus.COMPLETED,
          reference: txId,
          journalId: transfer.journalId,
          narration: `Mobile money cash-in`,
        }),
      );

      return {
        status: 'SUCCESS',
        txId,
        journalId: transfer.journalId,
      };
    });
  }

  async handleGatewayCallback(payload: any, signature: string) {
    const secret = process.env.CARD_GATEWAY_SECRET;

    if (!secret) {
      this.logger.error('CARD_GATEWAY_SECRET is not configured');
      throw new BadRequestException('Gateway secret not configured');
    }

    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(JSON.stringify(payload))
      .digest('hex');

    if (signature !== expectedSignature) {
      throw new BadRequestException('Invalid Signature');
    }

    if (payload.event !== 'charge.success') {
      return { status: 'ignored' };
    }

    const {
      amount,
      participantId,
      customerId,
      instrumentId,
      walletId,
      accountId,
      transactionRef,
      idempotencyKey,
    } = payload.data;

    const card = await this.getCardSecure(participantId, instrumentId);
    if (!card) {
      throw new NotFoundException('Card not found');
    }

    const destination = walletId
      ? await this.walletService.getWallet(walletId, participantId)
      : accountId
        ? await this.accountsService.findByIdForParticipant(
            accountId,
            participantId,
          )
        : card.walletId
          ? await this.walletService.getWallet(card.walletId, participantId)
          : card.accountId
            ? await this.accountsService.findByIdForParticipant(
                card.accountId,
                participantId,
              )
            : null;

    if (!destination) {
      throw new NotFoundException('Destination account or wallet not found');
    }

    const destinationFinAddress = (destination as any).finAddress;
    const amountStr = new Decimal(amount).toFixed(2);

    await this.dataSource.transaction('SERIALIZABLE', async (manager) => {
      const transfer = await this.ledgerService.postTransfer(
        {
          txId: transactionRef,
          idempotencyKey,
          reference: `Card deposit ${transactionRef}`,
          participantId,
          postedBy: 'card-webhook',
          currency: Currency.SLE,
          legs: [
            {
              finAddress: this.SYSTEM_POOL_FIN,
              amount: amountStr,
              isCredit: false,
              memo: `Gateway settlement for ${transactionRef}`,
            },
            {
              finAddress: destinationFinAddress,
              amount: amountStr,
              isCredit: true,
              memo: `Card topup ${transactionRef}`,
            },
          ],
        },
        manager,
      );

      await manager.getRepository(Transaction).save(
        manager.getRepository(Transaction).create({
          participantId,
          customerId,
          channel: TransactionType.CREDIT_TRANSFER,
          senderAlias: `CARD-${card.last4}`,
          receiverAlias: customerId,
          senderFinAddress: this.SYSTEM_POOL_FIN,
          receiverFinAddress: destinationFinAddress,
          sourceType: 'ACCOUNT',
          destinationType: walletId || card.walletId ? 'WALLET' : 'ACCOUNT',
          destinationWalletId: walletId ?? card.walletId ?? undefined,
          destinationAccountId: accountId ?? card.accountId ?? undefined,
          amount: amountStr,
          currency: Currency.SLE,
          status: TransactionStatus.COMPLETED,
          reference: transactionRef,
          journalId: transfer.journalId,
          narration: `Card funding settlement`,
        }),
      );
    });

    return { status: 'processed' };
  }

  async removeCard(participantId: string, instrumentId: string) {
    const card = await this.cardRepo.findOne({
      where: { instrumentId, participantId },
    });

    if (!card) {
      throw new NotFoundException('Card not found');
    }

    card.status = PaymentInstrumentStatus.INACTIVE;
    card.isDefault = false;
    return this.cardRepo.save(card);
  }

  async removeMobileMoney(participantId: string, instrumentId: string) {
    const instrument = await this.mobileMoneyRepo.findOne({
      where: { instrumentId, participantId },
    });

    if (!instrument) {
      throw new NotFoundException('Mobile money instrument not found');
    }

    instrument.status = PaymentInstrumentStatus.INACTIVE;
    instrument.isDefault = false;
    return this.mobileMoneyRepo.save(instrument);
  }
}
