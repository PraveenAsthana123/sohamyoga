// Minimal, real in-memory sliding-window rate limiter. Same pattern already
// used in market-research-portal's src/lib/rate-limit.ts — replicated here
// rather than shared cross-portal since no shared-backend-style package
// covers this yet (see MASTER_LLD.md's note on the auth-gate duplication
// pattern; this is the same shape of tradeoff). Scoped to a single Node
// process — correct for this app's current one-container deployment; a
// multi-instance deployment would need a shared store (Redis) instead.
// Added 2026-09-08 (engineering audit fix, SEC-06): this app previously had
// zero rate limiting anywhere, including on real outbound call placement.
const buckets = new Map<string, number[]>();

export function isRateLimited(key: string, maxRequests: number, windowMs: number): boolean {
  const now = Date.now();
  const hits = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
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
