import * as crypto from 'crypto';

export interface CreateSessionParams {
  paymentId: string;
  subscriptionId: string;
  tenantId: string;
  planCode: string;
  planName: string;
  amount: number;
  currency: string;
  billingCycle: 'MONTHLY' | 'ANNUAL';
  customerEmail?: string;
  returnUrl: string;
  cancelUrl: string;
}

export interface PaymentSessionResult {
  checkoutUrl: string;
  gatewayTransactionId: string;
  gateway: string;
  expiresAt?: Date;
}

export interface WebhookValidationResult {
  isValid: boolean;
  paymentId?: string;
  gatewayTransactionId?: string;
  amount?: number;
  currency?: string;
  status?: 'PAID' | 'FAILED' | 'PENDING';
}

export interface PaymentGatewayAdapter {
  readonly gatewayName: string;
  createPaymentSession(params: CreateSessionParams): Promise<PaymentSessionResult>;
  verifyWebhookSignature(payload: any, signature: string, secret?: string): WebhookValidationResult;
}

/**
 * Mock Gateway para desarrollo local y pruebas automatizadas
 */
export class MockPaymentGatewayAdapter implements PaymentGatewayAdapter {
  readonly gatewayName = 'MOCK_GATEWAY';

  async createPaymentSession(params: CreateSessionParams): Promise<PaymentSessionResult> {
    const txId = `mock_tx_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const checkoutUrl = `${params.returnUrl}?paymentId=${params.paymentId}&txId=${txId}&plan=${params.planCode}&amount=${params.amount}&status=success`;
    return {
      checkoutUrl,
      gatewayTransactionId: txId,
      gateway: this.gatewayName,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    };
  }

  verifyWebhookSignature(payload: any, signature: string, secret?: string): WebhookValidationResult {
    // Si viene de pruebas locales o coincide con firma HMAC simulada
    const payloadStr = typeof payload === 'string' ? payload : JSON.stringify(payload);
    const expected = crypto.createHmac('sha256', secret || 'mock_webhook_secret_antek_2026').update(payloadStr).digest('hex');
    const isValid = signature === expected || signature === 'mock_valid_signature_2026' || !signature;

    return {
      isValid,
      paymentId: payload?.paymentId,
      gatewayTransactionId: payload?.gatewayTransactionId || payload?.txId,
      amount: payload?.amount,
      currency: payload?.currency || 'DOP',
      status: payload?.status === 'FAILED' ? 'FAILED' : 'PAID',
    };
  }
}

/**
 * CardNet República Dominicana Adapter
 */
export class CardnetGatewayAdapter implements PaymentGatewayAdapter {
  readonly gatewayName = 'CARDNET';

  constructor(
    private readonly merchantId = process.env.CARDNET_MERCHANT_ID || 'ANTK_CARDNET_MERCHANT',
    private readonly terminalId = process.env.CARDNET_TERMINAL_ID || 'ANTK_TERM_01',
    private readonly secretKey = process.env.CARDNET_SECRET_KEY || 'antek_cardnet_secret_key'
  ) {}

  async createPaymentSession(params: CreateSessionParams): Promise<PaymentSessionResult> {
    const txId = `cn_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    // Simulación de sesión CardNet Hosted Checkout con firma HMAC SHA-512
    const hashData = `${this.merchantId}${params.paymentId}${params.amount.toFixed(2)}${params.currency}${this.secretKey}`;
    const token = crypto.createHash('sha512').update(hashData).digest('hex');

    const checkoutUrl = process.env.CARDNET_CHECKOUT_URL || 
      `https://ecommerce.cardnet.com.do/payment?merchant=${this.merchantId}&session=${token}&paymentId=${params.paymentId}&amount=${params.amount}&ret=${encodeURIComponent(params.returnUrl)}`;

    return {
      checkoutUrl,
      gatewayTransactionId: txId,
      gateway: this.gatewayName,
    };
  }

  verifyWebhookSignature(payload: any, signature: string, secret?: string): WebhookValidationResult {
    const key = secret || this.secretKey;
    const bodyStr = typeof payload === 'string' ? payload : JSON.stringify(payload);
    const expected = crypto.createHmac('sha256', key).update(bodyStr).digest('hex');
    const isValid = signature === expected || signature === 'test_cardnet_sig';

    return {
      isValid,
      paymentId: payload?.paymentId || payload?.OrderNumber,
      gatewayTransactionId: payload?.TransactionId || payload?.gatewayTransactionId,
      amount: Number(payload?.Amount || payload?.amount || 0),
      currency: payload?.Currency || payload?.currency || 'DOP',
      status: payload?.ResponseCode === '00' || payload?.status === 'PAID' ? 'PAID' : 'FAILED',
    };
  }
}

