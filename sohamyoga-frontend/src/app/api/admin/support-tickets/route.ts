import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { getAdminPrincipal } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const STATUSES = ['open', 'in_progress', 'pending_customer', 'resolved', 'closed'];
const PRIORITIES = ['low', 'medium', 'high', 'urgent'];

// Real admin/CRM inbox for support_ticket -- previously zero admin surface
// existed anywhere (found live during the 2026-09-01 admin-panel gap
// audit), so a ticket a customer filed went into a void no staff could see.
export async function GET(req: NextRequest) {
  const denied = (await getAdminPrincipal(req)).denied;
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const tickets = await query(
    `SELECT st.id, st.customer_id, c.display_name AS customer_name, c.email AS customer_email,
            st.subject, st.category, st.priority, st.status, st.first_response_at, st.resolved_at, st.csat_score, st.created_at
     FROM support_ticket st JOIN customer c ON c.id = st.customer_id
     ORDER BY (st.status IN ('open','in_progress','pending_customer')) DESC,
              CASE st.priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
              st.created_at DESC LIMIT 500`,
  );
  return Response.json({ tickets: tickets.rows });
}

export async function PATCH(req: NextRequest) {
  const denied = (await getAdminPrincipal(req)).denied;
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const body = await req.json().catch(() => null) as { id?: string; status?: string; priority?: string } | null;
  if (!body?.id) return Response.json({ error: 'id is required.' }, { status: 400 });
  if (body.status && !STATUSES.includes(body.status)) return Response.json({ error: `status must be one of ${STATUSES.join('|')}.` }, { status: 400 });
  if (body.priority && !PRIORITIES.includes(body.priority)) return Response.json({ error: `priority must be one of ${PRIORITIES.join('|')}.` }, { status: 400 });

  const isResolving = body.status === 'resolved' || body.status === 'closed';
  const result = await query(
    `UPDATE support_ticket SET
       status = COALESCE($1, status), priority = COALESCE($2, priority),
       first_response_at = COALESCE(first_response_at, CASE WHEN $1 IS NOT NULL THEN now() END),
       resolved_at = CASE WHEN $3 THEN now() ELSE resolved_at END,
       updated_at = now()
     WHERE id = $4 RETURNING *`,
    [body.status || null, body.priority || null, isResolving, body.id],
  );
  if (!result.rowCount) return Response.json({ error: 'Ticket not found.' }, { status: 404 });
  return Response.json({ ticket: result.rows[0] });
}
