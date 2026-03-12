import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Card } from './entities/card.entity'; // Path to your card entity
import { CardService } from './card.service';
import { CardController } from './card.controller';

@Module({
  imports: [
    // This line "provides" the CardRepository to the CardService
    TypeOrmModule.forFeature([Card]),
  ],
  controllers: [CardController],
  providers: [CardService],
  exports: [CardService], // Export it so LoadService can use it later
})
export class CardModule {}
