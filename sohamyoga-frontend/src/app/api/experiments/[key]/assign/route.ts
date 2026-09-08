import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { getPrimaryTenantId } from '@/domain/ingestion/Connector';
import { bucketFor, pickVariant } from '@/domain/experimentation/Experiment';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Public, unauthenticated — this is what a real page calls to find out which
// variant a visitor (logged in or anonymous) should see, using the same
// subject identifiers tracking_event already uses. Sticky: once assigned,
// the same subjectId always gets the same variant back (DB-enforced via the
// UNIQUE(experiment_id, subject_id) constraint, race-safe via ON CONFLICT).
export async function GET(req: NextRequest, { params }: { params: { key: string } }) {
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });
  const subjectId = req.nextUrl.searchParams.get('subjectId');
  if (!subjectId) return Response.json({ error: 'subjectId query param is required.' }, { status: 400 });

  const tenantId = await getPrimaryTenantId();
  const exp = await query<{ id: string; status: string }>(`SELECT id, status FROM experiment WHERE tenant_id = $1 AND key = $2`, [tenantId, params.key]);
  if (!exp.rowCount) return Response.json({ error: 'Unknown experiment key.' }, { status: 404 });
  if (exp.rows[0].status !== 'running') return Response.json({ assigned: false, reason: `Experiment is ${exp.rows[0].status}, not running.` });

  const existing = await query<{ variant_id: string }>(`SELECT variant_id FROM experiment_assignment WHERE experiment_id = $1 AND subject_id = $2`, [exp.rows[0].id, subjectId]);
  if (existing.rowCount) {
    const v = await query<{ key: string; name: string }>(`SELECT key, name FROM experiment_variant WHERE id = $1`, [existing.rows[0].variant_id]);
    return Response.json({ assigned: true, variant: v.rows[0] });
  }

  const variants = await query<{ id: string; key: string; allocation_percent: number }>(`SELECT id, key, allocation_percent FROM experiment_variant WHERE experiment_id = $1`, [exp.rows[0].id]);
  const bucket = bucketFor(params.key, subjectId);
  const picked = pickVariant(bucket, variants.rows.map(v => ({ id: v.id, key: v.key, allocationPercent: v.allocation_percent })));
  if (!picked) return Response.json({ error: 'Experiment variant allocations are misconfigured.' }, { status: 500 });

  const inserted = await query<{ variant_id: string }>(
    `INSERT INTO experiment_assignment (experiment_id, variant_id, subject_id) VALUES ($1,$2,$3)
     ON CONFLICT (experiment_id, subject_id) DO UPDATE SET subject_id = EXCLUDED.subject_id
     RETURNING variant_id`,
    [exp.rows[0].id, picked.id, subjectId],
  );
  const v = await query<{ key: string; name: string }>(`SELECT key, name FROM experiment_variant WHERE id = $1`, [inserted.rows[0].variant_id]);
  return Response.json({ assigned: true, variant: v.rows[0] });
}
