import { Body, Controller, Param, Post, Get } from '@nestjs/common';
import { RtpService } from './rtp.service';
import { RtpInitiateDto } from './dto/rtp-initiate.dto';

@Controller('/api/switch/v1/rtp')
export class RtpController {
  constructor(private readonly rtpService: RtpService) {}

  @Post('initiate')
  create(@Body() dto: RtpInitiateDto) {
    const participantId = 'BANK_A';
    return this.rtpService.initiate(participantId, dto);
  }

  @Post(':rtpMsgId/accept')
  accept(
    @Param('rtpMsgId') id: string,
    @Body('debtorAccount') account: string,
  ) {
    return this.rtpService.approve(id, account);
  }

  @Post(':rtpMsgId/reject')
  reject(@Param('rtpMsgId') id: string) {
    return this.rtpService.reject(id);
  }

  @Get('pending/:payerAlias')
  getPending(@Param('payerAlias') payerAlias: string) {
    return this.rtpService.findPendingByPayer(payerAlias);
  }
}
