import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const pool = getPool();
  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      `SELECT c.*, cl.company_name FROM dac_campaign c LEFT JOIN dac_client cl ON cl.id=c.client_id WHERE c.id=$1`,
      [params.id]
    );
    if (!rows[0]) return Response.json({ error: 'Not found' }, { status: 404 });
    return Response.json(rows[0]);
  } finally {
    client.release();
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const body = await req.json();
  const pool = getPool();
  const client = await pool.connect();
  try {
    const allowed = ['status','spend_mtd','impressions_mtd','clicks_mtd','conversions_mtd','leads_mtd','roas','cpc','ctr','cpa','budget_monthly'];
    const fields = Object.keys(body).filter(k => allowed.includes(k));
    if (!fields.length) return Response.json({ error: 'No valid fields' }, { status: 400 });
    const sets = fields.map((f, i) => `${f}=$${i + 2}`).join(', ');
    const { rows } = await client.query(
      `UPDATE dac_campaign SET ${sets} WHERE id=$1 RETURNING *`,
      [params.id, ...fields.map(f => body[f])]
    );
    return Response.json(rows[0]);
  } finally {
    client.release();
  }
}
