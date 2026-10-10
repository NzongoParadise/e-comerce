import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveAppUrl } from './appUrl';

test('prefers the configured public app URL', () => {
  assert.equal(
    resolveAppUrl({
      FRONTEND_URL: 'https://shop.example/',
      VERCEL_URL: 'preview.example',
      NODE_ENV: 'production',
    }),
    'https://shop.example',
  );
});

test('uses the Vercel deployment hostname when no app URL is configured', () => {
  assert.equal(
    resolveAppUrl({ VERCEL_URL: 'preview.example', NODE_ENV: 'production' }),
    'https://preview.example',
  );
});

test('keeps production from silently falling back to localhost', () => {
  assert.equal(resolveAppUrl({ NODE_ENV: 'production' }), null);
});

test('uses localhost for local development', () => {
  assert.equal(resolveAppUrl({ NODE_ENV: 'development' }), 'http://localhost:3000');
});
