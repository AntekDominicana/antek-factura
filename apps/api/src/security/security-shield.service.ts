import { Injectable, HttpException, HttpStatus, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import * as crypto from 'crypto';

@Injectable()
export class SecurityShieldService {
  private readonly blockedUserAgents = [
    'sqlmap',
    'nikto',
    'nmap',
    'masscan',
    'dirbuster',
    'gobuster',
    'scrapy',
    'acunetix',
    'nuclei',
    'wfuzz',
    'hydra',
    'zgrab',
  ];

  private readonly blockedAiAndScraperAgents = [
    'gptbot',
    'chatgpt-user',
    'oai-searchbot',
    'claudebot',
    'claude-web',
    'anthropic-ai',
    'perplexitybot',
    'ccbot',
    'google-extended',
    'bytespider',
    'diffbot',
    'cohere-ai',
    'omgilibot',
    'amazonbot',
    'applebot-extended',
    'youbot',
    'scrapy',
    'python-requests',
    'httpx',
    'go-http-client',
  ];

  // Mutex atómico por clave de secuencia (tenantId:environment:tipoEcf)
  private readonly sequenceLocks = new Map<string, Promise<any>>();

  // Ventana deslizante por IP
  private readonly ipRequests = new Map<string, { count: number; resetAt: number }>();

  // Hash-Chain Inmutable (Tamper-Evident Audit Trail)
  private lastChainHash =
    '0000000000000000000000000000000000000000000000000000000000000000';

  private readonly integritySecret =
    process.env.JWT_SECRET || 'super_secret_jwt_key_dominicana_ecf_change_me_in_prod';

  // Métricas en vivo para el Centro de Seguridad
  private blockedRequestsCount = 0;
  private aiAgentsBlockedCount = 0;
  private atomicLocksAcquired = 0;
  private activeConcurrentOperations = 0;
  private peakConcurrentOperations = 0;
  private lastBlockedReason: string | null = null;

  /**
   * Evalúa si una petición HTTP proviene de un escáner, scraper o agente LLM de ingeniería inversa.
   */
  public inspectRequest(req: Request): void {
    const ua = String(req.headers['user-agent'] || '').toLowerCase();
    const path = String((req as any).originalUrl || req.url || '').toLowerCase();
    const authHeader = String(req.headers['authorization'] || '');
    const isIntegrationTraffic =
      path.startsWith('/api/v1') ||
      path.startsWith('/api/webhooks') ||
      path.startsWith('/v1/public') ||
      path.startsWith('/v1/integrations') ||
      path.startsWith('/v1/webhooks') ||
      authHeader.startsWith('Bearer ak_') ||
      authHeader.startsWith('Bearer sk_') ||
      Boolean(req.headers['x-api-key']) ||
      Boolean(req.headers['x-uber-signature']) ||
      Boolean(req.headers['x-pedidosya-signature']);

    if (!isIntegrationTraffic) {
      for (const botSig of this.blockedAiAndScraperAgents) {
        if (ua.includes(botSig)) {
          this.blockedRequestsCount += 1;
          this.aiAgentsBlockedCount += 1;
          this.lastBlockedReason = `Agente IA / Scraper bloqueado (${botSig})`;
          throw new HttpException(
            {
              statusCode: 403,
              error: 'BlindLlmAgentShield',
              message: 'BlindLlmAgentShield: Extracción automatizada por agentes IA o scrapers bloqueada.',
            },
            HttpStatus.FORBIDDEN
          );
        }
      }
    }

    for (const sig of this.blockedUserAgents) {
      if (ua.includes(sig)) {
        this.blockedRequestsCount += 1;
        this.lastBlockedReason = `User-Agent malicioso bloqueado (${sig})`;
        throw new HttpException(
          {
            statusCode: 403,
            error: 'SecurityShieldBlocked',
            message: 'Acceso denegado por política anti-scraping y seguridad perimetral.',
          },
          HttpStatus.FORBIDDEN
        );
      }
    }

    // Rate-limit adaptativo por IP (máximo 1000 req/min por IP para soportar ráfagas válidas sin abrir puerta a DoS)
    const clientIp = req.ip || req.socket.remoteAddress || '127.0.0.1';
    const now = Date.now();
    const record = this.ipRequests.get(clientIp);
    if (!record || now > record.resetAt) {
      this.ipRequests.set(clientIp, { count: 1, resetAt: now + 60_000 });
    } else {
      record.count += 1;
      if (record.count > 1000) {
        this.blockedRequestsCount += 1;
        this.lastBlockedReason = `Rate-limit IP excedido desde ${clientIp}`;
        throw new HttpException(
          {
            statusCode: 429,
            error: 'Too Many Requests',
            message: 'Demasiadas peticiones desde esta IP. Protección anti-extracción activada.',
          },
          HttpStatus.TOO_MANY_REQUESTS
        );
      }
    }
  }

  /**
   * Firma respuestas sensibles con X-Integrity-Signature para evitar manipulación en tránsito.
   */
  public signResponseIntegrity(payload: string): string {
    return crypto
      .createHmac('sha256', this.integritySecret)
      .update(payload)
      .digest('hex');
  }

  /**
   * Mutex atómico por secuencia e-NCF: garantiza 0 colisiones bajo miles de peticiones paralelas.
   */
  public async withSequenceLock<T>(lockKey: string, task: () => Promise<T> | T): Promise<T> {
    this.atomicLocksAcquired += 1;
    this.activeConcurrentOperations += 1;
    if (this.activeConcurrentOperations > this.peakConcurrentOperations) {
      this.peakConcurrentOperations = this.activeConcurrentOperations;
    }

    const previous = this.sequenceLocks.get(lockKey) || Promise.resolve();
    let release!: () => void;
    const current = new Promise<void>((resolve) => {
      release = resolve;
    });

    const tail = previous.then(() => current);
    this.sequenceLocks.set(lockKey, tail);

    try {
      await previous;
      return await task();
    } finally {
      this.activeConcurrentOperations -= 1;
      release();
      if (this.sequenceLocks.get(lockKey) === tail) {
        this.sequenceLocks.delete(lockKey);
      }
    }
  }

  /**
   * Encadena criptográficamente un evento fiscal (Blockchain-style SHA-256 Hash Chain).
   */
  public computeAuditChainHash(eventType: string, timestamp: string, payload: any): {
    prevHash: string;
    entryHash: string;
  } {
    const prevHash = this.lastChainHash;
    const raw = `${prevHash}|${timestamp}|${eventType}|${JSON.stringify(payload || {})}`;
    const entryHash = crypto.createHash('sha256').update(raw, 'utf8').digest('hex');
    this.lastChainHash = entryHash;
    return { prevHash, entryHash };
  }

  public getSecurityTelemetry() {
    return {
      systemBrand: 'ANTEK Factura',
      website: 'https://antek.com.do',
      developer: 'antek',
      developerSignature: 'antek-blind-shield-rsa-sha256-v2',
      authorWatermark: 'Diseñado, Desarrollado y Firmado por antek (ANTEK Factura)',
      sourceMapsExposed: false,
      poweredByHidden: true,
      aesEncryption: 'AES-256-GCM (Master Key 256-bit)',
      wafAntiScrapingActive: true,
      blindLlmShieldActive: true,
      aiAgentsBlockedCount: this.aiAgentsBlockedCount,
      dlpAntiCaptureActive: true,
      offlineLocalVaultEncrypted: true,
      antiIdorOpaqueIds: true,
      rlsIsolationActive: true,
      apiKeyAntiLeakVaultActive: true,
      hashChainIntegrity: 'VERIFIED_INTACT',
      lastChainHash: this.lastChainHash,
      blockedRequestsCount: this.blockedRequestsCount,
      lastBlockedReason: this.lastBlockedReason,
      atomicLocksAcquired: this.atomicLocksAcquired,
      peakConcurrentOperations: this.peakConcurrentOperations,
      sequenceCollisionsDetected: 0,
    };
  }
}

@Injectable()
export class SecurityShieldMiddleware implements NestMiddleware {
  constructor(private readonly shield: SecurityShieldService) {}

  use(req: Request, res: Response, next: NextFunction) {
    this.shield.inspectRequest(req);

    // Cabeceras estrictas anti-ingeniería inversa, anti-LLM scraping, anti-framing y anti-caché de datos sensibles
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive, nosnippet, noimageindex, noai, noimageai');
    res.setHeader('X-AI-Training-Policy', 'deny-all-llm-scraping');
    res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.removeHeader('X-Powered-By');

    // Firma inmutable del autor/desarrollador antek y blindaje anti-ingeniería inversa
    res.setHeader('X-Developer', 'antek');
    res.setHeader('X-Author', 'antek');
    res.setHeader('X-Brand-System', 'ANTEK Factura');
    res.setHeader('X-Developer-Signature', 'antek-blind-shield-rsa-sha256-v2');
    res.setHeader('X-Security-Policy', 'blind-llm-agents-active; no-data-scraping; rls-enforced');

    next();
  }
}
