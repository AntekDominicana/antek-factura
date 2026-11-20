import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';

@Injectable()
export class CryptoService {
  private readonly logger = new Logger(CryptoService.name);
  private readonly masterKey: Buffer;
  private readonly apiKeyPepper: string;

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

    const envPepper = process.env.API_KEY_PEPPER?.trim();
    if (!envPepper && process.env.NODE_ENV === 'production') {
      this.logger.warn(
        'API_KEY_PEPPER no está definido en producción; usando ENCRYPTION_MASTER_KEY como respaldo temporal.'
      );
    }
    this.apiKeyPepper =
      envPepper ||
      process.env.ENCRYPTION_MASTER_KEY ||
      'dev_api_key_pepper_change_me_in_prod';
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
   * Hash SHA-256 para retención legal inmutable de XMLs y tokens internos.
   */
  public hashSha256(content: string): string {
    return crypto.createHash('sha256').update(content, 'utf8').digest('hex');
  }

  /**
   * Hash HMAC-SHA256 con secreto del servidor (API_KEY_PEPPER) para API Keys.
   * Nunca se almacena la clave en texto plano ni un hash sin pepper.
   */
  public hashApiKey(rawKey: string): string {
    return crypto
      .createHmac('sha256', this.apiKeyPepper)
      .update(rawKey, 'utf8')
      .digest('hex');
  }

  /**
   * Genera una API Key criptográficamente segura con prefijo identificable (ej. sk_live_...)
   * y retorna la clave cruda (para mostrar UNA sola vez), el prefijo visible y su HMAC-SHA256.
   */
  public generateApiKey(prefix: 'sk_live_' | 'sk_test_' = 'sk_live_'): {
    rawKey: string;
    keyPrefix: string;
    keyHash: string;
  } {
    const randomHex = crypto.randomBytes(32).toString('hex');
    const rawKey = `${prefix}${randomHex}`;
    const keyPrefix = rawKey.slice(0, 12);
    const keyHash = this.hashApiKey(rawKey);
    return { rawKey, keyPrefix, keyHash };
  }

  /**
   * Comparación en tiempo constante (resistente a timing attacks) entre dos digests hexadecimales.
   */
  public verifyHashTimingSafe(computedHex: string, storedHex: string): boolean {
    if (!computedHex || !storedHex) return false;
    if (!/^[0-9a-fA-F]+$/.test(computedHex) || !/^[0-9a-fA-F]+$/.test(storedHex)) {
      return false;
    }
    const bufA = Buffer.from(computedHex.toLowerCase(), 'hex');
    const bufB = Buffer.from(storedHex.toLowerCase(), 'hex');
    if (bufA.length === 0 || bufA.length !== bufB.length) {
      return false;
    }
    return crypto.timingSafeEqual(bufA, bufB);
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
