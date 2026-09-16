export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { query, databaseConfigured } from '@/lib/postgres';

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL not configured' }, { status: 503 });

  try {
    const result = await query(`SELECT * FROM ai_operating_model ORDER BY dimension`);
    return Response.json({ dimensions: result.rows });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : 'Internal error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL not configured' }, { status: 503 });

  try {
    const body = await req.json() as {
      dimension: string;
      current_state?: string;
      target_state?: string;
      gap?: string;
      actions?: string[];
      owner?: string;
      maturity_level?: number;
    };

    if (!body.dimension?.trim()) {
      return Response.json({ error: 'dimension is required' }, { status: 400 });
    }

    const result = await query(
      `INSERT INTO ai_operating_model
        (dimension, current_state, target_state, gap, actions, owner, maturity_level)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       RETURNING *`,
      [
        body.dimension.trim(),
        body.current_state ?? null,
        body.target_state ?? null,
        body.gap ?? null,
        body.actions ?? [],
        body.owner ?? null,
        body.maturity_level ?? 1,
      ]
    );

    return Response.json({ dimension: result.rows[0] }, { status: 201 });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : 'Internal error' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL not configured' }, { status: 503 });

  try {
    const body = await req.json() as {
      id: string;
      current_state?: string;
      target_state?: string;
      gap?: string;
      actions?: string[];
      owner?: string;
      maturity_level?: number;
    };

    if (!body.id) return Response.json({ error: 'id is required' }, { status: 400 });

    const allowed = ['current_state','target_state','gap','actions','owner','maturity_level'];
    const sets: string[] = [];
    const vals: unknown[] = [];
    let idx = 1;

    for (const key of allowed) {
      if (key in body) {
        sets.push(`${key} = $${idx++}`);
        vals.push((body as Record<string, unknown>)[key]);
      }
    }

    if (sets.length === 0) return Response.json({ error: 'No valid fields to update' }, { status: 400 });

    vals.push(body.id);
    const result = await query(
      `UPDATE ai_operating_model SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
      vals
    );

    if (result.rowCount === 0) return Response.json({ error: 'Dimension not found' }, { status: 404 });
    return Response.json({ dimension: result.rows[0] });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : 'Internal error' }, { status: 500 });
  }
}
