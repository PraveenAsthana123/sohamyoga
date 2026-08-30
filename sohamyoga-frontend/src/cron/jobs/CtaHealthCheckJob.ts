// CtaHealthCheckJob — Every 6 hours
// Re-checks every non-archived CTA's destination URL. A CTA whose check flips
// to 'broken' automatically falls back to its fallback_url on the next real
// visitor click (see src/app/go/[slug]/route.ts) — never a dead link served live.

import { query } from '@/lib/postgres';

export async function run(): Promise<void> {
  const ctas = await query<{ id: string; destination_url: string }>(
    `SELECT id, destination_url FROM cta WHERE status <> 'archived'`,
  );

  let ok = 0, broken = 0;
  for (const cta of ctas.rows) {
    let status: 'ok' | 'broken' = 'broken';
    try {
      let res = await fetch(cta.destination_url, { method: 'HEAD', redirect: 'follow', signal: AbortSignal.timeout(5_000) });
      if (!res.ok) res = await fetch(cta.destination_url, { method: 'GET', redirect: 'follow', signal: AbortSignal.timeout(5_000) });
      status = res.ok ? 'ok' : 'broken';
    } catch {
      status = 'broken';
    }
    await query(`UPDATE cta SET last_check_status = $2, last_checked_at = now() WHERE id = $1`, [cta.id, status]);
    if (status === 'ok') ok += 1; else broken += 1;
  }

  console.log(`[cta-health-check] ${ctas.rows.length} CTA(s) checked, ${ok} ok, ${broken} broken`);
}
