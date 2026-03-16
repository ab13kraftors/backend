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
