import { Controller, Post, Body } from '@nestjs/common';
import { CreditTransferService } from './credit-transfer.service';
import { CreditTransferDto } from './dto/credit-transfer.dto';
import { Participant } from 'src/common/decorators/participant/participant.decorator';

@Controller('/api/switch/v1/payments')
export class CreditTransferController {
  constructor(
    // Inject CreditTransfer service
    private readonly cts: CreditTransferService,
  ) {}

  // ================== initiate ==================
  // Initiates a credit transfer payment
  @Post('credit-transfer')
  initiate(
    @Body() dto: CreditTransferDto,
    @Participant() participantId: string,
  ) {
    return this.cts.initiate(participantId, dto);
  }
}
