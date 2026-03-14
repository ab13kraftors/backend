import { Body, Controller, Param, Post, Get } from '@nestjs/common';
import { RtpService } from './rtp.service';
import { RtpInitiateDto } from './dto/rtp-initiate.dto';
import { Participant } from 'src/common/decorators/participant/participant.decorator';

@Controller('/api/switch/v1/rtp')
export class RtpController {
  constructor(
    // Inject RTP service
    private readonly rtpService: RtpService,
  ) {}

  // ================== create ==================
  // Initiates a new Request-To-Pay
  @Post('initiate')
  create(@Body() dto: RtpInitiateDto, @Participant() participantId: string) {
    return this.rtpService.initiate(participantId, dto);
  }

  // ================== accept ==================
  // Approves RTP request and triggers payment
  @Post(':rtpMsgId/accept')
  accept(
    @Param('rtpMsgId') id: string,
    @Body('debtorAccount') account: string,
    @Body('pin') pin: string,
  ) {
    return this.rtpService.approve({
      rtpMsgId: id,
      debtorAccount: account,
      pin,
    });
  }

  // ================== reject ==================
  // Rejects RTP request
  @Post(':rtpMsgId/reject')
  reject(@Param('rtpMsgId') id: string) {
    return this.rtpService.reject(id);
  }

  // ================== getPending ==================
  // Returns pending RTP requests for a payer
  @Get('pending/:payerAlias')
  getPending(@Param('payerAlias') payerAlias: string) {
    return this.rtpService.findPendingByPayer(payerAlias);
  }
}
