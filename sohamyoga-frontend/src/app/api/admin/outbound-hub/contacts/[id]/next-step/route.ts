export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { databaseConfigured, getPool } from '@/lib/postgres';

export async function POST(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req); if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DB not configured' }, { status: 503 });
  const pool = getPool(); const client = await pool.connect();
  try {
    const contact = await client.query('SELECT * FROM outbound_contacts WHERE id=$1', [params.id]);
    if (!contact.rows.length) return Response.json({ error: 'Not found' }, { status: 404 });
    const c = contact.rows[0];
    const seq = await client.query('SELECT * FROM outbound_sequences WHERE id=$1', [c.sequence_id]);
    if (!seq.rows.length) return Response.json({ error: 'Sequence not found' }, { status: 404 });
    const steps = seq.rows[0].steps as Array<{ step: number; channel: string; subject: string; body: string }>;
    const nextIndex = (c.step_index || 0) + 1;
    if (nextIndex >= steps.length) {
      await client.query('UPDATE outbound_contacts SET status=\'completed\', last_sent=NOW() WHERE id=$1', [params.id]);
      return Response.json({ status: 'completed', message: 'Contact has completed all sequence steps' });
    }
    const step = steps[nextIndex];
    const personalizedBody = (step.body || '')
      .replace(/{name}/g, c.name || '').replace(/{company}/g, c.company || 'your company');
    await client.query(
      `INSERT INTO outbound_messages (contact_id,step,channel,subject,body,status,sent_at)
       VALUES ($1,$2,$3,$4,$5,'sent',NOW())`,
      [c.id, nextIndex, step.channel, step.subject, personalizedBody]
    );
    await client.query('UPDATE outbound_contacts SET step_index=$1, last_sent=NOW() WHERE id=$2', [nextIndex, params.id]);
    return Response.json({ advanced: true, step: nextIndex, channel: step.channel, subject: step.subject });
  } finally { client.release(); }
}
