import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL not configured.' }, { status: 503 });

  const { id } = await params;
  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return Response.json({ error: 'Body required.' }, { status: 400 });

  const fields = ['company_name','website','industry','founded_year','hq_location',
    'employee_range','revenue_range','market_position','strengths','weaknesses',
    'key_products','pricing_model','target_audience','threat_level','notes'];

  const sets: string[] = [];
  const vals: unknown[] = [id];
  fields.forEach(f => {
    if (body[f] !== undefined) {
      sets.push(`${f} = $${vals.length + 1}`);
      vals.push(body[f]);
    }
  });
  if (body.social_presence !== undefined) {
    sets.push(`social_presence = $${vals.length + 1}`);
    vals.push(JSON.stringify(body.social_presence));
  }

  if (sets.length === 0) return Response.json({ error: 'No fields to update.' }, { status: 400 });
  await query(`UPDATE market_competitor SET ${sets.join(', ')} WHERE id = $1`, vals);
  return Response.json({ ok: true });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL not configured.' }, { status: 503 });

  const { id } = await params;
  await query(`DELETE FROM market_competitor WHERE id = $1`, [id]);
  return Response.json({ ok: true });
}
