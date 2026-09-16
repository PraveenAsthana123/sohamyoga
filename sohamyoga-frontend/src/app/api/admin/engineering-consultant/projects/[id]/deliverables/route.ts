import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool, databaseConfigured } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'Database unavailable.' }, { status: 503 });
  const pool = getPool();
  const client = await pool.connect();
  try {
    const { rows } = await client.query(`SELECT * FROM engineering_deliverable WHERE project_id=$1 ORDER BY due_date`, [params.id]);
    return Response.json({ deliverables: rows });
  } finally {
    client.release();
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'Database unavailable.' }, { status: 503 });
  const body = await req.json().catch(() => null);
  if (!body?.title) return Response.json({ error: 'title is required.' }, { status: 400 });
  const pool = getPool();
  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      `INSERT INTO engineering_deliverable (project_id, title, deliverable_type, due_date, revision_number, notes) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [params.id, body.title, body.deliverable_type, body.due_date, body.revision_number ?? 'A', body.notes]
    );
    return Response.json({ deliverable: rows[0] }, { status: 201 });
  } finally {
    client.release();
  }
}
