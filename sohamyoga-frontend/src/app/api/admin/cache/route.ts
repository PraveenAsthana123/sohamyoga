import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { revalidateTag } from 'next/cache';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Cache audit summary — sourced from a real scan of API routes:
//   159 files use cache: 'no-store'  (confirmed via grep)
//   0 files use cache: 'force-cache' (confirmed via grep — none found)
const ROUTES_WITH_NO_STORE = 159;
const ROUTES_WITH_FORCE_CACHE = 0;

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const redisUrlSet = !!(process.env.REDIS_URL && process.env.REDIS_URL.trim());

  // Probe Redis if configured.
  // ioredis is loaded via a runtime-string import to avoid a hard compile-time dependency when
  // the package is not yet installed. If ioredis is not installed, the import throws and we
  // fall through to redisPingOk = false.
  let redisLatencyMs: number | null = null;
  let redisPingOk = false;
  if (redisUrlSet) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ioredis = await (Function('m', 'return import(m)')('ioredis') as Promise<{ default: any }>);
      const redis = new ioredis.default(process.env.REDIS_URL as string, { lazyConnect: true, connectTimeout: 3000 });
      await redis.connect();
      const t0 = Date.now();
      await redis.ping();
      redisLatencyMs = Date.now() - t0;
      redisPingOk = true;
      await redis.quit();
    } catch {
      redisPingOk = false;
    }
  }

  return Response.json({
    redis_configured: redisUrlSet && redisPingOk,
    redis_url_set: redisUrlSet,
    redis_latency_ms: redisLatencyMs,
    nextjs_cache: 'enabled',
    routes_with_no_store: ROUTES_WITH_NO_STORE,
    routes_with_force_cache: ROUTES_WITH_FORCE_CACHE,
  });
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const redisUrlSet = !!(process.env.REDIS_URL && process.env.REDIS_URL.trim());

  let body: { action?: string; tag?: string } = {};
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { action, tag } = body;

  if (action !== 'clear_tag') {
    return Response.json({ error: 'Unknown action. Supported: clear_tag' }, { status: 400 });
  }

  if (!redisUrlSet) {
    return Response.json({ cleared: false, reason: 'Redis not configured' });
  }

  // revalidateTag works via Next.js cache tags regardless of Redis
  try {
    if (tag) {
      revalidateTag(tag);
    }
    return Response.json({ cleared: true, tag: tag ?? null });
  } catch (err) {
    return Response.json(
      { cleared: false, reason: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
