// ---------------------------------------------------------------------------
// lib/logger.ts — Structured JSON logger (P7-FIX-30)
//
// Lightweight structured logger built on console. No external dependencies.
// Production: JSON output (Vercel log drain compatible).
// Development: human-readable format.
//
// Server-only. Client components must NOT import this file.
// ---------------------------------------------------------------------------

export interface LogContext {
  requestId?: string;
  orgId?: string;
  userId?: string;
  route?: string;
  sprint?: string;
  duration_ms?: number;
  [key: string]: unknown;
}

// Fields that must never appear in log output
const REDACTED_FIELDS = new Set([
  'password',
  'token',
  'secret',
  'authorization',
  'stripe_customer_id',
  'stripe_subscription_id',
  'cookie',
  'api_key',
  'apiKey',
]);

/**
 * Recursively redact sensitive fields from a context object.
 * Returns a shallow copy with redacted values replaced by '[REDACTED]'.
 */
export function redactSensitiveFields(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (REDACTED_FIELDS.has(key.toLowerCase())) {
      result[key] = '[REDACTED]';
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      result[key] = redactSensitiveFields(value as Record<string, unknown>);
    } else {
      result[key] = value;
    }
  }
  return result;
}

function serializeError(err: unknown): Record<string, unknown> {
  if (err instanceof Error) {
    return {
      message: err.message,
      name: err.name,
      ...(err.stack ? { stack: err.stack.split('\n').slice(0, 5).join('\n') } : {}),
    };
  }
  return { message: String(err) };
}

const isProduction = process.env.NODE_ENV === 'production';

function formatMessage(
  level: 'info' | 'warn' | 'error',
  message: string,
  context?: LogContext,
  error?: unknown,
): string | [string, Record<string, unknown>] {
  const entry: Record<string, unknown> = {
    level,
    message,
    timestamp: new Date().toISOString(),
    service: 'localvector-api',
    ...(context ? redactSensitiveFields(context) : {}),
    ...(error ? { error: serializeError(error) } : {}),
  };

  if (isProduction) {
    return JSON.stringify(entry);
  }

  // Development: human-readable
  const prefix = `[${level.toUpperCase()}]`;
  const ctx = context
    ? ` ${Object.entries(redactSensitiveFields(context))
        .map(([k, v]) => `${k}=${v}`)
        .join(' ')}`
    : '';
  const errStr = error ? ` err=${error instanceof Error ? error.message : String(error)}` : '';
  return `${prefix} ${message}${ctx}${errStr}`;
}

export const log = {
  info(message: string, context?: LogContext): void {
    const output = formatMessage('info', message, context);
    // eslint-disable-next-line no-console
    console.log(output);
  },

  warn(message: string, context?: LogContext): void {
    const output = formatMessage('warn', message, context);
    // eslint-disable-next-line no-console
    console.warn(output);
  },

  error(message: string, context?: LogContext, error?: unknown): void {
    const output = formatMessage('error', message, context, error);
    // eslint-disable-next-line no-console
    console.error(output);
  },
};

export default log;
