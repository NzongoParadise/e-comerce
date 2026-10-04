import { prisma } from '@/lib/server/prisma';

async function stripePost(path: string, params: URLSearchParams, idempotencyKey?: string) {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) throw new Error('STRIPE_NOT_CONFIGURED');
  const response = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
    },
    body: params,
  });
  const result = await response.json() as { id?: unknown };
  if (!response.ok) throw new Error(`STRIPE_REQUEST_FAILED:${response.status}`);
  return result;
}

export async function ensureStripeCustomer(userId: number) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true, stripeCustomerId: true },
  });
  if (!user) throw new Error('USER_NOT_FOUND');
  if (user.stripeCustomerId) return user.stripeCustomerId;

  const params = new URLSearchParams({ 'metadata[userId]': String(user.id) });
  if (user.email) params.set('email', user.email);
  if (user.name) params.set('name', user.name);
  const customer = await stripePost('customers', params, `account-customer-${user.id}`);
  if (typeof customer.id !== 'string') throw new Error('INVALID_STRIPE_CUSTOMER');
  await prisma.user.update({ where: { id: user.id }, data: { stripeCustomerId: customer.id } });
  return customer.id;
}

export async function setStripeDefaultPaymentMethod(customerId: string, paymentMethodId: string) {
  await stripePost(`customers/${encodeURIComponent(customerId)}`, new URLSearchParams({
    'invoice_settings[default_payment_method]': paymentMethodId,
  }));
}

export async function detachStripePaymentMethod(paymentMethodId: string) {
  await stripePost(`payment_methods/${encodeURIComponent(paymentMethodId)}/detach`, new URLSearchParams());
}