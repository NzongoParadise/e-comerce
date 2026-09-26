export type PaymentMethod = 'MULTICAIXA_REFERENCE' | 'MULTICAIXA_EXPRESS';
export type PaymentStatus = 'CREATED' | 'PENDING' | 'PROCESSING' | 'PAID' | 'FAILED' | 'EXPIRED' | 'CANCELLED' | 'REFUNDED';

export type CreatePaymentInput = {
  paymentId: number;
  orderNumber: string;
  amountKZ: number;
  currency: 'AOA';
  method: PaymentMethod;
  phoneNumber?: string;
  idempotencyKey: string;
};

export type PaymentResult = {
  providerPaymentId: string;
  status: PaymentStatus;
  entity?: string;
  referenceNumber?: string;
  expiresAt?: Date;
  phoneNumber?: string;
};

export type PaymentQueryResult = PaymentResult;
export type WebhookEvent = {
  providerEventId: string;
  type: string;
  providerPaymentId: string;
  status: PaymentStatus;
  amountKZ: number;
  currency: string;
  payload: Record<string, unknown>;
};

export interface PaymentProvider {
  createReference(input: CreatePaymentInput): Promise<PaymentResult>;
  createExpress(input: CreatePaymentInput): Promise<PaymentResult>;
  getPaymentStatus(providerPaymentId: string): Promise<PaymentQueryResult>;
  cancelPayment(providerPaymentId: string): Promise<PaymentStatus>;
  verifyWebhook(rawBody: Buffer, signature?: string): boolean;
  parseWebhook(rawBody: Buffer): WebhookEvent;
}
