import { NextRequest } from 'next/server';
import { requireAdmin } from '../../../../lib/session-auth';
import { query } from '../../../../lib/postgres';
import { transcribeAudioBuffer } from '../../../../domain/pipeline/Transcriber';
import { withApiErrorLog } from '../../../../lib/api-error-log';

export const runtime = 'nodejs';

// Real STT wiring for voice_call — previously faster-whisper only ran for
// Spatial Learning; voice_call.transcript existed as a column with nothing
// anywhere in this app ever writing to it. Accepts a recorded call's audio
// (multipart) plus the callId it belongs to, and stores the real transcript.
async function handlePost(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const form = await req.formData();
  const audio = form.get('audio');
  const callId = form.get('callId');
  if (!audio || typeof audio === 'string') return Response.json({ error: 'Audio file required.' }, { status: 400 });
  if (!callId || typeof callId !== 'string') return Response.json({ error: 'callId is required.' }, { status: 400 });
  if (audio.size > 25 * 1024 * 1024) return Response.json({ error: 'Audio exceeds 25 MB.' }, { status: 413 });

  const call = await query<{ id: string }>(`SELECT id FROM voice_call WHERE id = $1`, [callId]);
  if (!call.rowCount) return Response.json({ error: 'Unknown call.' }, { status: 404 });

  try {
    const result = await transcribeAudioBuffer(Buffer.from(await audio.arrayBuffer()), 'wav');
    await query(`UPDATE voice_call SET transcript = $1, updated_at = now() WHERE id = $2`, [result.text, callId]);
    await query(
      `INSERT INTO voice_call_event(call_id, event_name, payload) VALUES ($1,'transcript.generated',$2)`,
      [callId, JSON.stringify({ provider: 'faster-whisper base.en', charCount: result.text.length })],
    );
    return Response.json({ callId, transcript: result.text });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Transcription failed.';
    await query(`INSERT INTO voice_call_event(call_id, event_name, payload) VALUES ($1,'transcript.failed',$2)`, [callId, JSON.stringify({ error: message.slice(0, 500) })]);
    return Response.json({ error: message }, { status: 422 });
  }
}

export const POST = withApiErrorLog(handlePost);
