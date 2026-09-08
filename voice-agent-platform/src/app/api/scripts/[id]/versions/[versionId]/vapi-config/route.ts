import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/requireAdmin';
import { getVersion, updateVapiConfig } from '@/domain/script/repository';

// PATCH /api/scripts/:id/versions/:versionId/vapi-config -- updates the
// real, per-version Vapi model/voice/transcriber/limits config. This is a
// local DB update only; it does not itself push to Vapi -- call sync-vapi
// afterward to apply it to the real assistant.
export async function PATCH(req: NextRequest, { params }: { params: { id: string; versionId: string } }) {
  const auth = await requireAdmin(req);
  if (auth.denied) return auth.denied;

  const version = await getVersion(params.versionId);
  if (!version || version.scriptId !== params.id) return NextResponse.json({ error: 'Version not found.' }, { status: 404 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Request body must be JSON.' }, { status: 400 });
  }

  const current = version.vapiConfig;
  const config = {
    modelProvider: typeof body.modelProvider === 'string' ? body.modelProvider : current.modelProvider,
    model: typeof body.model === 'string' ? body.model : current.model,
    voiceProvider: typeof body.voiceProvider === 'string' ? body.voiceProvider : current.voiceProvider,
    voiceId: typeof body.voiceId === 'string' ? body.voiceId : current.voiceId,
    transcriberProvider: typeof body.transcriberProvider === 'string' ? body.transcriberProvider : current.transcriberProvider,
    transcriberModel: typeof body.transcriberModel === 'string' ? body.transcriberModel : current.transcriberModel,
    transcriberLanguage: typeof body.transcriberLanguage === 'string' ? body.transcriberLanguage : current.transcriberLanguage,
    endCallMessage: typeof body.endCallMessage === 'string' ? body.endCallMessage : current.endCallMessage,
    silenceTimeoutSeconds: typeof body.silenceTimeoutSeconds === 'number' ? body.silenceTimeoutSeconds : current.silenceTimeoutSeconds,
    maxDurationSeconds: typeof body.maxDurationSeconds === 'number' ? body.maxDurationSeconds : current.maxDurationSeconds,
  };

  try {
    const updated = await updateVapiConfig(params.versionId, config);
    return NextResponse.json(updated.toJSON());
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Invalid config.' }, { status: 400 });
  }
}
