import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { getAdminPrincipal } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { denied } = await getAdminPrincipal(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const { id } = await params;
  const body = await req.json();
  const { name, ageRange, goals, painPoints, preferredChannels, notes, isDefault } = body;

  const result = await query(
    `UPDATE customer_persona
     SET name = COALESCE($2, name), age_range = COALESCE($3, age_range),
         goals = COALESCE($4, goals), pain_points = COALESCE($5, pain_points),
         preferred_channels = COALESCE($6, preferred_channels), notes = COALESCE($7, notes),
         is_default = COALESCE($8, is_default), updated_at = now()
     WHERE id = $1 RETURNING id`,
    [id, name ?? null, ageRange ?? null, goals ?? null, painPoints ?? null, preferredChannels ?? null, notes ?? null, isDefault ?? null],
  );
  if (!result.rowCount) return Response.json({ error: 'Persona not found.' }, { status: 404 });
  return Response.json({ ok: true });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { denied } = await getAdminPrincipal(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const { id } = await params;
  const result = await query(`DELETE FROM customer_persona WHERE id = $1`, [id]);
  if (!result.rowCount) return Response.json({ error: 'Persona not found.' }, { status: 404 });
  return Response.json({ ok: true });
}