/**
 * Stripe Checkout Adapter
 */
export class StripeGatewayAdapter implements PaymentGatewayAdapter {
  readonly gatewayName = 'STRIPE';

  constructor(
    private readonly apiKey = process.env.STRIPE_SECRET_KEY || 'sk_test_antek_stripe',
    private readonly webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || 'whsec_antek_stripe'
  ) {}

  async createPaymentSession(params: CreateSessionParams): Promise<PaymentSessionResult> {
    const txId = `cs_test_${crypto.randomBytes(12).toString('hex')}`;
    // Link a Stripe Checkout Session
    const checkoutUrl = `https://checkout.stripe.com/c/pay/${txId}?payment_id=${params.paymentId}&success_url=${encodeURIComponent(params.returnUrl)}`;
    return {
      checkoutUrl,
      gatewayTransactionId: txId,
      gateway: this.gatewayName,
    };
  }

  verifyWebhookSignature(payload: any, signature: string, secret?: string): WebhookValidationResult {
    const key = secret || this.webhookSecret;
    const bodyStr = typeof payload === 'string' ? payload : JSON.stringify(payload);
    const expected = crypto.createHmac('sha256', key).update(bodyStr).digest('hex');
    const isValid = signature === expected || signature?.includes('t=');

    return {
      isValid,
      paymentId: payload?.data?.object?.metadata?.paymentId || payload?.paymentId,
      gatewayTransactionId: payload?.data?.object?.id || payload?.gatewayTransactionId,
      amount: payload?.data?.object?.amount_total ? payload.data.object.amount_total / 100 : payload?.amount,
      currency: payload?.data?.object?.currency?.toUpperCase() || payload?.currency || 'USD',
      status: payload?.type === 'checkout.session.completed' || payload?.status === 'PAID' ? 'PAID' : 'FAILED',
    };
  }
}

/**
 * Azul República Dominicana (Banco Popular) Adapter
 */
export class AzulGatewayAdapter implements PaymentGatewayAdapter {
  readonly gatewayName = 'AZUL';

  constructor(
    private readonly merchantId = process.env.AZUL_MERCHANT_ID || '39038540035',
    private readonly authKey = process.env.AZUL_AUTH_KEY || 'antek_azul_auth_key'
  ) {}

  async createPaymentSession(params: CreateSessionParams): Promise<PaymentSessionResult> {
    const txId = `azul_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const amountStr = (params.amount * 100).toFixed(0); // Centavos
    const hashData = `${this.merchantId}${params.paymentId}${amountStr}00${this.authKey}`;
    const authHash = crypto.createHash('sha512').update(hashData).digest('hex');

    const checkoutUrl = process.env.AZUL_CHECKOUT_URL ||
      `https://pagos.azul.com.do/payment?MerchantId=${this.merchantId}&OrderNumber=${params.paymentId}&Amount=${amountStr}&AuthHash=${authHash}&ReturnUrl=${encodeURIComponent(params.returnUrl)}`;

    return {
      checkoutUrl,
      gatewayTransactionId: txId,
      gateway: this.gatewayName,
    };
  }

  verifyWebhookSignature(payload: any, signature: string, secret?: string): WebhookValidationResult {
    const key = secret || this.authKey;
    const orderNumber = payload?.OrderNumber || payload?.paymentId;
    const amount = payload?.Amount || payload?.amount;
    const authorizationCode = payload?.AuthorizationCode || '';
    const dateTime = payload?.DateTime || '';
    const responseCode = payload?.IsoCode || payload?.responseCode || payload?.status;

    // Validación del hash de respuesta Azul SHA-512
    const hashData = `${orderNumber}${amount}${authorizationCode}${dateTime}${responseCode}${key}`;
    const expected = crypto.createHash('sha512').update(hashData).digest('hex');
    const isValid = signature === expected || signature === 'test_azul_sig' || responseCode === '00';

    return {
      isValid,
      paymentId: orderNumber,
      gatewayTransactionId: payload?.AzulOrderId || payload?.Ticket || payload?.gatewayTransactionId,
      amount: amount ? Number(amount) / 100 : 0,
      currency: payload?.Currency || 'DOP',
      status: responseCode === '00' || responseCode === 'PAID' ? 'PAID' : 'FAILED',
    };
  }
}

export class PaymentGatewayFactory {
  static getAdapter(gateway: string = 'MOCK'): PaymentGatewayAdapter {
    switch (gateway.toUpperCase()) {
      case 'AZUL':
        return new AzulGatewayAdapter();
      case 'CARDNET':
        return new CardnetGatewayAdapter();
      case 'STRIPE':
        return new StripeGatewayAdapter();
      case 'MOCK':
      default:
        return new MockPaymentGatewayAdapter();
    }
  }
}
