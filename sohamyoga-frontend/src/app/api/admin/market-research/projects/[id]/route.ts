import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL not configured.' }, { status: 503 });

  const { id } = await params;
  const rows = await query<{
    id: string; name: string; category: string; status: string; owner: string;
    description: string; target_market: string; geography: string; industry: string;
    tags: string; created_at: string; updated_at: string;
  }>(`SELECT * FROM market_research_project WHERE id = $1`, [id]);

  if (!rows.rowCount) return Response.json({ error: 'Project not found.' }, { status: 404 });
  const r = rows.rows[0];
  return Response.json({
    project: {
      id: Number(r.id), name: r.name, category: r.category, status: r.status,
      owner: r.owner, description: r.description, targetMarket: r.target_market,
      geography: r.geography, industry: r.industry, tags: r.tags,
      createdAt: r.created_at, updatedAt: r.updated_at,
    },
  });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL not configured.' }, { status: 503 });

  const { id } = await params;
  const body = await req.json().catch(() => null) as {
    name?: string; category?: string; status?: string; description?: string;
    target_market?: string; geography?: string; industry?: string; owner?: string; tags?: string;
  } | null;
  if (!body) return Response.json({ error: 'Body required.' }, { status: 400 });

  await query(
    `UPDATE market_research_project
     SET name = COALESCE($2, name),
         category = COALESCE($3, category),
         status = COALESCE($4, status),
         description = COALESCE($5, description),
         target_market = COALESCE($6, target_market),
         geography = COALESCE($7, geography),
         industry = COALESCE($8, industry),
         owner = COALESCE($9, owner),
         tags = COALESCE($10, tags),
         updated_at = NOW()
     WHERE id = $1`,
    [id, body.name, body.category, body.status, body.description,
     body.target_market, body.geography, body.industry, body.owner, body.tags],
  );
  return Response.json({ ok: true });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL not configured.' }, { status: 503 });

  const { id } = await params;
  await query(`DELETE FROM market_research_project WHERE id = $1`, [id]);
  return Response.json({ ok: true });
}
