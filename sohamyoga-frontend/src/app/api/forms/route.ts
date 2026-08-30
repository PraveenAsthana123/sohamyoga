import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { requireAdmin, getAdminPrincipal } from '@/lib/admin-auth';
import { getPrimaryTenantId } from '@/domain/ingestion/Connector';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface FormField { key: string; label: string; type: 'text' | 'email' | 'phone' | 'textarea'; required: boolean }

export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const tenantId = await getPrimaryTenantId();
  const rows = await query(
    `SELECT id, slug, name, fields, consent_required, status::text, submission_count, created_at
     FROM form_definition WHERE tenant_id = $1 ORDER BY created_at DESC`,
    [tenantId],
  );
  return Response.json({
    forms: rows.rows.map(r => ({
      id: r.id, slug: r.slug, name: r.name, fields: r.fields, consentRequired: r.consent_required,
      status: r.status, submissionCount: r.submission_count, createdAt: r.created_at,
    })),
  });
}

export async function POST(req: NextRequest) {
  const { principal, denied } = await getAdminPrincipal(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const body = await req.json().catch(() => null) as { slug?: string; name?: string; fields?: FormField[]; consentRequired?: boolean } | null;
  if (!body?.slug || !body.name || !body.fields?.length) {
    return Response.json({ error: 'slug, name, and at least one field are required.' }, { status: 400 });
  }
  if (!/^[a-z0-9-]+$/.test(body.slug)) return Response.json({ error: 'slug must be lowercase letters, numbers, and hyphens.' }, { status: 400 });
  for (const f of body.fields) {
    if (!f.key || !f.label || !f.type) return Response.json({ error: 'Every field needs key, label, and type.' }, { status: 400 });
  }

  const tenantId = await getPrimaryTenantId();
  try {
    const result = await query<{ id: string }>(
      `INSERT INTO form_definition (tenant_id, slug, name, fields, consent_required, created_by)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
      [tenantId, body.slug, body.name, JSON.stringify(body.fields), body.consentRequired ?? true, principal!.id],
    );
    return Response.json({ ok: true, id: result.rows[0].id }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const status = message.includes('duplicate key') ? 409 : 502;
    return Response.json({ error: status === 409 ? 'A form with this slug already exists.' : message }, { status });
  }
}
