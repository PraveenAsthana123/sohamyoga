import { NextRequest } from 'next/server';
import { query } from '../../../../lib/postgres';
import { withApiErrorLog } from '../../../../lib/api-error-log';
import { clientIp, isRateLimited } from '../../../../lib/rate-limit';
import { scoreLead } from '../../../../domain/pipeline/LeadScoring';

// Deliberately unauthenticated — this is the real endpoint a public-facing
// form submits to via marketing_form_link.slug. Previously marketing_form_link
// only tracked click/submission *counts*; no actual submitted data was ever
// captured anywhere, so "form → lead" was a broken loop despite the link
// tracking looking complete.
//
// Rate-limited: this is the one unauthenticated write path in the app, and
// was flagged in an earlier adversarial review as missing rate limiting.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
async function handlePost(req: NextRequest) {
  if (isRateLimited(`leads-capture:${clientIp(req)}`, 5, 60_000)) {
    return Response.json({ error: 'Too many submissions. Please try again in a minute.' }, { status: 429 });
  }
  const body = await req.json().catch(() => null) as { slug?: string; name?: string; email?: string; phone?: string; message?: string; serviceItemId?: string } | null;
  if (!body?.slug || (!body.email && !body.phone)) {
    return Response.json({ error: 'slug and (email or phone) are required.' }, { status: 400 });
  }
  if (body.email && !EMAIL_RE.test(body.email)) {
    return Response.json({ error: 'A valid email address is required.' }, { status: 400 });
  }
  if (body.message && body.message.length > 5000) {
    return Response.json({ error: 'message exceeds 5000 characters.' }, { status: 400 });
  }
  const form = await query<{ id: string; workspace_id: string; campaign_id: string | null; status: string }>(
    `SELECT id, workspace_id, campaign_id, status FROM marketing_form_link WHERE slug = $1`,
    [body.slug],
  );
  if (!form.rowCount) return Response.json({ error: 'Unknown form.' }, { status: 404 });
  if (form.rows[0].status !== 'active') return Response.json({ error: 'This form is no longer accepting submissions.' }, { status: 410 });

  let serviceItemId: string | null = null;
  if (body.serviceItemId) {
    const item = await query<{ id: string }>(`SELECT id FROM service_catalog_item WHERE id = $1 AND workspace_id = $2 AND status = 'published'`, [body.serviceItemId, form.rows[0].workspace_id]);
    if (!item.rowCount) return Response.json({ error: 'Unknown or unpublished service.' }, { status: 400 });
    serviceItemId = item.rows[0].id;
  }

  const { score } = scoreLead({ phone: body.phone || null, email: body.email || null, message: body.message || null, source: 'form', campaign_id: form.rows[0].campaign_id, service_item_id: serviceItemId });

  const [lead] = await Promise.all([
    query(
      `INSERT INTO lead (workspace_id, campaign_id, form_link_id, name, email, phone, message, source, service_item_id, score) VALUES ($1,$2,$3,$4,$5,$6,$7,'form',$8,$9) RETURNING *`,
      [form.rows[0].workspace_id, form.rows[0].campaign_id, form.rows[0].id, body.name || null, body.email || null, body.phone || null, body.message || null, serviceItemId, score],
    ),
    query(`UPDATE marketing_form_link SET submissions = submissions + 1 WHERE id = $1`, [form.rows[0].id]),
  ]);

  return Response.json({ ok: true, leadId: lead.rows[0].id }, { status: 201 });
}

export const POST = withApiErrorLog(handlePost);
