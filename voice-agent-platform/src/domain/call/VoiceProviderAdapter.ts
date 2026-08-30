// VoiceProviderAdapter — the contract any real telephony/voice-agent
// provider (Retell AI, Vapi, Bolna.ai, ...) must implement to place or
// receive calls through this platform. As of this build, the user (a
// voice-agent engineer/consultant) does NOT yet hold API credentials for
// any of these providers, so no real implementation exists — only the
// fail-closed NotConfiguredVoiceProvider below. Placing a call therefore
// always fails with a clear, honest error rather than fabricating a fake
// successful call or a fake transcript. Real call outcomes are recorded via
// the manual "Log a call" admin form (see src/app/admin/calls) until a
// provider is wired up.
//
// ---------------------------------------------------------------------------
// What a real implementation would need to plug in (reference, not built):
//
//   Retell AI  (https://docs.retellai.com)
//     - RETELL_API_KEY (server-side secret)
//     - An agent_id per call-script/service-type, created via their Agent API
//       or dashboard, referencing an LLM + voice + the script content
//     - POST /v2/create-phone-call (outbound) or a configured inbound number
//       webhook that hits our /api/calls/webhook (not yet built) to log the
//       real call_log row as it happens
//     - Their post-call webhook payload (transcript, recording_url, duration,
//       disconnection_reason) maps onto call_log.outcome_notes /
//       duration_seconds / status
//
//   Vapi  (https://docs.vapi.ai)
//     - VAPI_API_KEY + VAPI_PHONE_NUMBER_ID
//     - An assistant configuration (model/voice/first message) generated
//       from the published CallScriptVersion's `sections`
//     - POST /call (outbound) or an inbound phone-number webhook
//     - end-of-call-report webhook -> call_log update
//
//   Bolna.ai  (https://docs.bolna.ai)
//     - BOLNA_API_KEY + an agent_id per script
//     - POST /call (outbound)
//     - execution webhook -> call_log update
//
// In every case: the adapter takes a Contact + a published CallScriptVersion
// and returns a provider-assigned external call id; a separate webhook
// receiver later reconciles that external id with the resulting call_log
// row. None of that webhook/agent-provisioning plumbing is built yet — it
// depends on which provider the user picks once credentials exist.
// ---------------------------------------------------------------------------

export interface PlaceCallRequest {
  contactId: string;
  contactPhone: string;
  scriptVersionId: string;
  direction: 'outbound';
}

export interface PlaceCallResult {
  externalCallId: string;
  providerStatus: string;
}

/** Thrown by any adapter that cannot actually place a call right now. */
export class VoiceProviderNotConfiguredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'VoiceProviderNotConfiguredError';
  }
}

export interface VoiceProviderAdapter {
  readonly providerKey: string;
  /** Whether this adapter currently holds valid credentials and can place a real call. */
  isConfigured(): boolean;
  /** Places an outbound call. Must throw VoiceProviderNotConfiguredError, never
   * fabricate a fake success, when isConfigured() is false. */
  placeCall(request: PlaceCallRequest): Promise<PlaceCallResult>;
}
