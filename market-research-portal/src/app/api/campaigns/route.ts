import { NextRequest } from 'next/server';
import { requireAdmin } from '../../../lib/session-auth';
import { query } from '../../../lib/postgres';

export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const result = await query(
    `SELECT c.*, s.topic_name,
            (SELECT count(*) FROM campaign_message m WHERE m.campaign_id = c.id) AS message_count,
            (SELECT count(*) FROM campaign_message m WHERE m.campaign_id = c.id AND m.status = 'not_configured') AS not_configured_count
     FROM campaign c LEFT JOIN study s ON s.id = c.study_id
     ORDER BY c.created_at DESC`,
  );
  return Response.json({ campaigns: result.rows });
}

export async function POST(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  let body: { name?: string; channel?: string; sendMode?: string; studyId?: string | null };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Invalid request body.' }, { status: 400 });
  }
  if (!body.name || !body.channel) {
    return Response.json({ error: 'name and channel are required.' }, { status: 400 });
  }
  if (!['email', 'survey', 'interview'].includes(body.channel)) {
    return Response.json({ error: 'channel must be email, survey, or interview.' }, { status: 400 });
  }
  const sendMode = body.sendMode === 'automatic' ? 'automatic' : 'draft';

  const result = await query(
    `INSERT INTO campaign (study_id, name, channel, send_mode) VALUES ($1, $2, $3, $4) RETURNING *`,
    [body.studyId ?? null, body.name, body.channel, sendMode],
  );
  return Response.json({ campaign: result.rows[0] }, { status: 201 });
}
