import crypto from 'node:crypto';
import { CreatePaymentInput, PaymentProvider, PaymentQueryResult, PaymentResult, PaymentStatus, WebhookEvent } from './provider';

const statusMap: Record<string, PaymentStatus> = {
  CREATED: 'CREATED', PENDING: 'PENDING', PROCESSING: 'PROCESSING', PAID: 'PAID', SUCCESS: 'PAID', FAILED: 'FAILED', EXPIRED: 'EXPIRED', CANCELLED: 'CANCELLED', REFUNDED: 'REFUNDED',
};

export function normalizePaymentStatus(value: unknown): PaymentStatus { return statusMap[String(value || 'PENDING').toUpperCase()] || 'PENDING'; }

export class MulticaixaProvider implements PaymentProvider {
  private readonly apiUrl = process.env.MULTICAIXA_API_URL;
  private readonly secret = process.env.MULTICAIXA_SECRET_KEY;
  private readonly merchant = process.env.MULTICAIXA_MERCHANT_ID;
  private readonly timeoutMs = Number(process.env.MULTICAIXA_TIMEOUT_MS || 10000);

  isConfigured() { return Boolean(this.apiUrl && this.secret && this.merchant); }

  async createReference(input: CreatePaymentInput) { return this.create(input, '/payments/reference'); }
  async createExpress(input: CreatePaymentInput) { return this.create(input, '/payments/express'); }

  private async create(input: CreatePaymentInput, path: string): Promise<PaymentResult> {
    if (!this.isConfigured()) throw new Error('MULTICAIXA_NOT_CONFIGURED');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await fetch(`${this.apiUrl}${path}`, { method: 'POST', signal: controller.signal, headers: { Authorization: `Bearer ${this.secret}`, 'Content-Type': 'application/json', 'Idempotency-Key': input.idempotencyKey }, body: JSON.stringify({ merchantId: this.merchant, externalReference: input.orderNumber, amount: input.amountKZ, currency: input.currency, method: input.method, phoneNumber: input.phoneNumber }) });
      if (!response.ok) throw new Error(`MULTICAIXA_GATEWAY_${response.status}`);
      return this.normalize(await response.json() as Record<string, unknown>, input);
    } finally { clearTimeout(timeout); }
  }

  async getPaymentStatus(providerPaymentId: string): Promise<PaymentQueryResult> {
    if (!this.isConfigured()) throw new Error('MULTICAIXA_NOT_CONFIGURED');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await fetch(`${this.apiUrl}/payments/${encodeURIComponent(providerPaymentId)}`, { headers: { Authorization: `Bearer ${this.secret}` }, signal: controller.signal });
      if (!response.ok) throw new Error(`MULTICAIXA_GATEWAY_${response.status}`);
      return this.normalize(await response.json() as Record<string, unknown>);
    } finally { clearTimeout(timeout); }
  }

  async cancelPayment(providerPaymentId: string): Promise<PaymentStatus> {
    if (!this.isConfigured()) throw new Error('MULTICAIXA_NOT_CONFIGURED');
    const response = await fetch(`${this.apiUrl}/payments/${encodeURIComponent(providerPaymentId)}/cancel`, { method: 'POST', headers: { Authorization: `Bearer ${this.secret}` } });
    if (!response.ok) throw new Error(`MULTICAIXA_GATEWAY_${response.status}`);
    const body = await response.json() as Record<string, unknown>;
    return this.normalizeStatus(body.status);
  }

  verifyWebhook(rawBody: Buffer, signature?: string) {
    if (!this.secret || !signature) return false;
    const expected = crypto.createHmac('sha256', this.secret).update(rawBody).digest('hex');
    return expected.length === signature.length && crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  }

  parseWebhook(rawBody: Buffer): WebhookEvent {
    const body = JSON.parse(rawBody.toString('utf8')) as Record<string, unknown>;
    return { providerEventId: String(body.eventId || body.id), type: String(body.type || 'payment.updated'), providerPaymentId: String(body.paymentId || body.transactionId), status: this.normalizeStatus(body.status), amountKZ: Number(body.amount), currency: String(body.currency || 'AOA'), payload: body };
  }

  private normalize(body: Record<string, unknown>, input?: CreatePaymentInput): PaymentResult {
    return { providerPaymentId: String(body.paymentId || body.transactionId || body.id), status: this.normalizeStatus(body.status), entity: body.entity ? String(body.entity) : undefined, referenceNumber: body.reference ? String(body.reference) : undefined, expiresAt: body.expiresAt ? new Date(String(body.expiresAt)) : undefined, phoneNumber: body.phoneNumber ? String(body.phoneNumber) : input?.phoneNumber };
  }

  private normalizeStatus(value: unknown): PaymentStatus { return normalizePaymentStatus(value); }
}

export const multicaixaProvider = new MulticaixaProvider();
