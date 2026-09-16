import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { pool } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// platform_health_check columns:
//   id, platform, checked_at, status, latency_ms, error_message, http_status, api_endpoint_checked

interface HealthRow {
  id: string | number;
  platform: string;
  status: string;
  latency_ms: number | null;
  error_message: string | null;
  http_status: number | null;
  api_endpoint_checked: string | null;
  checked_at: string;
}

interface ServiceSummary {
  name: string;
  status: string;
  latencyMs: number | null;
  httpStatus: number | null;
  endpoint: string | null;
  errorMessage: string | null;
  lastChecked: string;
}

export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const client = await pool.connect();
  try {
    // Get latest status per platform from platform_health_check
    const result = await client.query<HealthRow>(`
      SELECT DISTINCT ON (platform)
        id, platform, status, latency_ms, error_message, http_status, api_endpoint_checked, checked_at
      FROM platform_health_check
      ORDER BY platform, checked_at DESC
    `).catch(() => ({ rows: [] as HealthRow[] }));

    const services: ServiceSummary[] = result.rows.map((r) => ({
      name: r.platform,
      status: r.status ?? 'unknown',
      latencyMs: r.latency_ms ?? null,
      httpStatus: r.http_status ?? null,
      endpoint: r.api_endpoint_checked ?? null,
      errorMessage: r.error_message ?? null,
      lastChecked: r.checked_at,
    }));

    // Derive overall status: healthy if all services healthy, degraded if any warn, unhealthy if any error
    let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    for (const s of services) {
      if (s.status === 'unhealthy' || s.status === 'error' || s.status === 'down') {
        overallStatus = 'unhealthy';
        break;
      }
      if (s.status === 'degraded' || s.status === 'warn' || s.status === 'warning') {
        overallStatus = 'degraded';
      }
    }

    const lastChecked = services.length
      ? services.reduce((latest, s) =>
          new Date(s.lastChecked) > new Date(latest) ? s.lastChecked : latest,
          services[0].lastChecked,
        )
      : new Date().toISOString();

    // Basic uptime: seconds since process start (Node.js process.uptime())
    const uptime = Math.floor(process.uptime());

    return Response.json({
      status: overallStatus,
      services,
      lastChecked,
      uptime,
    });
  } finally {
    client.release();
  }
}
