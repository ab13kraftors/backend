import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { LedgerService } from './ledger.service';
import { LedgerTransferDto } from './dto/ledger-transfer.dto';
import { LedgerReverseDto } from './dto/ledger-reverse.dto';

@Controller('ledger')
export class LedgerController {
  constructor(private readonly ledgerService: LedgerService) {}

  @Post('transfer')
  async transfer(@Body() dto: LedgerTransferDto) {
    return this.ledgerService.postTransfer(dto);
  }

  @Post('reverse')
  async reverse(@Body() dto: LedgerReverseDto) {
    return this.ledgerService.reverseTransfer(dto);
  }

  @Get('journal/:txId')
  async getJournal(@Param('txId') txId: string) {
    return this.ledgerService.findJournalByTxId(txId);
  }

  @Get('balance/:finAddress')
  async getBalance(
    @Param('finAddress') finAddress: string,
    @Param('participantId') participantId: string,
  ) {
    const balance = await this.ledgerService.getDerivedBalance(
      finAddress,
      participantId,
    );
    return { finAddress, balance };
  }

  @Get('entries/:accountId')
  async getEntries(@Param('accountId') accountId: string) {
    return this.ledgerService.getAccountEntries(accountId);
  }
}
