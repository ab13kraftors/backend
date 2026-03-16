import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Post,
  Req,
  Res,
  UseGuards,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { Participant } from 'src/common/decorators/participant/participant.decorator';
import { PaymentInstrumentsService } from './payment-instruments.service';
import { AddCardDto } from './dto/add-card.dto';
import { AddMobileMoneyDto } from './dto/add-mobile-money.dto';
import { ChargeCardDto } from './dto/charge-card.dto';
import { CashInMobileMoneyDto } from './dto/cashin-mobile-money.dto';

@Controller('/api/fp/payment-instruments')
@UseGuards(JwtAuthGuard)
export class PaymentInstrumentsController {
  constructor(
    private readonly paymentInstrumentsService: PaymentInstrumentsService,
  ) {}

  @Post('cards')
  addCard(@Body() dto: AddCardDto, @Participant() participantId: string) {
    return this.paymentInstrumentsService.addCard(participantId, dto);
  }

  @Get('cards/:customerId')
  listCards(
    @Param('customerId') customerId: string,
    @Participant() participantId: string,
  ) {
    return this.paymentInstrumentsService.listCards(participantId, customerId);
  }

  @Delete('cards/:instrumentId')
  removeCard(
    @Param('instrumentId') instrumentId: string,
    @Participant() participantId: string,
  ) {
    return this.paymentInstrumentsService.removeCard(
      participantId,
      instrumentId,
    );
  }

  @Post('cards/:instrumentId/charge')
  chargeCard(
    @Param('instrumentId') instrumentId: string,
    @Body() dto: ChargeCardDto,
    @Participant() participantId: string,
  ) {
    return this.paymentInstrumentsService.chargeCard(
      participantId,
      instrumentId,
      dto,
    );
  }

  @Post('mobile-money')
  addMobileMoney(
    @Body() dto: AddMobileMoneyDto,
    @Participant() participantId: string,
  ) {
    return this.paymentInstrumentsService.addMobileMoney(participantId, dto);
  }

  @Get('mobile-money/:customerId')
  listMobileMoney(
    @Param('customerId') customerId: string,
    @Participant() participantId: string,
  ) {
    return this.paymentInstrumentsService.listMobileMoney(
      participantId,
      customerId,
    );
  }

  @Delete('mobile-money/:instrumentId')
  removeMobileMoney(
    @Param('instrumentId') instrumentId: string,
    @Participant() participantId: string,
  ) {
    return this.paymentInstrumentsService.removeMobileMoney(
      participantId,
      instrumentId,
    );
  }

  @Post('mobile-money/:instrumentId/cash-in')
  cashInMobileMoney(
    @Param('instrumentId') instrumentId: string,
    @Body() dto: CashInMobileMoneyDto,
    @Participant() participantId: string,
  ) {
    return this.paymentInstrumentsService.cashInFromMobileMoney(
      participantId,
      instrumentId,
      dto,
    );
  }
}

@Controller('webhooks/payment-instruments')
export class PaymentInstrumentsWebhookController {
  private readonly logger = new Logger(
    PaymentInstrumentsWebhookController.name,
  );

  constructor(
    private readonly paymentInstrumentsService: PaymentInstrumentsService,
  ) {}

  @Post('cards/gateway-callback')
  async handleGatewayCallback(
    @Headers('x-gateway-signature') signature: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    try {
      await this.paymentInstrumentsService.handleGatewayCallback(
        req.body,
        signature,
      );
      return res.status(HttpStatus.OK).send({ status: 'Processed' });
    } catch (error: any) {
      this.logger.error(`Webhook processing failed: ${error.message}`);
      return res.status(HttpStatus.OK).send({ error: error.message });
    }
  }
}
