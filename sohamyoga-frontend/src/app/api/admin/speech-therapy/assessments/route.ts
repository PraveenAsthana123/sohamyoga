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
    const client_id = searchParams.get('client_id');
    const params: unknown[] = [];
    const where = client_id ? (params.push(parseInt(client_id)), `WHERE a.client_id=$1`) : '';
    const { rows } = await client.query(
      `SELECT a.*, c.first_name, c.last_name FROM st_assessment a
       JOIN st_client c ON c.id=a.client_id ${where} ORDER BY a.assessment_date DESC`, params
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
      `INSERT INTO st_assessment (client_id,slp,assessment_date,assessment_tools,areas_assessed,standardized_scores,clinical_impressions,recommendations)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [b.client_id,b.slp||null,b.assessment_date||null,b.assessment_tools||null,
       b.areas_assessed||null,b.standardized_scores?JSON.stringify(b.standardized_scores):null,
       b.clinical_impressions||null,b.recommendations||null]
    );
    return Response.json(rows[0], { status: 201 });
  } finally {
    client.release();
  }
}
