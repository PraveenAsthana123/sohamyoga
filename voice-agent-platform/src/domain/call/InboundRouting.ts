import { vapiRequest } from './VapiClient';

/**
 * Real gap found live 2026-09-02: GET /phone-number/{VAPI_PHONE_NUMBER_ID}
 * has NO assistantId set -- this shared number has zero inbound routing
 * configured, meaning any real inbound call (confirmed: one already came in
 * from +14038018053) rings with no AI assistant attached at all. This is
 * Topic C's real, concrete gap -- not a hypothetical.
 *
 * IMPORTANT: setInboundDefaultAssistant() changes live production routing
 * for a REAL shared phone number, immediately, for every future real
 * inbound caller. Same class of real-world side effect as
 * VapiCallAdapter.placeCall() -- must never be called without explicit
 * human confirmation of which assistant should answer.
 */
export async function getInboundDefaultAssistantId(initiatedBy: string): Promise<string | null> {
  const phoneNumberId = process.env.VAPI_PHONE_NUMBER_ID?.trim();
  if (!phoneNumberId) throw new Error('VAPI_PHONE_NUMBER_ID is not set.');
  const data = await vapiRequest<{ assistantId?: string }>({
    method: 'GET',
    path: `/phone-number/${phoneNumberId}`,
    initiatedBy,
  });
  return data.assistantId ?? null;
}

export async function setInboundDefaultAssistant(assistantId: string, initiatedBy: string): Promise<void> {
  const phoneNumberId = process.env.VAPI_PHONE_NUMBER_ID?.trim();
  if (!phoneNumberId) throw new Error('VAPI_PHONE_NUMBER_ID is not set.');
  await vapiRequest({
    method: 'PATCH',
    path: `/phone-number/${phoneNumberId}`,
    body: { assistantId },
    assistantId,
    initiatedBy,
  });
}
