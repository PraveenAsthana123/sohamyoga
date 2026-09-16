import { NextRequest } from 'next/server';
import { query } from '@/lib/postgres';

import { requireAdmin } from '@/lib/admin-auth';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {

  const denied = await requireAdmin(req);
  if (denied) return denied;
  const { id } = await params;
  const result = await query(`
    SELECT p.*, c.name as campaign_name
    FROM ad_post_plan p
    LEFT JOIN ad_campaign c ON c.id = p.campaign_id
    WHERE p.id = $1
  `, [id]);
  if (!result.rowCount) return Response.json({ error: 'Not found' }, { status: 404 });
  return Response.json({ plan: result.rows[0] });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {

  const denied = await requireAdmin(req);
  if (denied) return denied;
  const { id } = await params;
  const body = await req.json();
  const allowed = [
    'campaign_id','ad_id','topic','ad_message_type','platform','headline','body_copy','cta',
    'visual_url','visual_type','emoji_set','hashtags','scheduled_at','status','approval_status',
    'approved_by','approved_at','rejection_reason'
  ];
  const sets: string[] = [];
  const values: unknown[] = [];
  let idx = 1;
  for (const key of allowed) {
    if (key in body) { sets.push(`${key} = $${idx++}`); values.push(body[key]); }
  }
  if (!sets.length) return Response.json({ error: 'No valid fields' }, { status: 400 });
  sets.push(`updated_at = now()`);
  values.push(id);
  await query(`UPDATE ad_post_plan SET ${sets.join(', ')} WHERE id = $${idx}`, values);
  return Response.json({ ok: true });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {

  const denied = await requireAdmin(req);
  if (denied) return denied;
  const { id } = await params;
  await query(`DELETE FROM ad_post_plan WHERE id = $1`, [id]);
  return Response.json({ ok: true });
}
