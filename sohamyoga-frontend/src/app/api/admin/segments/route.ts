import { NextRequest } from 'next/server';
import { requireAdmin, getAdminPrincipal } from '@/lib/admin-auth';
import { databaseConfigured, query } from '@/lib/postgres';
import { getPrimaryTenantId } from '@/domain/ingestion/Connector';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const VALID_LOGIC = ['AND', 'OR'];

export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const tenantId = await getPrimaryTenantId();
  const statusFilter = req.nextUrl.searchParams.get('status');

  const params: unknown[] = [tenantId];
  let whereExtra = '';
  if (statusFilter) {
    params.push(statusFilter);
    whereExtra = ` AND is_dynamic = CASE WHEN $2 = 'active' THEN true ELSE is_dynamic END`;
  }

  const [segments, summary] = await Promise.all([
    query<{
      id: string; name: string; description: string; criteria: string; logic: string;
      estimated_size: number; last_computed_at: string | null; is_dynamic: boolean;
      created_by_id: string; created_at: string;
    }>(
      `SELECT id, name, description, criteria, logic, estimated_size, last_computed_at,
              is_dynamic, created_by_id, created_at
       FROM audience_segment
       WHERE tenant_id = $1${whereExtra}
       ORDER BY created_at DESC`,
      params,
    ),
    query<{ total: string; active: string; new_this_month: string }>(
      `SELECT
         count(*)::text AS total,
         count(*) FILTER (WHERE is_dynamic = true)::text AS active,
         count(*) FILTER (WHERE created_at >= date_trunc('month', now()))::text AS new_this_month
       FROM audience_segment WHERE tenant_id = $1`,
      [tenantId],
    ),
  ]);

  const s = summary.rows[0];
  return Response.json({
    segments: segments.rows,
    summary: {
      total: Number(s.total),
      active: Number(s.active),
      newThisMonth: Number(s.new_this_month),
    },
  });
}

export async function POST(req: NextRequest) {
  const { principal, denied } = await getAdminPrincipal(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const body = await req.json().catch(() => null) as {
    name?: string; description?: string; criteria?: unknown; logic?: string; isDynamic?: boolean;
  } | null;

  if (!body?.name?.trim()) return Response.json({ error: 'name is required.' }, { status: 400 });
  if (!body.criteria) return Response.json({ error: 'criteria is required.' }, { status: 400 });
  const logic = body.logic ?? 'AND';
  if (!VALID_LOGIC.includes(logic)) return Response.json({ error: 'logic must be AND or OR.' }, { status: 400 });

  const tenantId = await getPrimaryTenantId();
  const result = await query(
    `INSERT INTO audience_segment (tenant_id, name, description, criteria, logic, is_dynamic, created_by_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id, name, description, criteria, logic, estimated_size, is_dynamic, created_at`,
    [
      tenantId,
      body.name.trim(),
      body.description?.trim() ?? '',
      JSON.stringify(body.criteria),
      logic,
      body.isDynamic ?? true,
      principal!.email ?? principal!.id,
    ],
  );
  return Response.json({ segment: result.rows[0] }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const body = await req.json().catch(() => null) as {
    id?: string; name?: string; description?: string; criteria?: unknown;
    logic?: string; isDynamic?: boolean; estimatedSize?: number;
  } | null;

  if (!body?.id) return Response.json({ error: 'id is required.' }, { status: 400 });

  const setClauses: string[] = [];
  const params: unknown[] = [body.id];

  if (body.name !== undefined) { params.push(body.name.trim()); setClauses.push(`name = $${params.length}`); }
  if (body.description !== undefined) { params.push(body.description.trim()); setClauses.push(`description = $${params.length}`); }
  if (body.criteria !== undefined) { params.push(JSON.stringify(body.criteria)); setClauses.push(`criteria = $${params.length}`); }
  if (body.logic !== undefined && VALID_LOGIC.includes(body.logic)) { params.push(body.logic); setClauses.push(`logic = $${params.length}`); }
  if (body.isDynamic !== undefined) { params.push(body.isDynamic); setClauses.push(`is_dynamic = $${params.length}`); }
  if (body.estimatedSize !== undefined) { params.push(body.estimatedSize); setClauses.push(`estimated_size = $${params.length}`); }

  if (!setClauses.length) return Response.json({ error: 'No fields to update.' }, { status: 400 });

  const result = await query(
    `UPDATE audience_segment SET ${setClauses.join(', ')}
     WHERE id = $1
     RETURNING id, name, description, criteria, logic, estimated_size, is_dynamic`,
    params,
  );
  if (!result.rowCount) return Response.json({ error: 'Segment not found.' }, { status: 404 });
  return Response.json({ segment: result.rows[0] });
}
