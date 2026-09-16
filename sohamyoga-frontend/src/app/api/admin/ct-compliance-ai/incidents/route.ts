export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool, databaseConfigured } from '@/lib/postgres';

export async function GET(req: NextRequest): Promise<Response> {
  if (!databaseConfigured()) return Response.json({ error: 'DB not configured' }, { status: 503 });
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const pool = getPool();
  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      'SELECT * FROM compliance_ai_incidents ORDER BY detected_at DESC'
    ).catch(() => ({ rows: [] }));
    return Response.json({ incidents: rows });
  } finally {
    client.release();
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  if (!databaseConfigured()) return Response.json({ error: 'DB not configured' }, { status: 503 });
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const pool = getPool();
  const client = await pool.connect();
  try {
    const { regulation, description, severity = 'medium', remediation } = await req.json().catch(() => ({}));
    if (!regulation || !description) return Response.json({ error: 'regulation and description required' }, { status: 400 });

    const { rows } = await client.query(
      `INSERT INTO compliance_ai_incidents (regulation, description, severity, remediation)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [regulation, description, severity, remediation ?? null]
    );
    return Response.json({ incident: rows[0] }, { status: 201 });
  } finally {
    client.release();
  }
}
