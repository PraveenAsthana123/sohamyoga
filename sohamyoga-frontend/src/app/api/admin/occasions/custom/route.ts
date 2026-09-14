import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { getAdminPrincipal } from '@/lib/admin-auth';
import { getPrimaryTenantId } from '@/domain/ingestion/Connector';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// A real, admin-typed one-off wish card to one real student -- never a
// template, never LLM-composed. Enqueues into the real notification_queue
// so it flows through the same real dispatch machinery as the automated
// scan (push/in_app genuinely deliver; email/sms/whatsapp honestly
// attempt Novu and may fail if it isn't configured/running -- same
// disclosed boundary as every other notification in this codebase).
export async function POST(req: NextRequest) {
  const { principal, denied } = await getAdminPrincipal(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const body = await req.json().catch(() => null) as {
    studentId?: string; channel?: 'email' | 'sms' | 'whatsapp' | 'push' | 'in_app'; title?: string; message?: string;
  } | null;

  if (!body?.studentId) return Response.json({ error: 'studentId is required.' }, { status: 400 });
  if (!body.channel || !['email', 'sms', 'whatsapp', 'push', 'in_app'].includes(body.channel)) {
    return Response.json({ error: "channel must be 'email', 'sms', 'whatsapp', 'push', or 'in_app'." }, { status: 400 });
  }
  if (!body.title?.trim() || !body.message?.trim()) {
    return Response.json({ error: 'title and message are required.' }, { status: 400 });
  }

  const tenantId = await getPrimaryTenantId();
  const student = await query<{ id: string; tenant_id: string; user_id: string; email: string }>(
    `SELECT id, tenant_id, user_id, email FROM student WHERE id = $1 AND tenant_id = $2`,
    [body.studentId, tenantId],
  );
  if (!student.rowCount) return Response.json({ error: 'Student not found.' }, { status: 404 });
  const s = student.rows[0];

  const wish = await query<{ id: string }>(
    `INSERT INTO wish_card (tenant_id, student_id, occasion, title, message, style, channel, status, created_by)
     VALUES ($1,$2,'custom',$3,$4,'simple',$5,'PENDING',$6)
     RETURNING id`,
    [s.tenant_id, s.id, body.title, body.message, body.channel, principal?.id ?? null],
  );
  const wishCardId = wish.rows[0].id;

  // 'custom_wish_card' (push-channel) is seeded once at deploy time
  // (scripts/seed-occasion-templates-and-calendar.ts) -- the real
  // NotificationDispatchJob only reads notification_template locally for
  // the push channel; for email/sms/whatsapp it forwards template_slug
  // to Novu as a workflow name (Novu-side registration, out of scope
  // here, same disclosed boundary as every other non-push notification).
  const queueRes = await query<{ id: string }>(
    `INSERT INTO notification_queue (tenant_id, template_slug, channel, type, recipient_user_id, recipient_address, payload, idempotency_key)
     VALUES ($1,'custom_wish_card',$2,'marketing',$3,$4,$5,$6)
     RETURNING id`,
    [s.tenant_id, body.channel, s.user_id, s.email, JSON.stringify({ title: body.title, body: body.message }), `wishcard_${wishCardId}`],
  );
  await query(`UPDATE wish_card SET notification_queue_id = $1 WHERE id = $2`, [queueRes.rows[0].id, wishCardId]);

  return Response.json({ id: wishCardId, notificationQueueId: queueRes.rows[0].id }, { status: 201 });
}
