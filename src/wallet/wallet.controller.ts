import { Controller, Get, Param, UseGuards, Post, Body } from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { WalletService } from './wallet.service';
import { FundWalletDto } from './dto/fund-wallet.dto';
import { WithdrawWalletDto } from './dto/withdraw-wallet.dto';
import { TransferWalletDto } from './dto/transfer-wallet.dto';
import { Participant } from 'src/common/decorators/participant/participant.decorator';

@UseGuards(JwtAuthGuard)
@Controller('/api/fp/wallet')
export class WalletController {
  constructor(
    // Inject Wallet service
    private readonly wallService: WalletService,
  ) {}

  // ================== getBalance ==================
  // Returns balance of a wallet belonging to the participant
  @Get(':walletId/balance')
  getBalance(
    @Param('walletId') walletId: string,
    @Participant() participantId: string,
  ) {
    return this.wallService.getBalance(walletId, participantId);
  }

  // ================== fund ==================
  // Funds a wallet from the system pool
  @Post('fund')
  fund(@Body() dto: FundWalletDto, @Participant() participantId: string) {
    return this.wallService.fundWallet(dto, participantId);
  }

  // ================== withdraw ==================
  // Withdraws money from wallet to system pool
  @Post('withdraw')
  withdraw(
    @Body() dto: WithdrawWalletDto,
    @Participant() participantId: string,
  ) {
    return this.wallService.withdrawWallet(dto, participantId);
  }

  // ================== getHistory ==================
  // Returns transaction history of the wallet
  @Get(':walletId/history')
  getHistory(
    @Param('walletId') walletId: string,
    @Participant() participantId: string,
  ) {
    return this.wallService.getHistory(walletId, participantId);
  }

  // ================== transfer ==================
  // Transfers funds between wallets
  @Post('transfer')
  transfer(
    @Body() dto: TransferWalletDto,
    @Participant() participantId: string,
  ) {
    return this.wallService.transferWallet(dto, participantId);
  }
}
