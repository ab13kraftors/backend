import { Controller, Post, Body } from '@nestjs/common';
import { QrService } from './qr.service';
import { QrPaymentDto } from './dto/qr-payment.dto';
import { QrGenerateDto } from './dto/qr-generate.dto';

@Controller('/api/switch/v1/payments')
export class QrController {
  constructor(private readonly qrs: QrService) {}

  // 1. Merchant generates the QR
  @Post('qr/generate')
  generateQR(@Body() dto: QrGenerateDto) {
    return this.qrs.createQR(dto);
  }

  // 2. Customer scans and previews details (The "Redirect" phase)
  @Post('qr/decode')
  decodeQR(@Body('qrPayload') qrPayload: string) {
    return this.qrs.decode(qrPayload);
  }

  // 3. Customer clicks "Pay" and provides PIN
  @Post('qr')
  initiate(@Body() dto: QrPaymentDto) {
    const participantId = 'BANK_A'; // In prod, get from AuthGuard
    return this.qrs.process(participantId, dto);
  }
}
