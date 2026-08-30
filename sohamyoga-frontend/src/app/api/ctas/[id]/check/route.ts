import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// POST — re-runs a real destination-health check (Module 9's "broken-CTA /
// destination-health monitoring"). Manually triggerable; also what
// CtaHealthCheckJob calls on schedule for every active CTA.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const result = await query<{ destination_url: string }>(`SELECT destination_url FROM cta WHERE id = $1`, [params.id]);
  if (!result.rows.length) return Response.json({ error: 'CTA not found.' }, { status: 404 });

  let status: 'ok' | 'broken' = 'broken';
  try {
    let res = await fetch(result.rows[0].destination_url, { method: 'HEAD', redirect: 'follow', signal: AbortSignal.timeout(5_000) });
    if (!res.ok) res = await fetch(result.rows[0].destination_url, { method: 'GET', redirect: 'follow', signal: AbortSignal.timeout(5_000) });
    status = res.ok ? 'ok' : 'broken';
  } catch {
    status = 'broken';
  }

  await query(`UPDATE cta SET last_check_status = $2, last_checked_at = now() WHERE id = $1`, [params.id, status]);
  return Response.json({ ok: true, lastCheckStatus: status });
}
