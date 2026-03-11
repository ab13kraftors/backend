import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { FundingService } from './funding.service';
import { FundingWalletDto } from './dto/fund-wallet.dto';
import { Participant } from 'src/common/decorators/participant/participant.decorator';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('api/fp/wallet/funding')
export class FundingController {
  constructor(
    // Inject Funding service
    private readonly fundingService: FundingService,
  ) {}

  // ================== fundingWallet ==================
  // Initiates wallet funding request
  @Post('initiate')
  async fundingWallet(
    @Body() dto: FundingWalletDto,
    @Participant() participantId: string,
  ) {
    return this.fundingService.fundingWallet(participantId, dto);
  }
}
