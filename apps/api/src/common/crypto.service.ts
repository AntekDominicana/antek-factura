import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';

@Injectable()
export class CryptoService {
  private readonly masterKey: Buffer;

  constructor() {
    const rawKey =
      process.env.ENCRYPTION_MASTER_KEY ||
      '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
    // Garantizar clave exacta de 32 bytes para AES-256-GCM
    if (/^[0-9a-fA-F]{64}$/.test(rawKey)) {
      this.masterKey = Buffer.from(rawKey, 'hex');
    } else {
      this.masterKey = crypto.createHash('sha256').update(rawKey).digest();
    }
  }

  /**
   * Cifra texto plano con AES-256-GCM.
   * Retorna formato: ivHex:authTagHex:cipherTextHex
   */
  public encrypt(plainText: string): string {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.masterKey, iv);
    const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
  }

  /**
   * Descifra texto cifrado con AES-256-GCM.
   */
  public decrypt(cipherPayload: string): string {
    const parts = cipherPayload.split(':');
    if (parts.length !== 3) {
      throw new Error('Formato de payload cifrado inválido para AES-256-GCM');
    }
    const [ivHex, authTagHex, encryptedHex] = parts;
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const encrypted = Buffer.from(encryptedHex, 'hex');

    const decipher = crypto.createDecipheriv('aes-256-gcm', this.masterKey, iv);
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return decrypted.toString('utf8');
  }

  /**
   * Hash SHA-256 para API Keys y retención legal inmutable de XMLs.
   */
  public hashSha256(content: string): string {
    return crypto.createHash('sha256').update(content, 'utf8').digest('hex');
  }

  /**
   * Firma Webhook con HMAC-SHA256: sha256=hex(hmac(secret, timestamp + "." + body))
   */
  public signWebhook(secret: string, timestamp: string | number, body: string): string {
    const payloadToSign = `${timestamp}.${body}`;
    const signature = crypto
      .createHmac('sha256', secret)
      .update(payloadToSign, 'utf8')
      .digest('hex');
    return `sha256=${signature}`;
  }
}
