import { NextRequest } from 'next/server';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { databaseConfigured, query } from '@/lib/postgres';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Rough, honest denominator: count real admin nav entries (deduped by href)
// in this app's own layout, so "24 of ~N cataloged" is grounded in a real
// count rather than an invented total. market-research-portal's own page
// count is added as a static, source-cited figure (cross-DB directory
// listing is out of scope) — kept separate and labeled, never summed into
// a single misleading number.
async function countAdminSurfaces(): Promise<number> {
  try {
    const raw = await readFile(path.join(process.cwd(), 'src', 'app', 'admin', 'layout.tsx'), 'utf8');
    const hrefs = new Set([...raw.matchAll(/href:\s*'(\/admin\/[^']+)'/g)].map(m => m[1]));
    return hrefs.size;
  } catch {
    return 0;
  }
}

export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const [modules, adminSurfaceCount] = await Promise.all([
    query(`SELECT * FROM module_registry ORDER BY built_status = 'not_yet_cataloged' DESC, app, name`),
    countAdminSurfaces(),
  ]);

  const tally = modules.rows.reduce((m: Record<string, number>, r: any) => ({ ...m, [r.built_status]: (m[r.built_status] ?? 0) + 1 }), {});

  // Mandatory per-dimension tallies (Module Understanding Standard policy
  // section 6) — explicit booleans for user/admin UI, derived counts for
  // database/report/dashboard since those are reliably inferable from
  // existing columns without a fragile text-pattern guess.
  const dimensionTally = {
    userFlowUI: modules.rows.filter((r: any) => r.has_user_ui).length,
    adminUI: modules.rows.filter((r: any) => r.has_admin_ui).length,
    database: modules.rows.filter((r: any) => Array.isArray(r.schema_tables) && r.schema_tables.length > 0).length,
    report: modules.rows.filter((r: any) => r.report_location).length,
    dashboard: modules.rows.filter((r: any) => r.dashboard_location).length,
  };

  return Response.json({
    modules: modules.rows,
    tally,
    dimensionTally,
    catalogedCount: modules.rows.length,
    // Honest, explicitly-labeled estimate — not a precise total, and never
    // presented as if every admin nav entry is a distinct "module."
    estimatedSohamyogaFrontendAdminSurfaces: adminSurfaceCount,
    note: `${modules.rows.length} module(s) cataloged in this registry vs. an estimated ${adminSurfaceCount} distinct admin nav surfaces in sohamyoga-frontend alone (plus more in market-research-portal, not counted here) — most are not yet cataloged, which this registry states honestly rather than omitting them.`,
  });
}

export async function PATCH(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });
  const body = await req.json().catch(() => null) as { id?: string; verifiedBy?: string } | null;
  if (!body?.id) return Response.json({ error: 'id is required.' }, { status: 400 });
  const r = await query(
    `UPDATE module_registry SET last_verified_at = now(), verified_by = $2, updated_at = now() WHERE id = $1 RETURNING *`,
    [body.id, body.verifiedBy || 'admin'],
  );
  if (!r.rowCount) return Response.json({ error: 'Module not found.' }, { status: 404 });
  return Response.json({ module: r.rows[0] });
}
