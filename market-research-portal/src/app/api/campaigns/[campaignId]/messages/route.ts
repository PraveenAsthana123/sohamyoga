import { NextRequest } from 'next/server';
import { requireAdmin } from '../../../../../lib/session-auth';
import { query } from '../../../../../lib/postgres';

export async function GET(req: NextRequest, { params }: { params: { campaignId: string } }) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const result = await query(
    `SELECT * FROM campaign_message WHERE campaign_id = $1 ORDER BY created_at DESC`,
    [params.campaignId],
  );
  return Response.json({ messages: result.rows });
}

export async function POST(req: NextRequest, { params }: { params: { campaignId: string } }) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  let body: { recipient?: string; subject?: string; body?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Invalid request body.' }, { status: 400 });
  }
  if (!body.recipient || !body.body) {
    return Response.json({ error: 'recipient and body are required.' }, { status: 400 });
  }

  const campaign = await query<{ send_mode: string }>(`SELECT send_mode FROM campaign WHERE id = $1`, [params.campaignId]);
  if (!campaign.rowCount) return Response.json({ error: 'Campaign not found.' }, { status: 404 });

  const result = await query(
    `INSERT INTO campaign_message (campaign_id, recipient, subject, body, send_mode, status)
     VALUES ($1, $2, $3, $4, $5, 'queued') RETURNING *`,
    [params.campaignId, body.recipient, body.subject ?? null, body.body, campaign.rows[0].send_mode],
  );
  return Response.json({ message: result.rows[0] }, { status: 201 });
}
