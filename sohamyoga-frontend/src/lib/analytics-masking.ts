/** Mirror of SENSITIVE_KEY_FRAGMENTS from domain/analytics/TrackingEvent.ts */
const SENSITIVE_FRAGMENTS = [
  'name', 'email', 'phone', 'password', 'card', 'cvv', 'health',
  'diagnosis', 'message', 'address', 'dob', 'ssn', 'payment',
] as const;

/**
 * Returns a shallow copy of props with sensitive key values replaced by "***".
 * Case-insensitive substring match on keys. Raw IP is never passed through here —
 * only ipHash (SHA-256) should appear in props.
 */
export function maskProperties(
  props: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(props)) {
    const lower = k.toLowerCase();
    out[k] = SENSITIVE_FRAGMENTS.some(f => lower.includes(f)) ? '***' : v;
  }
  return out;
}

export { SENSITIVE_FRAGMENTS };
