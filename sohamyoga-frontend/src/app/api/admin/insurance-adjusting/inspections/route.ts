import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool, databaseConfigured } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'Database unavailable.' }, { status: 503 });
  const pool = getPool();
  const client = await pool.connect();
  try {
    const { searchParams } = new URL(req.url);
    const conditions: string[] = [];
    const vals: unknown[] = [];
    const claimId = searchParams.get('claim_id');
    const status = searchParams.get('status');
    const adjId = searchParams.get('adjuster_id');
    const dateFrom = searchParams.get('date_from');
    const dateTo = searchParams.get('date_to');
    if (claimId) { conditions.push(`i.claim_id=$${vals.length+1}`); vals.push(claimId); }
    if (status === 'submitted') { conditions.push(`i.report_submitted_at IS NOT NULL`); }
    if (status === 'pending') { conditions.push(`i.report_submitted_at IS NULL AND i.completed_date IS NOT NULL`); }
    if (status === 'scheduled') { conditions.push(`i.completed_date IS NULL`); }
    if (adjId) { conditions.push(`i.adjuster_id=$${vals.length+1}`); vals.push(adjId); }
    if (dateFrom) { conditions.push(`i.scheduled_date>=$${vals.length+1}`); vals.push(dateFrom); }
    if (dateTo) { conditions.push(`i.scheduled_date<=$${vals.length+1}`); vals.push(dateTo); }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const { rows } = await client.query(
      `SELECT i.*, a.name AS adjuster_name, c.claim_number, c.insured_name
       FROM adj_inspections i
       LEFT JOIN adj_adjusters a ON a.id=i.adjuster_id
       LEFT JOIN adj_claims c ON c.id=i.claim_id
       ${where} ORDER BY i.scheduled_date`,
      vals
    );
    return Response.json({ inspections: rows });
  } finally {
    client.release();
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'Database unavailable.' }, { status: 503 });
  const body = await req.json().catch(() => null);
  if (!body?.claim_id) return Response.json({ error: 'claim_id required.' }, { status: 400 });
  const pool = getPool();
  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      `INSERT INTO adj_inspections (claim_id, inspection_type, scheduled_date, adjuster_id, inspection_address, photos_count)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [body.claim_id, body.inspection_type ?? 'initial', body.scheduled_date, body.adjuster_id, body.inspection_address, body.photos_count ?? 0]
    );
    return Response.json({ inspection: rows[0] }, { status: 201 });
  } finally {
    client.release();
  }
}
