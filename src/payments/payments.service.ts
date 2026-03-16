import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';

@Injectable()
export class PaymentsService {
  generateReference(prefix = 'TXN'): string {
    return `${prefix}-${randomUUID()}`;
  }

  generateExternalId(prefix = 'EXT'): string {
    return `${prefix}-${randomUUID()}`;
  }

  generateBulkBatchReference(): string {
    return this.generateReference('BULK');
  }

  generateBulkItemReference(): string {
    return this.generateReference('BULK-ITEM');
  }

  generateRtpReference(): string {
    return this.generateReference('RTP');
  }

  generateQrReference(): string {
    return this.generateReference('QR');
  }

  generateCreditTransferReference(): string {
    return this.generateReference('CT');
  }
}
