import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Card } from './entities/card.entity';
import { AddCardDto } from './dto/add-card.dto';
import { WalletService } from '../wallet/wallet.service';
import { LedgerService } from '../ledger/ledger.service';
import { SYSTEM_POOL } from '../common/constants';
import * as crypto from 'crypto';

@Injectable()
export class CardService {
  private readonly logger = new Logger(CardService.name);

  constructor(
    @InjectRepository(Card) private cardRepo: Repository<Card>,
    private walletService: WalletService,
    private ledgerService: LedgerService,
    private dataSource: DataSource,
  ) {}

  async addCard(
    participantId: string,
    ccuuid: string,
    dto: AddCardDto,
  ): Promise<Card> {
    const card = this.cardRepo.create({
      participantId,
      ccuuid,
      ...dto,
    });
    return this.cardRepo.save(card);
  }

  async getCards(participantId: string, ccuuid: string): Promise<Card[]> {
    return this.cardRepo.find({
      where: { participantId, ccuuid, isActive: true },
      order: { createdAt: 'DESC' },
    });
  }

  async getCardSecure(
    participantId: string,
    cardId: string,
  ): Promise<Card | null> {
    return this.cardRepo
      .createQueryBuilder('card')
      .addSelect('card.token')
      .where('card.cardId = :cardId AND card.participantId = :participantId', {
        cardId,
        participantId,
      })
      .getOne();
  }

  async chargeCard(
    participantId: string,
    ccuuid: string,
    cardId: string,
    amount: number,
  ) {
    const card = await this.cardRepo.findOne({
      where: { cardId, participantId, ccuuid, isActive: true },
    });

    if (!card) throw new NotFoundException('Card not found');
    if (amount <= 0) {
      throw new BadRequestException('Amount must be greater than zero');
    }

    const transactionRef = `CARD-CHG-${Date.now()}`;

    this.logger.log(
      `Initiated charge of ${amount} on card ${card.last4} for ${ccuuid}. Ref: ${transactionRef}`,
    );

    return {
      status: 'PENDING_GATEWAY',
      message: 'Charge initiated. Waiting for gateway webhook confirmation.',
      transactionRef,
    };
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
      this.logger.warn('Invalid webhook signature detected.');
      throw new BadRequestException('Invalid Signature');
    }

    if (payload.event === 'charge.success') {
      const { amount, ccuuid, participantId, transactionRef } = payload.data;

      const wallet = await this.walletService.getWallet(ccuuid, participantId);
      if (!wallet) throw new NotFoundException('Wallet not found');

      const walletFinAddress = wallet.account?.finAddress;
      if (!walletFinAddress) {
        throw new NotFoundException('Wallet account not found');
      }

      await this.dataSource.transaction(async (manager) => {
        await this.ledgerService.postTransfer(
          {
            txId: transactionRef,
            reference: `Card Deposit: ${transactionRef}`,
            participantId,
            postedBy: 'card-webhook',
            legs: [
              {
                finAddress: SYSTEM_POOL,
                amount: String(amount),
                isCredit: false,
                memo: `Gateway settlement for ${transactionRef}`,
              },
              {
                finAddress: walletFinAddress,
                amount: String(amount),
                isCredit: true,
                memo: `Card top-up ${transactionRef}`,
              },
            ],
          },
          manager,
        );
      });

      this.logger.log(
        `Successfully funded wallet for ${ccuuid} with ${amount}`,
      );
    }
  }

  async removeCard(participantId: string, cardId: string) {
    const card = await this.cardRepo.findOne({
      where: { cardId, participantId },
    });

    if (!card) throw new NotFoundException('Card not found');

    card.isActive = false;
    return this.cardRepo.save(card);
  }
}
