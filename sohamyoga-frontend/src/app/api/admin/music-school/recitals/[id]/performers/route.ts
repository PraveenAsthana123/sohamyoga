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
      `SELECT p.*,s.first_name,s.last_name,s.instrument
       FROM ms_recital_performer p
       LEFT JOIN ms_student s ON s.id=p.student_id
       WHERE p.recital_id=$1 ORDER BY p.performance_order`,
      [params.id]
    );
    return Response.json({ performers: r.rows });
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
      `INSERT INTO ms_recital_performer (recital_id,student_id,piece_title,composer,performance_order,duration_minutes,confirmed)
       VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [params.id,body.student_id,body.piece_title,body.composer,body.performance_order,body.duration_minutes||3,body.confirmed||false]
    );
    return Response.json({ performer: r.rows[0] }, { status: 201 });
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
    // Update performance_order for a specific performer
    const r = await client.query(
      `UPDATE ms_recital_performer SET performance_order=$1,confirmed=$2
       WHERE id=$3 AND recital_id=$4 RETURNING *`,
      [body.performance_order, body.confirmed ?? false, body.performer_id, params.id]
    );
    return Response.json({ performer: r.rows[0] });
  } finally {
    client.release();
  }
}
