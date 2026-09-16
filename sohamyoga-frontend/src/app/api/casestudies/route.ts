export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { pool } from '@/lib/db';
import { requireAdmin } from '@/lib/admin-auth';

export async function GET(): Promise<Response> {
  const client = await pool.connect();
  try {
    const { rows } = await client.query<{
      id: string;
      tenant_id: string;
      title: string;
      narrative: string;
      evidence_ids: string[];
      status: string;
      created_by: string;
      created_at: string;
      updated_at: string;
    }>(
      `SELECT id, tenant_id, title, narrative, evidence_ids, status, created_by, created_at, updated_at
       FROM case_study
       WHERE status = 'published'
       ORDER BY created_at DESC`
    );
    return Response.json(rows);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return Response.json({ error: message }, { status: 500 });
  } finally {
    client.release();
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const client = await pool.connect();
  try {
    const body = await req.json() as {
      tenant_id?: string;
      title: string;
      narrative: string;
      evidence_ids?: string[];
      status?: string;
      created_by?: string;
    };
    const { tenant_id, title, narrative, evidence_ids = [], status = 'draft', created_by } = body;

    const { rows } = await client.query(
      `INSERT INTO case_study (tenant_id, title, narrative, evidence_ids, status, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [tenant_id, title, narrative, evidence_ids, status, created_by]
    );
    return Response.json(rows[0], { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return Response.json({ error: message }, { status: 500 });
  } finally {
    client.release();
  }
}
