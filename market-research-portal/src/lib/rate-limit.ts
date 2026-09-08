// Minimal, real in-memory sliding-window rate limiter for public,
// unauthenticated write endpoints (e.g. /api/leads/capture). Scoped to a
// single Node process — correct for this app's current deployment shape
// (one long-running `next start` process, no load balancer/multi-instance
// setup in this repo); a multi-instance deployment would need a shared
// store (Redis) instead, and that's a real infra decision, not a code gap
// to silently work around here.
const buckets = new Map<string, number[]>();

export function isRateLimited(key: string, maxRequests: number, windowMs: number): boolean {
  const now = Date.now();
  const hits = (buckets.get(key) ?? []).filter(t => now - t < windowMs);
  if (hits.length >= maxRequests) {
    buckets.set(key, hits);
    return true;
  }
  hits.push(now);
  buckets.set(key, hits);
  return false;
}

export function clientIp(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for');
  return fwd?.split(',')[0]?.trim() || 'unknown';
}
