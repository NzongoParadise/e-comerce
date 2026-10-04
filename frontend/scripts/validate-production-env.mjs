import { existsSync } from 'node:fs';

const required = [
  'DATABASE_URL',
  'JWT_SECRET',
  'FRONTEND_URL',
  'JWKS_URI',
  'AUTH_ISSUER',
  'AUTH_AUDIENCE',
];

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

const envFile = '.env.production';
if (!existsSync(envFile)) {
  console.warn('No local .env.production file found. This is expected on managed hosts that inject env vars at runtime.');
}

console.log('Production environment validation passed.');
