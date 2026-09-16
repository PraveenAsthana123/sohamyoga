import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const redisUrlSet = !!(process.env.REDIS_URL && process.env.REDIS_URL.trim());

  if (!redisUrlSet) {
    return Response.json({
      status: 'not_configured',
      redis_url_set: false,
      latency_ms: null,
      message: 'REDIS_URL environment variable is not set.',
    });
  }

  const t0 = Date.now();
  try {
    // Runtime-string import to avoid hard compile-time dependency on ioredis when not installed.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ioredis = await (Function('m', 'return import(m)')('ioredis') as Promise<{ default: any }>);
    const redis = new ioredis.default(process.env.REDIS_URL as string, {
      lazyConnect: true,
      connectTimeout: 3000,
      maxRetriesPerRequest: 1,
    });
    await redis.connect();
    await redis.ping();
    const latency_ms = Date.now() - t0;
    await redis.quit();

    return Response.json({
      status: 'healthy',
      redis_url_set: true,
      latency_ms,
      message: 'Redis ping successful.',
    });
  } catch (err) {
    return Response.json({
      status: 'error',
      redis_url_set: true,
      latency_ms: Date.now() - t0,
      message: err instanceof Error ? err.message : 'Redis probe failed.',
    });
  }
}
