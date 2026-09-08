import { NextRequest } from 'next/server';
import { getAdminPrincipal } from '@/lib/admin-auth';
import { query } from '@/lib/postgres';
import { getPrimaryTenantId } from '@/domain/ingestion/Connector';

const STATUSES = new Set(['open','waiting_customer','waiting_agent','resolved','blocked','spam']);
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { principal, denied } = await getAdminPrincipal(req); if (denied) return denied;
  if (!principal?.roles.includes('Admin')) return Response.json({ error: 'Administrator access is required.' }, { status: 403 });
  const body = await req.json().catch(() => null) as { status?: string; assignedTo?: string | null } | null;
  if (!body?.status || !STATUSES.has(body.status)) return Response.json({ error: 'A valid status is required.' }, { status: 400 });
  const tenantId = await getPrimaryTenantId();
  const updated = await query(`UPDATE customer_channel_thread SET status=$1,assigned_to=$2,updated_at=now()
    WHERE id=$3 AND tenant_id=$4 RETURNING id`, [body.status, body.assignedTo || null, params.id, tenantId]);
  if (!updated.rowCount) return Response.json({ error: 'Thread not found.' }, { status: 404 });
  await query(`INSERT INTO customer_channel_event (tenant_id,thread_id,platform_key,external_event_id,direction,event_type,text_excerpt,occurred_at,metadata)
    SELECT tenant_id,id,platform_key,$1,'system','notification_sent',$2,now(),$3::jsonb FROM customer_channel_thread WHERE id=$4`,
    [`status:${params.id}:${Date.now()}`, `Thread status changed to ${body.status}`, JSON.stringify({ actorId: principal!.id, action: 'status_change' }), params.id]);
  return Response.json({ ok: true });
}
