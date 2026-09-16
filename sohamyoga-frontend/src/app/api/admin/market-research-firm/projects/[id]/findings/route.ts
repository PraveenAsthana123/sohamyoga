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
      `SELECT * FROM mr_finding WHERE project_id=$1 ORDER BY priority, created_at DESC`,
      [params.id]
    );
    return Response.json(rows);
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
    const { rows } = await client.query(
      `INSERT INTO mr_finding (project_id, finding_type, finding_title, finding_description, supporting_data, confidence_level, priority, category, tags)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [params.id, body.finding_type, body.finding_title, body.finding_description,
       body.supporting_data, body.confidence_level || 'high', body.priority || 'medium',
       body.category, body.tags || []]
    );
    return Response.json(rows[0], { status: 201 });
  } finally {
    client.release();
  }
}
