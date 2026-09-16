import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { query } from '@/lib/postgres';
import { getPrimaryTenantId } from '@/domain/ingestion/Connector';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const result = await query(`SELECT * FROM email_template ORDER BY created_at DESC LIMIT 500`);
  return Response.json({ templates: result.rows });
}

export async function POST(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const body = await req.json().catch(() => null) as Record<string, any> | null;
  if (!body?.name || !body?.subject) {
    return Response.json({ error: 'name and subject are required' }, { status: 400 });
  }

  const tenantId = await getPrimaryTenantId();
  const result = await query(
    `INSERT INTO email_template (tenant_id, name, subject, body, type) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [tenantId, body.name, body.subject, body.body ?? '', body.type ?? 'marketing'],
  );
  return Response.json({ template: result.rows[0] }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const body = await req.json().catch(() => null) as Record<string, any> | null;
  if (!body?.id) return Response.json({ error: 'id is required' }, { status: 400 });

  const result = await query(
    `UPDATE email_template SET name=$2, subject=$3, body=$4, type=$5, updated_at=now() WHERE id=$1 RETURNING *`,
    [body.id, body.name, body.subject, body.body ?? '', body.type ?? 'marketing'],
  );
  if (!result.rowCount) return Response.json({ error: 'template not found' }, { status: 404 });
  return Response.json({ template: result.rows[0] });
}

export async function DELETE(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return Response.json({ error: 'id is required' }, { status: 400 });

  await query(`DELETE FROM email_template WHERE id=$1`, [id]);
  return Response.json({ ok: true });
}
