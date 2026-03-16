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
