import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Card } from './entities/card.entity';
import { Repository } from 'typeorm';
import { AddCardDto } from './dto/add-card.dto';

@Injectable()
export class CardService {
  constructor(@InjectRepository(Card) private cardRepo: Repository<Card>) {}

  async addCard(participantId: string, ccuuid: string, dto: AddCardDto) {
    const existing = await this.cardRepo.findOne({
      where: { token: dto.token, ccuuid },
    });
    if (existing) return existing;

    const card = this.cardRepo.create({ ...dto, participantId, ccuuid });
    return this.cardRepo.save(card);
  }

  async listCards(participantId: string, ccuuid: string) {
    return this.cardRepo.find({
      where: { participantId, ccuuid, isActive: true },
      order: { createdAt: 'DESC' },
    });
  }

  async removeCard(participantId: string, cardId: string) {
    const card = await this.cardRepo.findOne({
      where: { cardId, participantId },
    });
    if (!card) throw new NotFoundException('Card not found');

    card.isActive = false;
    return this.cardRepo.save(card);
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
}
