import {
  Controller,
  Get,
  Param,
  UseGuards,
  Post,
  Body,
  Req,
} from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { ParticipantGuard } from 'src/common/guards/participant/participant.guard';
import { WalletService } from './wallet.service';
import { FundWalletDto } from './dto/fund-wallet.dto';
import { WithdrawWalletDto } from './dto/withdraw-wallet.dto';
import { TransferWalletDto } from './dto/transfer-wallet.dto';

@UseGuards(JwtAuthGuard, ParticipantGuard)
@Controller('/api/fp/wallet')
export class WalletController {
  constructor(private readonly wallService: WalletService) {}

  @Get(':walletId/balance')
  getBalance(@Param('walletId') walletId: string, @Req() req: any) {
    // Ensure we only see balances for wallets in our own bank
    return this.wallService.getBalance(walletId, req.participantId);
  }

  @Post('fund')
  fund(@Body() dto: FundWalletDto, @Req() req: any) {
    return this.wallService.fundWallet(dto, req.participantId);
  }

  @Post('withdraw')
  withdraw(@Body() dto: WithdrawWalletDto, @Req() req: any) {
    return this.wallService.withdrawWallet(dto, req.participantId);
  }

  @Post(':walletId/history')
  getHistory(@Param('walletId') walletId: string, @Req() req: any) {
    return this.wallService.getHistory(walletId, req.participantId);
  }

  @Post('transfer')
  transfer(@Body() dto: TransferWalletDto, @Req() req: any) {
    return this.wallService.transferWallet(dto, req.participantId);
  }
}
