import { NextRequest } from 'next/server';
import { query } from '../../../lib/postgres';

export const dynamic = 'force-dynamic';

// Intentionally unauthenticated (UiErrorReporter mounts on /login too, before
// any session exists) — strictly bounded input, insert-only, no read path
// exposed here (reads go through the admin-gated /api/admin/operations-alerts).
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null) as { pagePath?: string; message?: string; stack?: string } | null;
  if (!body?.pagePath || !body?.message) {
    return Response.json({ error: 'pagePath and message are required.' }, { status: 400 });
  }
  await query(
    `INSERT INTO ui_error_log (page_path, message, stack) VALUES ($1,$2,$3)`,
    [String(body.pagePath).slice(0, 500), String(body.message).slice(0, 2000), body.stack ? String(body.stack).slice(0, 4000) : null],
  ).catch(() => {}); // best-effort telemetry — never let logging failure surface to the user
  return Response.json({ ok: true });
}
