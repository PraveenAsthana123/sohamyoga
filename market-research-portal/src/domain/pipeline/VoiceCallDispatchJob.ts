// Automatic Process for the Voice AI module (mandatory Operational Portal
// Page & Tab Standard: every Automatic Process needs a real scheduled job,
// not a mock). Scope is deliberately narrow and honest: there is no PSTN
// dispatch client anywhere in this app (same gap SelfHealJob already
// documents for youtube_publish/social_publish), so this job cannot place
// calls. What it *can* do for real: sweep voice_call rows whose
// scheduled_at has passed while still sitting in 'scheduled', and relabel
// them 'blocked' with the true reason, so nothing sits in a stale
// "scheduled" state forever implying a call is about to happen.
import { query } from '../../lib/postgres';

interface DispatchResult {
  callId: string;
  reason: string;
}

export async function run(): Promise<{ relabeled: number }> {
  const due = await query<{ id: string; workspace_id: string }>(
    `SELECT id, workspace_id FROM voice_call WHERE status = 'scheduled' AND scheduled_at <= now()`,
  );
  const results: DispatchResult[] = [];
  for (const call of due.rows) {
    const conn = await query<{ status: string }>(
      `SELECT status FROM marketing_channel_connection WHERE workspace_id = $1 AND channel = 'voice'`,
      [call.workspace_id],
    );
    const reason = conn.rows[0]?.status === 'connected'
      ? 'Telephony provider reports connected, but no PSTN dispatch client is implemented in this app yet — cannot place the call.'
      : 'Telephony provider/account/number is not connected — scheduled call could not be dispatched at its scheduled time.';
    await query(`UPDATE voice_call SET status = 'blocked', blocker = $2, updated_at = now() WHERE id = $1`, [call.id, reason]);
    await query(`INSERT INTO voice_call_event(call_id, event_name, payload) VALUES ($1,'call.blocked',$2)`, [call.id, JSON.stringify({ reason })]);
    results.push({ callId: call.id, reason });
  }
  return { relabeled: results.length };
}
