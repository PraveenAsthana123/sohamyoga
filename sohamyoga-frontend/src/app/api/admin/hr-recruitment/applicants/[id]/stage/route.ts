export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { pool } from '@/lib/db';
import { requireAdmin } from '@/lib/admin-auth';

const STATUS_ORDER = ['new','screening','phone_screen','interview','assessment','offer','hired'];

export async function POST(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const client = await pool.connect();
  try {
    const body = await req.json().catch(() => ({}));

    let newStatus: string;
    if (body.stage) {
      newStatus = body.stage;
    } else {
      // Auto-advance to next stage
      const current = await client.query(`SELECT status FROM hr_applicant WHERE id = $1`, [params.id]);
      if (!current.rows[0]) return Response.json({ error: 'Not found' }, { status: 404 });
      const idx = STATUS_ORDER.indexOf(current.rows[0].status);
      newStatus = STATUS_ORDER[Math.min(idx + 1, STATUS_ORDER.length - 1)];
    }

    const r = await client.query(`
      UPDATE hr_applicant SET status = $1 WHERE id = $2 RETURNING *
    `, [newStatus, params.id]);

    if (!r.rows[0]) return Response.json({ error: 'Not found' }, { status: 404 });
    return Response.json({ applicant: r.rows[0], newStatus });
  } finally {
    client.release();
  }
}
