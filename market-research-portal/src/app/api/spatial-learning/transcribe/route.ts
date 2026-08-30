import { NextRequest } from 'next/server';
import { requireAdmin } from '../../../../lib/session-auth';
import { transcribeAudioBuffer } from '../../../../domain/pipeline/Transcriber';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const form = await req.formData();
  const audio = form.get('audio');
  if (!audio || typeof audio === 'string') return Response.json({ error: 'Audio file required.' }, { status: 400 });
  if (audio.size > 15 * 1024 * 1024) return Response.json({ error: 'Audio exceeds 15 MB.' }, { status: 413 });
  try {
    const result = await transcribeAudioBuffer(Buffer.from(await audio.arrayBuffer()), 'webm');
    return Response.json(result);
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'Transcription failed.' }, { status: 422 });
  }
}
