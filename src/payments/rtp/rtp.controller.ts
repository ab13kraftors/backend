import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { RtpService } from './rtp.service';
import { RtpInitiateDto } from './dto/rtp-initiate.dto';
import { RespondRtpDto } from './dto/rtp-respond.dto';
import { Participant } from 'src/common/decorators/participant/participant.decorator';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('/api/fp/payments/rtp')
export class RtpController {
  constructor(private readonly rtpService: RtpService) {}

  @Post('initiate')
  create(@Body() dto: RtpInitiateDto, @Participant() participantId: string) {
    return this.rtpService.initiate(participantId, dto);
  }

  @Post(':rtpMsgId/accept')
  accept(
    @Param('rtpMsgId') id: string,
    @Body() body: Omit<RespondRtpDto, 'rtpMsgId'>,
    @Participant() participantId: string,
  ) {
    return this.rtpService.approve(participantId, {
      ...body,
      rtpMsgId: id,
    });
  }

  @Post(':rtpMsgId/reject')
  reject(
    @Param('rtpMsgId') id: string,
    @Body('reason') reason: string,
    @Participant() participantId: string,
  ) {
    return this.rtpService.reject(participantId, id, reason);
  }

  @Get('pending/:payerAlias')
  getPending(
    @Param('payerAlias') payerAlias: string,
    @Participant() participantId: string,
  ) {
    return this.rtpService.findPendingByPayer(participantId, payerAlias);
  }
}
