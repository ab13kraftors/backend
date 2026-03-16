
/////////////////////////
// FILE: src/card/card-webhook.controller.ts
/////////////////////////
import {
  Controller,
  Post,
  Req,
  Res,
  Headers,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { CardService } from './card.service';

@Controller('webhooks/cards')
export class CardWebhookController {
  private readonly logger = new Logger(CardWebhookController.name);

  constructor(private readonly cardService: CardService) {}

  @Post('gateway-callback')
  async handleGatewayCallback(
    @Headers('x-gateway-signature') signature: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    try {
      await this.cardService.handleGatewayCallback(req.body, signature);
      // Acknowledge receipt to the gateway so it stops retrying
      return res.status(HttpStatus.OK).send({ status: 'Processed' });
    } catch (error) {
      this.logger.error(`Webhook processing failed: ${error.message}`);
      // Return 200 even on expected validation errors to prevent gateway webhook spamming
      return res.status(HttpStatus.OK).send({ error: error.message });
    }
  }
}

/////////////////////////
// FILE: src/card/card.controller.ts
/////////////////////////
import {
  Body,
  Controller,
  Param,
  Post,
  UseGuards,
  Get,
  Delete,
  Request,
} from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { CardService } from './card.service';
import { AddCardDto } from './dto/add-card.dto';
import { Participant } from 'src/common/decorators/participant/participant.decorator';

@Controller('/api/fp/cards')
@UseGuards(JwtAuthGuard)
export class CardController {
  constructor(private readonly cardService: CardService) {}

  @Post(':ccuuid')
  addCard(
    @Param('ccuuid') ccuuid: string,
    @Body() dto: AddCardDto,
    @Participant() participantId: string,
  ) {
    return this.cardService.addCard(participantId, ccuuid, dto);
  }

  @Get(':ccuuid')
  listCards(
    @Param('ccuuid') ccuuid: string,
    @Participant() participantId: string,
  ) {
    return this.cardService.getCards(participantId, ccuuid);
  }

  @Delete(':cardId')
  removeCard(
    @Param('cardId') cardId: string,
    @Participant() participantId: string,
  ) {
    return this.cardService.removeCard(participantId, cardId);
  }

  @Post(':ccuuid/:cardId/charge')
  chargeCard(
    @Param('ccuuid') ccuuid: string,
    @Param('cardId') cardId: string,
    @Body('amount') amount: number,
    @Participant() participantId: string,
  ) {
    return this.cardService.chargeCard(participantId, ccuuid, cardId, amount);
  }
}

/////////////////////////
// FILE: src/card/card.module.ts
/////////////////////////
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Card } from './entities/card.entity'; // Path to your card entity
import { CardService } from './card.service';
import { CardController } from './card.controller';
import { WalletModule } from 'src/wallet/wallet.module';
import { LedgerModule } from 'src/ledger/ledger.module';
import { CardWebhookController } from './card-webhook.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Card]), WalletModule, LedgerModule],
  controllers: [CardController, CardWebhookController],
  providers: [CardService],
  exports: [CardService],
})
export class CardModule {}

/////////////////////////
// FILE: src/card/card.service.ts
/////////////////////////
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

/////////////////////////
// FILE: src/card/dto/add-card.dto.ts
/////////////////////////
// src/card/dto/add-card.dto.ts
import {
  IsString,
  IsEnum,
  Min,
  Max,
  Length,
  IsNumberString,
} from 'class-validator';
import { CardBrand } from 'src/common/enums/card.enums';

export class AddCardDto {
  @IsString()
  token: string;

  @IsNumberString()
  @Length(6, 6)
  bin: string;

  @IsNumberString()
  @Length(4, 4)
  last4: string;

  @IsEnum(CardBrand)
  brand: CardBrand;

  @Min(1)
  @Max(12)
  expMonth: number;

  @Min(new Date().getFullYear())
  expYear: number;
}

/////////////////////////
// FILE: src/card/dto/verify-card.dto.ts
/////////////////////////

/////////////////////////
// FILE: src/card/entities/card.entity.ts
/////////////////////////
// src/card/entities/card.entity.ts
import { CardBrand } from 'src/common/enums/card.enums';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('cards')
@Index(['ccuuid', 'participantId'])
export class Card {
  @PrimaryGeneratedColumn('uuid')
  cardId: string;

  @Column()
  participantId: string;

  @Column()
  ccuuid: string;

  @Column({ select: false })
  token: string;

  @Column()
  bin: string; // First 6 digits (safe to store)

  @Column()
  last4: string;

  @Column({ type: 'enum', enum: CardBrand })
  brand: CardBrand;

  @Column()
  expMonth: number;

  @Column()
  expYear: number;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
