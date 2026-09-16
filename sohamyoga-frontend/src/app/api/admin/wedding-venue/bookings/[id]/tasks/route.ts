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
    const r = await client.query(
      `SELECT * FROM wv_planning_task WHERE booking_id=$1 ORDER BY due_date NULLS LAST`,
      [params.id]
    );
    return Response.json({ tasks: r.rows });
  } finally {
    client.release();
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const body = await req.json();
  const pool = getPool();
  const client = await pool.connect();
  try {
    const r = await client.query(
      `INSERT INTO wv_planning_task (booking_id,task_category,task_name,due_date,assigned_to,priority,notes)
       VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [params.id,body.task_category||null,body.task_name,body.due_date||null,
       body.assigned_to||null,body.priority||'medium',body.notes||null]
    );
    return Response.json({ task: r.rows[0] }, { status: 201 });
  } finally {
    client.release();
  }
}
