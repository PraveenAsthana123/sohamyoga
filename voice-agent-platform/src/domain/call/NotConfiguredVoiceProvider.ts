import { PlaceCallRequest, PlaceCallResult, VoiceProviderAdapter, VoiceProviderNotConfiguredError } from './VoiceProviderAdapter';

/**
 * The only VoiceProviderAdapter implementation that exists today. It fails
 * closed on every call attempt with a clear, honest error — there is no
 * Retell/Vapi/Bolna credential configured on this machine yet. This is
 * intentional: better to loudly refuse than to silently fabricate a
 * "successful" call that never happened. Any UI/API surface that calls
 * placeCall() must surface this error to the operator as-is, not swallow it.
 */
export class NotConfiguredVoiceProvider implements VoiceProviderAdapter {
  readonly providerKey = 'not_configured';

  isConfigured(): boolean {
    return false;
  }

  async placeCall(_request: PlaceCallRequest): Promise<PlaceCallResult> {
    throw new VoiceProviderNotConfiguredError(
      'No voice provider credentials are configured. Real outbound calling via ' +
        'Retell AI / Vapi / Bolna.ai is not wired up yet — set the relevant API key ' +
        'and swap in a real VoiceProviderAdapter implementation before calls can be ' +
        'placed. Record real call outcomes manually via /admin/calls/new in the meantime.'
    );
  }
}

/** Resolves the active adapter. Currently always the fail-closed adapter —
 * update this the day a real provider's credentials and implementation exist. */
export function getVoiceProviderAdapter(): VoiceProviderAdapter {
  return new NotConfiguredVoiceProvider();
}
