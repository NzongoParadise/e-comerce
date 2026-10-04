export const REDACTED = '[REDACTED]';

const SENSITIVE_KEYS = /(secret|token|key|password|authorization|cookie|signature|webhook)/i;

export function sanitizeForLog(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') return value;
  if (Array.isArray(value)) return value.map((item) => sanitizeForLog(item));
  if (value instanceof Date) return value.toISOString();

  if (typeof value === 'object') {
    const output: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      const lowerKey = key.toLowerCase();
      output[key] = SENSITIVE_KEYS.test(lowerKey) ? REDACTED : sanitizeForLog(entry);
    }
    return output;
  }

  return String(value);
}

function write(level: 'info' | 'warn' | 'error', message: string, meta?: unknown) {
  const payload = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...(meta === undefined ? {} : { data: sanitizeForLog(meta) }),
  };

  if (process.env.NODE_ENV === 'production') {
    if (level === 'error') console.error(JSON.stringify(payload));
    else console.log(JSON.stringify(payload));
    return;
  }

  if (level === 'error') console.error(`[${level}] ${message}`, sanitizeForLog(meta));
  else console.log(`[${level}] ${message}`, sanitizeForLog(meta));
}

export const logger = {
  info: (message: string, meta?: unknown) => write('info', message, meta),
  warn: (message: string, meta?: unknown) => write('warn', message, meta),
  error: (message: string, meta?: unknown) => write('error', message, meta),
};
