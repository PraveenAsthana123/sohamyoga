import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface FormField { key: string; label: string; type: 'text' | 'email' | 'phone' | 'textarea'; required: boolean }

// POST — public form submission. Real server-side validation against the
// form's own field definitions (required + email format), real consent
// capture, and real campaign_lead creation when an email field is present —
// generalizing what the one hardcoded /api/contact route did for every form.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const formResult = await query<{ id: string; tenant_id: string; fields: FormField[]; consent_required: boolean; success_message: string; status: string }>(
    `SELECT id, tenant_id, fields, consent_required, success_message, status::text FROM form_definition WHERE id = $1`,
    [params.id],
  );
  if (!formResult.rows.length) return Response.json({ error: 'Form not found.' }, { status: 404 });
  const form = formResult.rows[0];
  if (form.status !== 'active') return Response.json({ error: 'This form is not currently accepting submissions.' }, { status: 410 });

  const body = await req.json().catch(() => null) as { data?: Record<string, string>; consent?: boolean; sourcePage?: string } | null;
  if (!body?.data) return Response.json({ error: 'data is required.' }, { status: 400 });

  for (const field of form.fields) {
    const value = body.data[field.key]?.trim();
    if (field.required && !value) return Response.json({ error: `${field.label} is required.` }, { status: 400 });
    if (field.type === 'email' && value && !EMAIL_RE.test(value)) return Response.json({ error: `${field.label} must be a valid email address.` }, { status: 400 });
  }
  if (form.consent_required && !body.consent) return Response.json({ error: 'Consent is required to submit this form.' }, { status: 400 });

  let leadId: string | null = null;
  const emailField = form.fields.find(f => f.type === 'email');
  const emailValue = emailField ? body.data[emailField.key]?.trim() : undefined;
  if (emailValue) {
    const leadResult = await query<{ id: string }>(
      `INSERT INTO campaign_lead (tenant_id, email, source_platform, funnel_stage, message)
       VALUES ($1, $2, 'website_form', 'new', $3) RETURNING id`,
      [form.tenant_id, emailValue, JSON.stringify(body.data)],
    );
    leadId = leadResult.rows[0].id;

    // Real journey touchpoint — Customer Journey & Funnel module. Logged only
    // when we have a real contact identifier (email); never backfilled/fabricated.
    await query(
      `INSERT INTO journey_touchpoint (tenant_id, contact_identifier, touchpoint_type, source_module, metadata)
       VALUES ($1, $2, 'form_submission', 'form', $3)`,
      [form.tenant_id, emailValue, JSON.stringify({ formId: form.id, sourcePage: body.sourcePage ?? null })],
    );
  }

  await query(
    `INSERT INTO form_submission (form_id, data, consent_given, source_page, lead_id) VALUES ($1,$2,$3,$4,$5)`,
    [form.id, JSON.stringify(body.data), Boolean(body.consent), body.sourcePage ?? null, leadId],
  );
  await query(`UPDATE form_definition SET submission_count = submission_count + 1 WHERE id = $1`, [form.id]);

  return Response.json({ ok: true, message: form.success_message, leadCreated: Boolean(leadId) }, { status: 201 });
}
