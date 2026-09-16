// Security utility helpers — shared across API route files.
// Sanitize inputs, mask sensitive data, and log security events.
import { pool } from '@/lib/db';

export function sanitizeInput(input: string): string {
  return input
    .replace(/<script[^>]*>.*?<\/script>/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '')
    .trim()
    .slice(0, 10000);
}

export function validatePlatformKey(key: string): boolean {
  return /^[a-z_]{2,50}$/.test(key);
}

export function maskSensitiveData(
  obj: Record<string, unknown>,
): Record<string, unknown> {
  const SENSITIVE_KEYS = ['token', 'secret', 'password', 'key', 'credential', 'auth'];
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) =>
      SENSITIVE_KEYS.some((s) => k.toLowerCase().includes(s))
        ? [k, '***REDACTED***']
        : [k, v],
    ),
  );
}

export interface SecurityEventInput {
  event_type: string;
  user_email?: string;
  user_id?: number;
  user_type?: string;
  ip_address?: string;
  user_agent?: string;
  resource_type?: string;
  resource_id?: string;
  action: string;
  outcome: 'success' | 'failure' | 'blocked';
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  details?: Record<string, unknown>;
}

export function logSecurityEvent(event: SecurityEventInput): void {
  // Non-blocking — fire and forget; never throws so the caller is not blocked.
  pool
    .query(
      `INSERT INTO security_audit_log
         (event_type, user_id, user_email, user_type, ip_address, user_agent,
          resource_type, resource_id, action, outcome, risk_level, details)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [
        event.event_type,
        event.user_id ?? null,
        event.user_email ?? null,
        event.user_type ?? null,
        event.ip_address ?? null,
        event.user_agent ?? null,
        event.resource_type ?? null,
        event.resource_id ?? null,
        event.action,
        event.outcome,
        event.risk_level,
        JSON.stringify(event.details ?? {}),
      ],
    )
    .catch((err: unknown) => {
      console.error('[logSecurityEvent] failed to persist:', err);
    });
}
