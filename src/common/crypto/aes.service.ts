import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';

interface EncryptedPayload {
  iv: string;
  content: string;
  tag: string;
}

@Injectable()
export class AesService {
  private readonly algorithm = 'aes-256-gcm';
  private readonly key = Buffer.from(process.env.AES_SECRET!, 'hex');

  encrypt<T>(data: T): EncryptedPayload {
    // initialization vector
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv(this.algorithm, this.key, iv);

    const encrypted = Buffer.concat([
      cipher.update(JSON.stringify(data), 'utf8'),
      cipher.final(),
    ]);

    const tag = cipher.getAuthTag();

    return {
      iv: iv.toString('hex'),
      content: encrypted.toString('hex'),
      tag: tag.toString('hex'),
    };
    //  content is ciphertext, tag generated during encryption, during decryption to verify.
    // iv is initialization vector(random value to encrypt pt multiple times produces different ct)
  }

  decrypt(payload: EncryptedPayload): unknown {
    const { iv, content, tag } = payload;
    const decipher = crypto.createDecipheriv(
      this.algorithm,
      this.key,
      Buffer.from(iv, 'hex'),
    );

    decipher.setAuthTag(Buffer.from(tag, 'hex'));

    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(content, 'hex')),
      decipher.final(),
    ]);

    return JSON.parse(decrypted.toString());
  }
}
