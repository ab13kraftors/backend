import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { QrService } from './qr.service';
import { QrPaymentDto } from './dto/qr-payment.dto';
import { QrGenerateDto } from './dto/qr-generate.dto';
import { Participant } from 'src/common/decorators/participant/participant.decorator';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('/api/fp/payments')
export class QrController {
  constructor(private readonly qrs: QrService) {}

  @Post('qr/generate')
  generateQR(@Body() dto: QrGenerateDto) {
    return this.qrs.createQR(dto);
  }

  @Post('qr/decode')
  decodeQR(@Body('qrPayload') qrPayload: string) {
    return this.qrs.decode(qrPayload);
  }

  @Post('qr')
  initiate(@Body() dto: QrPaymentDto, @Participant() participantId: string) {
    return this.qrs.process(participantId, dto);
  }
}
