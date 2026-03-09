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
  // Inject AES encryption service
  constructor(private readonly aes: AesService) {}

  // ================== intercept ==================
  // Decrypts incoming request body and encrypts outgoing response
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    // Skip encryption in non-production environments
    if (process.env.NODE_ENV !== 'production') {
      return next.handle();
    }

    // Optional feature flag (disabled)
    // if (process.env.ENCRYPTION_ENABLED !== 'true') {
    //   return next.handle();
    // }

    // Get HTTP request object
    const req = context.switchToHttp().getRequest<Request>();

    // Detect encrypted payload structure and decrypt
    if (
      req.body &&
      typeof req.body === 'object' &&
      'content' in req.body &&
      'iv' in req.body &&
      'tag' in req.body
    ) {
      req.body = this.aes.decrypt(req.body as EncryptedPayload);
    }

    // Encrypt outgoing response data
    return next.handle().pipe(map((data) => this.aes.encrypt(data)));
  }
}

// content = ciphertext (encrypted payload)
// tag = authentication tag used to verify data integrity
// iv = random initialization vector ensuring unique ciphertext for same plaintext
