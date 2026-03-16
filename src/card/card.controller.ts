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
