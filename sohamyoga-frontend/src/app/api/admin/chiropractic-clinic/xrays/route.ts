import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const pool = getPool();
  const client = await pool.connect();
  try {
    const { searchParams } = new URL(req.url);
    const patient_id = searchParams.get('patient_id');
    const params: unknown[] = [];
    const where = patient_id ? (params.push(parseInt(patient_id)), `WHERE x.patient_id=$1`) : '';
    const { rows } = await client.query(
      `SELECT x.*, p.first_name, p.last_name FROM chiro_xray x
       JOIN chiro_patient p ON p.id=x.patient_id ${where} ORDER BY x.xray_date DESC`, params
    );
    return Response.json(rows);
  } finally {
    client.release();
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const pool = getPool();
  const client = await pool.connect();
  try {
    const b = await req.json();
    const { rows } = await client.query(
      `INSERT INTO chiro_xray (patient_id,chiropractor,xray_date,views_taken,findings,subluxations,recommendations,image_url)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [b.patient_id,b.chiropractor||null,b.xray_date||null,b.views_taken||null,
       b.findings||null,b.subluxations||null,b.recommendations||null,b.image_url||null]
    );
    return Response.json(rows[0], { status: 201 });
  } finally {
    client.release();
  }
}
