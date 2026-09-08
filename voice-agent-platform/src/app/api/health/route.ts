import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

// Real liveness+DB-connectivity check, no auth (intentional, for
// health-poller use — matches the pattern already used by
// SohamYoga.Web's /api/health and sohamyoga-frontend's /api/health).
// Added 2026-09-08: this portal was the one app in the workspace with no
// health endpoint at all, found during the engineering audit's per-portal
// review after this container was found stopped with nothing to detect it.
export async function GET() {
  try {
    await query('SELECT 1');
    return NextResponse.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      checks: [{ name: 'database', status: 'healthy' }],
    });
  } catch (err) {
    return NextResponse.json(
      {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        checks: [{ name: 'database', status: 'unhealthy', error: String(err) }],
      },
      { status: 503 },
    );
  }
}
