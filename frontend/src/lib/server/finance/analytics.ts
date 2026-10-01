export type FinanceOutlierInput = {
  id: number;
  category: string;
  currency: string;
  amount: number;
  description: string;
  transactionDate: Date;
};

export type FinanceOutlier = FinanceOutlierInput & { robustScore: number; peerCount: number; median: number };

export type Forecast = {
  value: number | null;
  lower: number | null;
  upper: number | null;
  method: 'LINEAR_TREND' | 'MOVING_AVERAGE' | null;
  observations: number;
};

function median(values: number[]) {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

export function forecastNextPeriod(values: number[]): Forecast {
  const safeValues = values.map((value) => Number.isFinite(value) ? Math.max(0, value) : 0);
  const observations = safeValues.filter((value) => value > 0).length;
  if (safeValues.length < 3 || observations < 3) {
    return { value: null, lower: null, upper: null, method: null, observations };
  }

  const useTrend = observations >= 6;
  const sample = useTrend ? safeValues.slice(-6) : safeValues.slice(-3);
  const prediction = useTrend
    ? (() => {
      const averageX = (sample.length - 1) / 2;
      const averageY = sample.reduce((sum, value) => sum + value, 0) / sample.length;
      const numerator = sample.reduce((sum, value, index) => sum + (index - averageX) * (value - averageY), 0);
      const denominator = sample.reduce((sum, _value, index) => sum + (index - averageX) ** 2, 0);
      return averageY + (denominator ? numerator / denominator : 0) * (sample.length - averageX);
    })()
    : sample.reduce((sum, value) => sum + value, 0) / sample.length;
  const residuals = useTrend
    ? sample.map((value, index) => {
      const averageX = (sample.length - 1) / 2;
      const averageY = sample.reduce((sum, point) => sum + point, 0) / sample.length;
      const numerator = sample.reduce((sum, point, pointIndex) => sum + (pointIndex - averageX) * (point - averageY), 0);
      const denominator = sample.reduce((sum, _point, pointIndex) => sum + (pointIndex - averageX) ** 2, 0);
      const slope = denominator ? numerator / denominator : 0;
      const fitted = averageY + slope * (index - averageX);
      return value - fitted;
    })
    : sample.map((value) => value - prediction);
  const residualDeviation = Math.sqrt(residuals.reduce((sum, value) => sum + value ** 2, 0) / Math.max(1, residuals.length - 1));
  const margin = 1.96 * residualDeviation;
  const forecastValue = Math.max(0, prediction);

  return {
    value: forecastValue,
    lower: Math.max(0, forecastValue - margin),
    upper: forecastValue + margin,
    method: useTrend ? 'LINEAR_TREND' : 'MOVING_AVERAGE',
    observations,
  };
}

export function detectExpenseOutliers(entries: FinanceOutlierInput[], minimumPeers = 5): FinanceOutlier[] {
  return entries.flatMap((entry) => {
    const peers = entries.filter((candidate) => candidate.id !== entry.id
      && candidate.currency === entry.currency
      && candidate.category.trim().toLocaleLowerCase() === entry.category.trim().toLocaleLowerCase());
    if (peers.length < minimumPeers) return [];

    const peerMedian = median(peers.map((peer) => peer.amount));
    const medianAbsoluteDeviation = median(peers.map((peer) => Math.abs(peer.amount - peerMedian)));
    if (entry.amount <= peerMedian) return [];
    const robustScore = medianAbsoluteDeviation > 0
      ? 0.6745 * (entry.amount - peerMedian) / medianAbsoluteDeviation
      : entry.amount >= peerMedian * 3 ? 10 : 0;
    if (robustScore < 3.5) return [];
    return [{ ...entry, robustScore, peerCount: peers.length, median: peerMedian }];
  });
}