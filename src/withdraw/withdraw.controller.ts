import { Controller, Post, Body, UseGuards } from '@nestjs/common';

import { WithdrawService } from './withdraw.service';
import { WithdrawDto } from './dto/withdraw.dto';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { Participant } from 'src/common/decorators/participant/participant.decorator';

@UseGuards(JwtAuthGuard)
@Controller('/api/fp/withdraw')
export class WithdrawController {
  constructor(private withdrawService: WithdrawService) {}

  @Post()
  withdraw(@Body() dto: WithdrawDto, @Participant() participantId: string) {
    return this.withdrawService.withdraw(dto, participantId);
  }
}
