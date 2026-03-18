import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { LedgerService } from './ledger.service';
import { LedgerTransferDto } from './dto/ledger-transfer.dto';
import { LedgerReverseDto } from './dto/ledger-reverse.dto';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/auth/roles.guard';
import { Roles } from 'src/common/decorators/auth/roles.decorator';
import { Role } from 'src/common/enums/auth.enums';

@Controller('ledger')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
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
