import { CallScriptSections, VapiAdvancedConfig } from '@/domain/script/CallScriptVersion';
import { VoiceProviderNotConfiguredError } from './VoiceProviderAdapter';
import { vapiRequest } from './VapiClient';
import { buildSystemPrompt, buildBusinessContextBlock, BusinessContext } from '@/domain/script/promptBuilder';
import { recordVapiAssistantCreated } from '@/domain/script/repository';

// Pushes a call script's sections + advanced config to Vapi as a real
// assistant. This is a CONFIG sync, not call placement -- distinct from
// VoiceProviderAdapter.placeCall(), which remains unbuilt.
//
// Real Vapi REST shape, CONFIRMED LIVE against api.vapi.ai on 2026-09-02
// (not a guess from docs): POST /assistant to create, PATCH /assistant/{id}
// to update, `Authorization: Bearer <VAPI_API_KEY>`. voice/transcriber/
// endCallMessage/silenceTimeoutSeconds/maxDurationSeconds were all verified
// accepted and echoed back correctly by a real probe call (created +
// deleted immediately after).

export interface VapiSyncResult {
  assistantId: string;
  createdNew: boolean;
}

export function isVapiConfigured(): boolean {
  return Boolean(process.env.VAPI_API_KEY?.trim());
}

/**
 * Creates or updates a Vapi assistant from a call script version's sections
 * and its own real, per-version advanced config (model/voice/transcriber/
 * limits) -- nothing hardcoded. Fails closed (throws
 * VoiceProviderNotConfiguredError) if VAPI_API_KEY is not set -- never
 * fabricates a fake assistant id.
 */
export async function syncScriptVersionToVapi(
  scriptName: string,
  sections: CallScriptSections,
  config: VapiAdvancedConfig,
  existingAssistantId: string | null,
  initiatedBy: string,
  scriptVersionId: string,
  businessContext: BusinessContext | null = null,
): Promise<VapiSyncResult> {
  const apiKey = process.env.VAPI_API_KEY?.trim();
  if (!apiKey) {
    throw new VoiceProviderNotConfiguredError(
      'VAPI_API_KEY is not set. Real assistant sync to Vapi is not wired up yet -- ' +
        'set VAPI_API_KEY before this call script can be pushed to a real Vapi assistant.',
    );
  }

  const publicBaseUrl = process.env.PUBLIC_BASE_URL?.trim();
  const webhookSecret = process.env.VAPI_WEBHOOK_SECRET?.trim();
  // Registers our webhook receiver so end-of-call reports (duration, cost,
  // transcript) actually come back to /api/webhooks/vapi -- without this,
  // PUBLIC_BASE_URL/VAPI_WEBHOOK_SECRET being unset, calls place fine but
  // their outcomes are never recorded. Honestly omitted, not faked, when unset.
  const server = publicBaseUrl && webhookSecret
    ? { server: { url: `${publicBaseUrl}/api/webhooks/vapi`, secret: webhookSecret } }
    : {};

  const body = {
    name: scriptName,
    firstMessage: sections.opening,
    model: {
      provider: config.modelProvider,
      model: config.model,
      messages: [{ role: 'system', content: buildSystemPrompt(sections) + (businessContext ? buildBusinessContextBlock(businessContext) : '') }],
    },
    voice: { provider: config.voiceProvider, voiceId: config.voiceId },
    transcriber: { provider: config.transcriberProvider, model: config.transcriberModel, language: config.transcriberLanguage },
    endCallMessage: config.endCallMessage,
    silenceTimeoutSeconds: config.silenceTimeoutSeconds,
    maxDurationSeconds: config.maxDurationSeconds,
    ...server,
  };

  const data = await vapiRequest<{ id: string }>({
    method: existingAssistantId ? 'PATCH' : 'POST',
    path: existingAssistantId ? `/assistant/${existingAssistantId}` : '/assistant',
    body,
    assistantId: existingAssistantId ?? undefined,
    initiatedBy,
  });
  if (!data.id) throw new Error('Vapi response did not include an assistant id.');

  const createdNew = !existingAssistantId;
  if (createdNew) {
    await recordVapiAssistantCreated(data.id, scriptVersionId);
  }

  return { assistantId: data.id, createdNew };
}
