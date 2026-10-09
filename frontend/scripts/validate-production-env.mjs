import { existsSync } from 'node:fs';

const required = [
  'DATABASE_URL',
  'JWT_SECRET',
  'FRONTEND_URL',
  'CRON_SECRET',
];

// The app's own login issues HS256 tokens with JWT_SECRET. These settings are
// only needed when accepting externally-issued RS256 tokens.
const externalAuth = ['JWKS_URI', 'AUTH_ISSUER', 'AUTH_AUDIENCE'];

const isProduction = process.env.NODE_ENV === 'production'
  || process.env.VERCEL_ENV === 'production'
  || process.env.RENDER === 'true';

if (!isProduction) {
  console.log('Skipping production env validation because the app is not running in production mode.');
  process.exit(0);
}

const missing = required.filter((key) => !process.env[key] || !String(process.env[key]).trim());
if (missing.length > 0) {
  console.error('Missing required production env vars:', missing.join(', '));
  console.error('Copy frontend/.env.production.example to frontend/.env.production and fill in the real values before deployment.');
  process.exit(1);
}

const configuredExternalAuth = externalAuth.filter((key) => process.env[key]?.trim());
if (configuredExternalAuth.length > 0 && configuredExternalAuth.length < externalAuth.length) {
  const missingExternalAuth = externalAuth.filter((key) => !process.env[key]?.trim());
  console.warn('External RS256 authentication is only partially configured. Missing:', missingExternalAuth.join(', '));
  console.warn('This does not affect the app’s local HS256 login. Complete all three settings only if external RS256 tokens are used.');
}

const envFile = '.env.production';
if (!existsSync(envFile)) {
  console.warn('No local .env.production file found. This is expected on managed hosts that inject env vars at runtime.');
}

const sellerTaxId = process.env.SELLER_TAX_ID?.trim() || process.env.COMPANY_NIF?.trim();
const sellerAddress = process.env.SELLER_ADDRESS?.trim();
if (!sellerTaxId || !sellerAddress) {
  console.warn('Commercial invoice issuance will remain blocked until SELLER_TAX_ID (or COMPANY_NIF) and SELLER_ADDRESS are configured with the seller’s real fiscal data.');
}

console.log('Production environment validation passed.');
