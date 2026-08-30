import { NextRequest } from 'next/server';
import { query } from '../../../../lib/postgres';
import { withApiErrorLog } from '../../../../lib/api-error-log';

// Deliberately unauthenticated — this is the real endpoint a public-facing
// form submits to via marketing_form_link.slug. Previously marketing_form_link
// only tracked click/submission *counts*; no actual submitted data was ever
// captured anywhere, so "form → lead" was a broken loop despite the link
// tracking looking complete.
async function handlePost(req: NextRequest) {
  const body = await req.json().catch(() => null) as { slug?: string; name?: string; email?: string; phone?: string; message?: string } | null;
  if (!body?.slug || (!body.email && !body.phone)) {
    return Response.json({ error: 'slug and (email or phone) are required.' }, { status: 400 });
  }
  const form = await query<{ id: string; workspace_id: string; campaign_id: string | null; status: string }>(
    `SELECT id, workspace_id, campaign_id, status FROM marketing_form_link WHERE slug = $1`,
    [body.slug],
  );
  if (!form.rowCount) return Response.json({ error: 'Unknown form.' }, { status: 404 });
  if (form.rows[0].status !== 'active') return Response.json({ error: 'This form is no longer accepting submissions.' }, { status: 410 });

  const [lead] = await Promise.all([
    query(
      `INSERT INTO lead (workspace_id, campaign_id, form_link_id, name, email, phone, message, source) VALUES ($1,$2,$3,$4,$5,$6,$7,'form') RETURNING *`,
      [form.rows[0].workspace_id, form.rows[0].campaign_id, form.rows[0].id, body.name || null, body.email || null, body.phone || null, body.message || null],
    ),
    query(`UPDATE marketing_form_link SET submissions = submissions + 1 WHERE id = $1`, [form.rows[0].id]),
  ]);

  return Response.json({ ok: true, leadId: lead.rows[0].id }, { status: 201 });
}

export const POST = withApiErrorLog(handlePost);
