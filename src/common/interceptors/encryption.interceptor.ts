import { Injectable, NestInterceptor } from '@nestjs/common';
import { AesService } from '../crypto/aes.service';
import { map, Observable } from 'rxjs';
import { CallHandler, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';

interface EncryptedPayload {
  iv: string;
  content: string;
  tag: string;
}

@Injectable()
export class EncryptionInterceptor implements NestInterceptor {
  constructor(private readonly aes: AesService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    if (process.env.NODE_ENV !== 'production') {
      return next.handle();
    }
    const req = context.switchToHttp().getRequest<Request>();
    if (
      req.body &&
      typeof req.body === 'object' &&
      'content' in req.body &&
      'iv' in req.body &&
      'tag' in req.body
    ) {
      req.body = this.aes.decrypt(req.body as EncryptedPayload);
    }
    return next.handle().pipe(map((data) => this.aes.encrypt(data)));
  }
}
//  content is ciphertext, tag generated during encryption, during decryption to verify.
// iv is initialization vector(random value to encrypt pt multiple times produces different ct)
