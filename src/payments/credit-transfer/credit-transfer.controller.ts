import { Controller, Post, Body } from '@nestjs/common';
import { CreditTransferService } from './credit-transfer.service';
import { CreditTransferDto } from './dto/credit-transfer.dto';

@Controller('/api/switch/v1/payments')
export class CreditTransferController {
  constructor(private readonly cts: CreditTransferService) {}

  @Post('credit-transfer')
  initiate(@Body() dto: CreditTransferDto) {
    const participantId = 'BANK_A';
    return this.cts.initiate(participantId, dto);
  }
}
