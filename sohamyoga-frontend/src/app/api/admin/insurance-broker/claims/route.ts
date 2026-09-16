import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const { searchParams } = new URL(req.url);
  const policy_id = searchParams.get('policy_id');
  const status = searchParams.get('status');
  const policy_type = searchParams.get('policy_type');

  const conditions: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  if (policy_id) { conditions.push(`cl.policy_id = $${idx++}`); params.push(parseInt(policy_id, 10)); }
  if (status) { conditions.push(`cl.status = $${idx++}`); params.push(status); }
  if (policy_type && policy_type !== 'all') { conditions.push(`p.policy_type = $${idx++}`); params.push(policy_type); }

  const where = conditions.length ? 'AND ' + conditions.join(' AND ') : '';

  const pool = getPool();
  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT cl.*, p.policy_type, p.insurer, p.policy_number,
        ic.name AS client_name, ic.phone AS client_phone
      FROM insurance_claim cl
      JOIN insurance_policy p ON p.id = cl.policy_id
      JOIN insurance_client ic ON ic.id = p.client_id
      WHERE 1=1 ${where}
      ORDER BY cl.created_at DESC
      LIMIT 500
    `, params);

    const total_open = result.rows
      .filter(r => !['paid', 'denied', 'closed'].includes(r.status))
      .reduce((sum: number, r) => sum + Number(r.claim_amount || 0), 0);

    return Response.json({ claims: result.rows, total_open });
  } finally {
    client.release();
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const b = await req.json().catch(() => null);
  if (!b || !b.policy_id) {
    return Response.json({ error: 'policy_id is required.' }, { status: 400 });
  }

  const pool = getPool();
  const client = await pool.connect();
  try {
    const result = await client.query(`
      INSERT INTO insurance_claim
        (policy_id, claim_number, claim_type, incident_date, filed_date, claim_amount, status, notes)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      RETURNING *
    `, [
      b.policy_id, b.claim_number || null, b.claim_type || null,
      b.incident_date || null, b.filed_date || null, b.claim_amount || null,
      b.status || 'filed', b.notes || null,
    ]);
    return Response.json({ claim: result.rows[0] }, { status: 201 });
  } finally {
    client.release();
  }
}

export async function PUT(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const b = await req.json().catch(() => null);
  if (!b || !b.id) return Response.json({ error: 'Claim ID required.' }, { status: 400 });

  const pool = getPool();
  const client = await pool.connect();
  try {
    const result = await client.query(`
      UPDATE insurance_claim SET
        status = COALESCE($2, status),
        approved_amount = COALESCE($3, approved_amount),
        notes = COALESCE($4, notes)
      WHERE id = $1 RETURNING *
    `, [b.id, b.status, b.approved_amount, b.notes]);
    if (!result.rowCount) return Response.json({ error: 'Claim not found.' }, { status: 404 });
    return Response.json({ claim: result.rows[0] });
  } finally {
    client.release();
  }
}
