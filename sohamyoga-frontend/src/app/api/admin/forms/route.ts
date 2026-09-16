import { NextRequest } from 'next/server';
import { requireAdmin, getAdminPrincipal } from '@/lib/admin-auth';
import { databaseConfigured, query } from '@/lib/postgres';
import { getPrimaryTenantId } from '@/domain/ingestion/Connector';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const VALID_STATUSES = ['draft', 'active', 'archived'];

export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const tenantId = await getPrimaryTenantId();
  const formId = req.nextUrl.searchParams.get('formId');

  // If formId provided, return submissions for that form
  if (formId) {
    const submissions = await query<{
      id: string; data: unknown; consent_given: boolean; source_page: string | null;
      lead_id: string | null; created_at: string;
    }>(
      `SELECT id, data, consent_given, source_page, lead_id, created_at
       FROM form_submission
       WHERE form_id = $1
       ORDER BY created_at DESC LIMIT 100`,
      [formId],
    );
    return Response.json({ submissions: submissions.rows });
  }

  const [forms, summary] = await Promise.all([
    query<{
      id: string; slug: string; name: string; fields: unknown; consent_required: boolean;
      status: string; submission_count: number; created_by: string; created_at: string; updated_at: string;
      recent_submissions: string;
    }>(
      `SELECT fd.id, fd.slug, fd.name, fd.fields, fd.consent_required,
              fd.status, fd.submission_count, fd.created_by, fd.created_at, fd.updated_at,
              count(fs.id) FILTER (WHERE fs.created_at >= now() - interval '30 days')::text AS recent_submissions
       FROM form_definition fd
       LEFT JOIN form_submission fs ON fs.form_id = fd.id
       WHERE fd.tenant_id = $1
       GROUP BY fd.id
       ORDER BY fd.updated_at DESC`,
      [tenantId],
    ),
    query<{ total: string; active: string; submissions_30d: string }>(
      `SELECT
         count(DISTINCT fd.id)::text AS total,
         count(DISTINCT fd.id) FILTER (WHERE fd.status = 'active')::text AS active,
         count(fs.id) FILTER (WHERE fs.created_at >= now() - interval '30 days')::text AS submissions_30d
       FROM form_definition fd
       LEFT JOIN form_submission fs ON fs.form_id = fd.id
       WHERE fd.tenant_id = $1`,
      [tenantId],
    ),
  ]);

  // Recent submissions across all forms
  const recentSubmissions = await query<{
    id: string; form_id: string; form_name: string; data: unknown;
    consent_given: boolean; lead_id: string | null; created_at: string;
  }>(
    `SELECT fs.id, fs.form_id, fd.name AS form_name, fs.data, fs.consent_given, fs.lead_id, fs.created_at
     FROM form_submission fs
     JOIN form_definition fd ON fd.id = fs.form_id
     WHERE fd.tenant_id = $1
     ORDER BY fs.created_at DESC LIMIT 20`,
    [tenantId],
  );

  const s = summary.rows[0];
  const total = Number(s?.total ?? 0);
  const active = Number(s?.active ?? 0);
  const submissions30d = Number(s?.submissions_30d ?? 0);
  const conversionRate = total > 0 ? Math.round((submissions30d / Math.max(active, 1)) * 10) / 10 : 0;

  return Response.json({
    forms: forms.rows,
    recentSubmissions: recentSubmissions.rows,
    summary: {
      total,
      active,
      submissions30d,
      conversionRate,
    },
  });
}

export async function POST(req: NextRequest) {
  const { principal, denied } = await getAdminPrincipal(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const body = await req.json().catch(() => null) as {
    slug?: string; name?: string; fields?: unknown[]; consentRequired?: boolean; consentText?: string; successMessage?: string;
  } | null;

  if (!body?.slug?.trim()) return Response.json({ error: 'slug is required.' }, { status: 400 });
  if (!body.name?.trim()) return Response.json({ error: 'name is required.' }, { status: 400 });

  const tenantId = await getPrimaryTenantId();
  const result = await query(
    `INSERT INTO form_definition (tenant_id, slug, name, fields, consent_required, consent_text, success_message, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     RETURNING id, slug, name, fields, consent_required, status, submission_count, created_at`,
    [
      tenantId,
      body.slug.trim(),
      body.name.trim(),
      JSON.stringify(body.fields ?? []),
      body.consentRequired ?? true,
      body.consentText ?? 'I agree to be contacted about this inquiry.',
      body.successMessage ?? 'Thank you — we will be in touch shortly.',
      principal!.email ?? principal!.id,
    ],
  );
  return Response.json({ form: result.rows[0] }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const body = await req.json().catch(() => null) as {
    id?: string; status?: string;
  } | null;

  if (!body?.id) return Response.json({ error: 'id is required.' }, { status: 400 });
  if (!body.status || !VALID_STATUSES.includes(body.status)) {
    return Response.json({ error: `status must be one of: ${VALID_STATUSES.join(', ')}` }, { status: 400 });
  }

  const result = await query(
    `UPDATE form_definition SET status = $2, updated_at = now()
     WHERE id = $1
     RETURNING id, slug, name, status, updated_at`,
    [body.id, body.status],
  );
  if (!result.rowCount) return Response.json({ error: 'Form not found.' }, { status: 404 });
  return Response.json({ form: result.rows[0] });
}
