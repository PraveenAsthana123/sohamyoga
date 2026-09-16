import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool, databaseConfigured } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'Database unavailable.' }, { status: 503 });

  const { id } = await params;
  const result = await getPool().query(`SELECT * FROM design_briefs WHERE id = $1`, [id]);
  if (!result.rowCount) return Response.json({ error: 'Not found.' }, { status: 404 });
  return Response.json({ brief: result.rows[0] });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'Database unavailable.' }, { status: 503 });

  const { id } = await params;
  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return Response.json({ error: 'Invalid request.' }, { status: 400 });

  const result = await getPool().query(
    `UPDATE design_briefs SET
      title = COALESCE($2, title),
      project_type = COALESCE($3, project_type),
      brand_name = COALESCE($4, brand_name),
      target_audience = COALESCE($5, target_audience),
      key_message = COALESCE($6, key_message),
      mood_tone = COALESCE($7, mood_tone),
      color_palette = COALESCE($8, color_palette),
      fonts_preferred = COALESCE($9, fonts_preferred),
      dimensions = COALESCE($10, dimensions),
      platform = COALESCE($11, platform),
      examples_urls = COALESCE($12, examples_urls),
      deliverables = COALESCE($13, deliverables),
      deadline = COALESCE($14::DATE, deadline),
      budget_cad = COALESCE($15, budget_cad),
      status = COALESCE($16, status),
      assigned_to = COALESCE($17, assigned_to),
      canva_template_url = COALESCE($18, canva_template_url),
      output_url = COALESCE($19, output_url),
      notes = COALESCE($20, notes),
      ai_brief = COALESCE($21, ai_brief)
    WHERE id = $1
    RETURNING *`,
    [
      id,
      body.title ?? null,
      body.project_type ?? null,
      body.brand_name ?? null,
      body.target_audience ?? null,
      body.key_message ?? null,
      body.mood_tone ?? null,
      body.color_palette ?? null,
      body.fonts_preferred ?? null,
      body.dimensions ?? null,
      body.platform ?? null,
      body.examples_urls ?? null,
      body.deliverables ?? null,
      body.deadline ?? null,
      body.budget_cad ?? null,
      body.status ?? null,
      body.assigned_to ?? null,
      body.canva_template_url ?? null,
      body.output_url ?? null,
      body.notes ?? null,
      body.ai_brief ?? null,
    ]
  );

  if (!result.rowCount) return Response.json({ error: 'Not found.' }, { status: 404 });
  return Response.json({ ok: true, brief: result.rows[0] });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'Database unavailable.' }, { status: 503 });

  const { id } = await params;
  const result = await getPool().query(`DELETE FROM design_briefs WHERE id = $1 RETURNING id`, [id]);
  if (!result.rowCount) return Response.json({ error: 'Not found.' }, { status: 404 });
  return Response.json({ ok: true });
}
