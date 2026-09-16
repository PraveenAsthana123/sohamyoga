export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { query, databaseConfigured } from '@/lib/postgres';

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL not configured' }, { status: 503 });

  try {
    const { id } = params;
    const body = await req.json() as Record<string, unknown>;

    const allowed = ['initiative_name','phase','priority','status','owner','start_date','end_date',
      'business_value','ai_capability','data_required','model_type','deployment',
      'estimated_roi_pct','risk_level','dependencies','success_metrics','notes'];

    const sets: string[] = [];
    const vals: unknown[] = [];
    let idx = 1;

    for (const key of allowed) {
      if (key in body) {
        sets.push(`${key} = $${idx++}`);
        vals.push(body[key]);
      }
    }

    if (sets.length === 0) {
      return Response.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    vals.push(id);
    const result = await query(
      `UPDATE ai_transformation_roadmap SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
      vals
    );

    if (result.rowCount === 0) {
      return Response.json({ error: 'Initiative not found' }, { status: 404 });
    }

    return Response.json({ initiative: result.rows[0] });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : 'Internal error' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL not configured' }, { status: 503 });

  try {
    const { id } = params;
    const result = await query(`DELETE FROM ai_transformation_roadmap WHERE id = $1 RETURNING id`, [id]);
    if (result.rowCount === 0) return Response.json({ error: 'Initiative not found' }, { status: 404 });
    return Response.json({ deleted: true, id });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : 'Internal error' }, { status: 500 });
  }
}
