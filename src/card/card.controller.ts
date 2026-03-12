import {
  Body,
  Controller,
  Param,
  Post,
  UseGuards,
  Get,
  Delete,
} from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { CardService } from './card.service';
import { AddCardDto } from './dto/add-card.dto';
import { Participant } from 'src/common/decorators/participant/participant.decorator';

@Controller('/api/fp/cards')
@UseGuards(JwtAuthGuard)
export class CardController {
  constructor(private cardService: CardService) {}

  @Post(':ccuuid')
  addCard(
    @Param('ccuuid') ccuuid: string,
    @Body() dto: AddCardDto,
    @Participant() participantId: string,
  ) {
    // Fixed argument order to match Service
    return this.cardService.addCard(participantId, ccuuid, dto);
  }

  @Get(':ccuuid')
  listCards(
    @Param('ccuuid') ccuuid: string,
    @Participant() participantId: string, // Added decorator
  ) {
    // Fixed typo 'particiccuuid'
    return this.cardService.listCards(participantId, ccuuid);
  }

  @Delete(':cardId')
  removeCard(
    @Param('cardId') cardId: string,
    @Participant() participantId: string, // Added decorator for security
  ) {
    return this.cardService.removeCard(participantId, cardId);
  }
}
