import assert from 'node:assert/strict';
import test from 'node:test';

import { detectExpenseOutliers, forecastNextPeriod } from './analytics';

test('uses a moving average for a short financial history', () => {
  const forecast = forecastNextPeriod([0, 100, 120, 140]);
  assert.equal(forecast.method, 'MOVING_AVERAGE');
  assert.equal(forecast.observations, 3);
  assert.equal(forecast.value, 120);
});

test('uses a linear trend when enough months are observed', () => {
  const forecast = forecastNextPeriod([100, 110, 120, 130, 140, 150, 160, 170]);
  assert.equal(forecast.method, 'LINEAR_TREND');
  assert.equal(forecast.value, 180);
  assert.ok((forecast.lower || 0) <= forecast.value);
  assert.ok((forecast.upper || 0) >= forecast.value);
});

test('does not forecast with fewer than three active months', () => {
  const forecast = forecastNextPeriod([0, 120, 0, 0, 200]);
  assert.equal(forecast.value, null);
  assert.equal(forecast.method, null);
});

test('flags only robust expense outliers with enough same-category peers', () => {
  const expenses = [100, 105, 98, 102, 97, 101].map((amount, index) => ({
    id: index + 1,
    category: 'Logística',
    currency: 'AOA',
    amount,
    description: `Despesa ${index + 1}`,
    transactionDate: new Date('2026-09-01T00:00:00.000Z'),
  }));
  expenses.push({ id: 7, category: 'Logística', currency: 'AOA', amount: 500, description: 'Despesa fora do padrão', transactionDate: new Date('2026-09-01T00:00:00.000Z') });

  const outliers = detectExpenseOutliers(expenses);
  assert.deepEqual(outliers.map((entry) => entry.id), [7]);
});

test('does not compare expenses across categories or currencies', () => {
  const expenses = [
    ...Array.from({ length: 6 }, (_, index) => ({ id: index + 1, category: 'Software', currency: 'EUR', amount: 20, description: 'Licença', transactionDate: new Date() })),
    { id: 7, category: 'Logística', currency: 'AOA', amount: 500000, description: 'Transporte', transactionDate: new Date() },
  ];
  assert.deepEqual(detectExpenseOutliers(expenses), []);
});