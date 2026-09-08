import { PlaceCallRequest, PlaceCallResult, VoiceProviderAdapter, VoiceProviderNotConfiguredError } from './VoiceProviderAdapter';
import { getVersion } from '@/domain/script/repository';
import { vapiRequest } from './VapiClient';

// Real Vapi outbound-call adapter. Requires the script version to already
// have a synced vapi_assistant_id (see sync-vapi route) and a real
// VAPI_PHONE_NUMBER_ID (the phone number the call is placed FROM).
// Confirmed live 2026-09-02: this account has exactly one active number,
// +19435009474 (id 7f7c4382-e568-42d4-a7e7-416d56d80f7e).
//
// IMPORTANT: placeCall() has a real-world side effect -- it rings a real
// phone. Unlike assistant create/update/delete (fully reversible, no
// external effect), this must never be called in an automated test without
// explicit human confirmation of the destination number.

export class VapiCallAdapter implements VoiceProviderAdapter {
  readonly providerKey = 'vapi';

  isConfigured(): boolean {
    return Boolean(process.env.VAPI_API_KEY?.trim() && process.env.VAPI_PHONE_NUMBER_ID?.trim());
  }

  async placeCall(request: PlaceCallRequest): Promise<PlaceCallResult> {
    const apiKey = process.env.VAPI_API_KEY?.trim();
    const phoneNumberId = process.env.VAPI_PHONE_NUMBER_ID?.trim();
    if (!apiKey || !phoneNumberId) {
      throw new VoiceProviderNotConfiguredError(
        'VAPI_API_KEY / VAPI_PHONE_NUMBER_ID are not set. Real outbound calling via Vapi is not wired up yet.',
      );
    }

    const version = await getVersion(request.scriptVersionId);
    if (!version) throw new Error(`Script version ${request.scriptVersionId} not found.`);
    if (!version.vapiAssistantId) {
      throw new Error('This script version has not been synced to a Vapi assistant yet -- sync it first (see sync-vapi route).');
    }

    const data = await vapiRequest<{ id: string; status: string }>({
      method: 'POST',
      path: '/call',
      body: {
        assistantId: version.vapiAssistantId,
        phoneNumberId,
        customer: { number: request.contactPhone },
      },
      assistantId: version.vapiAssistantId,
      initiatedBy: request.initiatedBy,
    });
    return { externalCallId: data.id, providerStatus: data.status };
  }
}
