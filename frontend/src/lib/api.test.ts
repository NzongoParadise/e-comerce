import assert from 'node:assert/strict';
import test from 'node:test';

import { fetchWithAuth } from './api';

test('fetchWithAuth surfaces the API error message instead of a generic status code', async () => {
  const originalFetch = global.fetch;

  global.fetch = async () =>
    new Response(JSON.stringify({ error: 'O gateway recusou iniciar o pagamento. Tente novamente.' }), {
      status: 409,
      headers: { 'Content-Type': 'application/json' },
    });

  try {
    await assert.rejects(
      () => fetchWithAuth('/api/orders', { method: 'POST' }),
      /O gateway recusou iniciar o pagamento\. Tente novamente\./,
    );
  } finally {
    global.fetch = originalFetch;
  }
});
