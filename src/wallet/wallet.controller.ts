import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { Participant } from 'src/common/decorators/participant/participant.decorator';
import { WalletService } from './wallet.service';
import { CreateWalletDto } from './dto/create-wallet.dto';
import { FundWalletDto } from './dto/fund-wallet.dto';
import { WithdrawWalletDto } from './dto/withdraw-wallet.dto';
import { TransferWalletDto } from './dto/transfer-wallet.dto';
import { UpdateWalletStatusDto } from './dto/update-wallet-status.dto';

@UseGuards(JwtAuthGuard)
@Controller('/api/fp/wallet')
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  @Post()
  create(@Body() dto: CreateWalletDto, @Participant() participantId: string) {
    return this.walletService.createWallet(dto, participantId);
  }

  @Get(':walletId/balance')
  getBalance(
    @Param('walletId') walletId: string,
    @Participant() participantId: string,
  ) {
    return this.walletService.getBalance(walletId, participantId);
  }

  @Get(':walletId/history')
  getHistory(
    @Param('walletId') walletId: string,
    @Participant() participantId: string,
  ) {
    return this.walletService.getHistory(walletId, participantId);
  }

  @Post('fund')
  fund(@Body() dto: FundWalletDto, @Participant() participantId: string) {
    return this.walletService.fundWallet(dto, participantId);
  }

  @Post('withdraw')
  withdraw(
    @Body() dto: WithdrawWalletDto,
    @Participant() participantId: string,
  ) {
    return this.walletService.withdrawWallet(dto, participantId);
  }

  @Post('transfer')
  transfer(
    @Body() dto: TransferWalletDto,
    @Participant() participantId: string,
  ) {
    return this.walletService.transferWallet(dto, participantId);
  }

  @Patch(':walletId/status')
  updateStatus(
    @Param('walletId') walletId: string,
    @Body() dto: UpdateWalletStatusDto,
    @Participant() participantId: string,
  ) {
    return this.walletService.updateWalletStatus(
      walletId,
      participantId,
      dto.status,
    );
  }
}
