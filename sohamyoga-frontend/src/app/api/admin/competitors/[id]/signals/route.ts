import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { databaseConfigured, query } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const { id } = await params;

  const result = await query(
    `SELECT * FROM competitor_signal WHERE competitor_id = $1 ORDER BY detected_at DESC`,
    [id],
  );

  return Response.json({ signals: result.rows });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const { id } = await params;

  const body = await req.json() as {
    signal_type?: string;
    title: string;
    description?: string;
    source_url?: string;
    impact?: string;
  };

  if (!body.title) return Response.json({ error: 'title is required' }, { status: 400 });

  const result = await query(
    `INSERT INTO competitor_signal (competitor_id, signal_type, title, description, source_url, impact)
     VALUES ($1,$2,$3,$4,$5,$6)
     RETURNING *`,
    [id, body.signal_type ?? null, body.title, body.description ?? null,
     body.source_url ?? null, body.impact ?? 'low'],
  );

  return Response.json({ signal: result.rows[0] }, { status: 201 });
}
