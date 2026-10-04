# TechGlobal E-commerce

TechGlobal online store with a Next.js storefront and API, PostgreSQL, and Prisma migrations. The storefront and API run as one Next.js web service.

## Requirements

- Docker Desktop with Docker Compose
- Node.js 20 or newer for local development

## Local setup with Docker

1. Create local environment files:

   ```powershell
   Copy-Item .env.example .env
   Copy-Item frontend/.env.example frontend/.env.local
   ```

2. Set a local `POSTGRES_PASSWORD` in `.env` and the app secrets in `frontend/.env.local`. Keep both files private; they are ignored by Git.

3. Start the application:

   ```powershell
   docker compose up --build
   ```

The storefront and API are available at <http://localhost:3000>. Docker Compose starts PostgreSQL, applies Prisma migrations, and then starts the Next.js application.

## Useful checks

```powershell
npm test
npm run build
npm run lint --workspace frontend
```

## Project layout

- `frontend/` - Next.js storefront, native API handlers, Prisma schema/migrations, payment provider, and local app env template
- `docker-compose.yml` - Local PostgreSQL and unified Next.js service
- `Imagens/` - Source product and campaign artwork

## Environment files

- `.env.example` documents the root variables used by Docker Compose.
- `frontend/.env.example` documents the local development template.
- `frontend/.env.production.example` documents the required production values for Vercel/Render deployment.
- Never commit `.env`, `frontend/.env.local`, `.env.production`, credentials, or production secrets.

Payment providers and external authentication integrations require their corresponding environment variables before they can be used. External identity providers need `JWKS_URI` and, when required by the provider, `AUTH_ISSUER` and `AUTH_AUDIENCE`. Password reset returns a development-only token until an email delivery provider is configured.

Production checklist:

1. Copy `frontend/.env.production.example` to `frontend/.env.production` for a local production-like check.
2. Fill in the real `DATABASE_URL`, `JWT_SECRET`, `FRONTEND_URL`, `JWKS_URI`, `AUTH_ISSUER`, `AUTH_AUDIENCE`, and payment keys.
3. Configure `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `MULTICAIXA_*`, and `TRACKING_*` if those flows are enabled.
4. On Render/Vercel, inject the same values as environment variables in the host dashboard, not in the repository.

## Online demo deployment

Deploy the `frontend/` directory as a Next.js project on Vercel. All runtime source, Prisma schema, and migrations are inside that directory, so the deployment does not need access outside its Root Directory. PostgreSQL remains hosted on Neon.

1. Create a Neon Free project in a European region and copy its PostgreSQL connection string. Keep the connection string private.
2. Import the repository into Vercel and set **Root Directory** to `frontend` with the Next.js framework preset.
3. Add `DATABASE_URL` and `JWT_SECRET` to Vercel Environment Variables. Also set `FRONTEND_URL` to the production URL and configure external authentication/payment variables if those providers are enabled.
4. Deploy. Prisma Client is generated during the build. The current Neon database already has all migrations; for future schema changes, run `npm run db:migrate` before promoting the deployment.

Neon Free suspends idle compute and has a 0.5 GB storage limit. Vercel Functions limit request bodies to 4.5 MB, so the current B2B document upload flow (up to 5 MB per file) needs direct-to-object-storage uploads or a lower size limit before relying on it in production. Password-reset email delivery and durable document storage also need providers before production use.

## Stripe — módulo financeiro

A loja usa Stripe como processador de pagamentos para encomendas em EUR. A arquitetura mantém uma relação **Order → Payment → PaymentIntent → Charge**, sem Stripe Connect/multi-seller. O Checkout hospedado existente continua a ser a interface de pagamento; a liquidação financeira é reconciliada pelo PaymentIntent e pelos webhooks.

### Variáveis

No ambiente do servidor configure:

- `STRIPE_SECRET_KEY` — chave secreta TEST ou LIVE correspondente ao ambiente.
- `STRIPE_WEBHOOK_SECRET` — segredo do endpoint de webhook.
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` — reservado para integrações Stripe.js no browser; nunca coloque a secret key no frontend.

### Webhook local

Com Stripe CLI instalado:

```powershell
stripe login
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

Copie o `whsec_...` mostrado pelo CLI para `STRIPE_WEBHOOK_SECRET`.

Para testes de eventos, use o Stripe CLI para encaminhar eventos para o endpoint. O servidor valida a assinatura do payload bruto, grava o `event.id` de forma única e só altera a encomenda depois de processar o evento.

### Fluxo financeiro

```text
Checkout
  ↓
Order AWAITING_PAYMENT
  ↓
Stripe Checkout Session
  ↓
PaymentIntent (1 por encomenda)
  ↓
Stripe webhook
  ↓
Payment PAID / FAILED / PROCESSING
  ↓
Order PAYMENT_CONFIRMED quando o pagamento está confirmado
```

A página de sucesso não é utilizada como prova definitiva de pagamento. O fulfillment depende dos eventos Stripe no servidor.

### Administração

- `/admin/payments` — transações Stripe, filtros, taxas e líquido.
- `/api/admin/payments/[id]/refund` — reembolso total/parcial.
- `/api/admin/disputes` — disputas/chargebacks persistidos pelos webhooks.
- `/api/admin/payouts?sync=1` — sincronização de payouts da conta Stripe.

Nunca são armazenados número completo do cartão, CVV ou PIN. Os IDs Stripe são referências de auditoria.

### Reembolsos

O endpoint administrativo recebe `amountMinor` em unidade mínima da moeda. Para EUR, por exemplo, €100,00 = 10000. O backend calcula o valor ainda disponível e rejeita over-refund. A operação usa idempotência na chamada à Stripe e o estado final é reconciliado pelos eventos de refund.

### Testes recomendados

Use cartões de teste oficiais da Stripe no modo TEST. Valide, no mínimo:

1. pagamento aprovado;
2. cartão recusado;
3. autenticação 3DS;
4. webhook com assinatura inválida;
5. webhook duplicado;
6. reembolso total;
7. reembolso parcial;
8. tentativa de over-refund;
9. disputa simulada/teste quando disponível no ambiente Stripe;
10. payout recebido por webhook ou sincronização administrativa.

A integração não altera MULTICAIXA nem transforma a aplicação em marketplace.
