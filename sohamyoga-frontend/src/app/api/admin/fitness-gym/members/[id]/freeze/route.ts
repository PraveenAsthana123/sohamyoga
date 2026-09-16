import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    const body = await req.json().catch(() => ({}));
    const pool = getPool();
    const client = await pool.connect();
    try {
      const { rows: cur } = await client.query(`SELECT membership_status, expiry_date FROM gym_member WHERE id=$1`, [params.id]);
      if (!cur[0]) return Response.json({ error: 'Not found' }, { status: 404 });
      const currentStatus = cur[0].membership_status;
      const newStatus = currentStatus === 'frozen' ? 'active' : 'frozen';
      const expiry_date = body.expiry_date ?? cur[0].expiry_date;
      const { rows } = await client.query(
        `UPDATE gym_member SET membership_status=$1, expiry_date=$2 WHERE id=$3 RETURNING id, membership_status, expiry_date`,
        [newStatus, expiry_date, params.id]
      );
      return Response.json({ member: rows[0], action: newStatus === 'frozen' ? 'frozen' : 'unfrozen' });
    } finally {
      client.release();
    }
  } catch (e: unknown) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
