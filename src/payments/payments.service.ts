import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';

@Injectable()
export class PaymentsService {
  generateReference() {
    return randomUUID();
  }
}
