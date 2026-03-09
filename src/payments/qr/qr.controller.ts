import { Controller, Post, Body } from '@nestjs/common';
import { QrService } from './qr.service';
import { QrPaymentDto } from './dto/qr-payment.dto';
import { QrGenerateDto } from './dto/qr-generate.dto';
import { Participant } from 'src/common/decorators/participant/participant.decorator';

@Controller('/api/switch/v1/payments')
export class QrController {
  constructor(
    // Inject QR service
    private readonly qrs: QrService,
  ) {}

  // ================== generateQR ==================
  // Merchant generates QR code for payment
  @Post('qr/generate')
  generateQR(@Body() dto: QrGenerateDto) {
    return this.qrs.createQR(dto);
  }

  // ================== decodeQR ==================
  // Customer scans QR and retrieves payment details
  @Post('qr/decode')
  decodeQR(@Body('qrPayload') qrPayload: string) {
    return this.qrs.decode(qrPayload);
  }

  // ================== initiate ==================
  // Customer confirms payment using scanned QR
  @Post('qr')
  initiate(@Body() dto: QrPaymentDto, @Participant() participantId: string) {
    return this.qrs.process(participantId, dto);
  }
}
