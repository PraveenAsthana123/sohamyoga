import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const action = searchParams.get('action'); // accept or decline

  if (!action || !['accept', 'decline'].includes(action)) {
    return Response.json({ error: 'action must be accept or decline' }, { status: 400 });
  }

  const newStatus = action === 'accept' ? 'accepted' : 'declined';

  const pool = getPool();
  const client = await pool.connect();
  try {
    const result = await client.query(
      `UPDATE fa_recommendation SET status = $1 WHERE id = $2 RETURNING *`,
      [newStatus, id]
    );
    if (!result.rows[0]) return Response.json({ error: 'Not found' }, { status: 404 });
    return Response.json({ recommendation: result.rows[0] });
  } finally {
    client.release();
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const { id } = await params;
  const b = await req.json().catch(() => null);
  if (!b) return Response.json({ error: 'Invalid body' }, { status: 400 });

  const allowed = ['recommendation_type','description','products','estimated_impact','priority','status'];
  const sets: string[] = [];
  const vals: unknown[] = [];
  let idx = 1;
  for (const key of allowed) {
    if (key in b) {
      sets.push(`${key} = $${idx++}`);
      vals.push(key === 'products' ? JSON.stringify(b[key]) : b[key]);
    }
  }
  if (!sets.length) return Response.json({ error: 'No valid fields' }, { status: 400 });
  vals.push(id);

  const pool = getPool();
  const client = await pool.connect();
  try {
    const result = await client.query(
      `UPDATE fa_recommendation SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
      vals
    );
    if (!result.rows[0]) return Response.json({ error: 'Not found' }, { status: 404 });
    return Response.json({ recommendation: result.rows[0] });
  } finally {
    client.release();
  }
}
