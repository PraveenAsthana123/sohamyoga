import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const auth = await requireAdmin(req);
  if (auth) return auth;
  const pool = getPool();
  const client = await pool.connect();
  try {
    const { rows: routeRows } = await client.query(`SELECT * FROM ls_route WHERE id = $1`, [params.id]);
    if (!routeRows.length) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const route = routeRows[0];
    let jobs: unknown[] = [];
    if (route.job_ids?.length > 0) {
      const { rows: jobRows } = await client.query(`
        SELECT j.*, c.first_name || ' ' || c.last_name AS client_name, c.address
        FROM ls_job j LEFT JOIN ls_client c ON c.id = j.client_id
        WHERE j.id = ANY($1)
      `, [route.job_ids]);
      jobs = jobRows;
    }
    return NextResponse.json({ ...route, jobs });
  } finally {
    client.release();
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const auth = await requireAdmin(req);
  if (auth) return auth;
  const pool = getPool();
  const client = await pool.connect();
  try {
    const body = await req.json();
    const { action } = body;
    if (action === 'start') {
      const { rows } = await client.query(`UPDATE ls_route SET status = 'in_progress' WHERE id = $1 RETURNING *`, [params.id]);
      return NextResponse.json(rows[0]);
    }
    if (action === 'complete') {
      const { rows } = await client.query(`UPDATE ls_route SET status = 'completed', actual_hours = $2 WHERE id = $1 RETURNING *`, [params.id, body.actual_hours ?? null]);
      return NextResponse.json(rows[0]);
    }
    const fields = Object.keys(body).filter(k => k !== 'id' && k !== 'action');
    if (!fields.length) return NextResponse.json({ error: 'No fields' }, { status: 400 });
    const sets = fields.map((f, i) => `${f} = $${i + 2}`).join(', ');
    const vals = fields.map(f => body[f]);
    const { rows } = await client.query(`UPDATE ls_route SET ${sets} WHERE id = $1 RETURNING *`, [params.id, ...vals]);
    return NextResponse.json(rows[0]);
  } finally {
    client.release();
  }
}
