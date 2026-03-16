import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { CreditTransferService } from './credit-transfer.service';
import { CreditTransferDto } from './dto/credit-transfer.dto';
import { Participant } from 'src/common/decorators/participant/participant.decorator';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('/api/fp/payments')
export class CreditTransferController {
  constructor(private readonly creditTransferService: CreditTransferService) {}

  @Post('credit-transfer')
  initiate(
    @Body() dto: CreditTransferDto,
    @Participant() participantId: string,
  ) {
    return this.creditTransferService.initiate(participantId, dto);
  }
}
