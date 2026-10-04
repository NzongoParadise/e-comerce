import { processStripeWebhookEvent, verifyStripeWebhookSignature } from '@/lib/server/payments/stripe';
import { logger } from '@/lib/server/logger';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get('stripe-signature');
  if (!verifyStripeWebhookSignature(rawBody, signature)) {
    return Response.json({ error: 'Invalid Stripe webhook signature' }, { status: 400 });
  }

  let event: unknown;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return Response.json({ error: 'Invalid webhook payload' }, { status: 400 });
  }

  try {
    const result = await processStripeWebhookEvent(event as Record<string, unknown>);
    return Response.json({ received: true, duplicate: result.duplicate });
  } catch (error) {
    logger.error('Stripe webhook processing failed', {
      error: error instanceof Error ? error.message : error,
    });
    return Response.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}
