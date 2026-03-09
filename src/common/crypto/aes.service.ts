import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';

interface EncryptedPayload {
  iv: string;
  content: string;
  tag: string;
}

@Injectable()
export class AesService {
  // AES-GCM encryption algorithm
  private readonly algorithm = 'aes-256-gcm';

  // Secret encryption key buffer
  private readonly key: Buffer;

  constructor() {
    // Validate AES secret from environment
    const secret = process.env.AES_SECRET;

    // Ensure secret exists and is correct length
    if (!secret || secret.length !== 64) {
      throw new Error(
        'AES_SECRET must be set and exactly 64 hex characters (32 bytes)',
      );
    }

    // Convert hex secret into buffer
    this.key = Buffer.from(secret, 'hex');
  }

  // ================== encrypt ==================
  // Encrypts any object using AES-256-GCM
  encrypt<T>(data: T): EncryptedPayload {
    // Generate random initialization vector
    const iv = crypto.randomBytes(12);

    // Create cipher using algorithm, key and IV
    const cipher = crypto.createCipheriv(this.algorithm, this.key, iv);

    // Encrypt JSON stringified data
    const encrypted = Buffer.concat([
      cipher.update(JSON.stringify(data), 'utf8'),
      cipher.final(),
    ]);

    // Return encrypted payload components
    return {
      iv: iv.toString('hex'),
      content: encrypted.toString('hex'),
      tag: cipher.getAuthTag().toString('hex'),
    };
  }

  // ================== decrypt ==================
  // Decrypts AES encrypted payload
  decrypt(payload: EncryptedPayload): unknown {
    const { iv, content, tag } = payload;

    // Create decipher using same algorithm and key
    const decipher = crypto.createDecipheriv(
      this.algorithm,
      this.key,
      Buffer.from(iv, 'hex'),
    );

    // Set authentication tag for integrity check
    decipher.setAuthTag(Buffer.from(tag, 'hex'));

    // Decrypt ciphertext
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(content, 'hex')),
      decipher.final(),
    ]);

    // Parse decrypted JSON back to object
    return JSON.parse(decrypted.toString());
  }
}

// content = ciphertext (encrypted data)
// tag = authentication tag used to verify integrity during decryption
// iv = random initialization vector to ensure different ciphertext for same plaintext
