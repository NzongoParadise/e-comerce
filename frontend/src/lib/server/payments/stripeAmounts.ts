export function toStripeMinorUnits(amount: number) {
  if (!Number.isFinite(amount) || amount < 0) throw new RangeError('Invalid payment amount');
  return Math.round((amount + Number.EPSILON) * 100);
}

export function isStripeCurrencySupported(currency: string): currency is 'EUR' {
  return currency === 'EUR';
}

export function matchesStripePayment(amountTotal: unknown, currency: unknown, expectedAmount: number, expectedCurrency: 'AOA' | 'EUR') {
  return typeof amountTotal === 'number'
    && Number.isSafeInteger(amountTotal)
    && typeof currency === 'string'
    && currency === expectedCurrency.toLowerCase()
    && amountTotal === toStripeMinorUnits(expectedAmount);
}