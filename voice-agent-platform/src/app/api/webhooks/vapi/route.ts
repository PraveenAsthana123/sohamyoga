import { NextRequest, NextResponse } from 'next/server';
import { getContactByPhone, getContactOwnerCustomerId } from '@/domain/contact/repository';
import {
  applyWebhookReportToCall, createInboundCallFromWebhook, getCallByExternalId, updateCallStatusByExternalId, WebhookReport,
} from '@/domain/call/repository';
import { CallStatus } from '@/domain/call/CallLog';
import { createNotification, hasNotificationThisMonth } from '@/domain/notification/repository';
import { getMonthlyCostCap, monthToDateCostForCustomer } from '@/domain/customer/repository';

/**
 * Receives Vapi's real end-of-call-report webhook -- the only way this
 * platform ever learns what actually happened on a call (duration, cost,
 * transcript, whether it connected). Without this route, every placeCall()
 * result sits at 'queued' forever and every inbound call is invisible.
 *
 * Verified against the real Vapi API 2026-09-02: an assistant's
 * `isServerUrlSecretSet` field confirms Vapi supports a shared secret set
 * via `server: { url, secret }` on the assistant, echoed back on every
 * webhook call in the `x-vapi-secret` header. VAPI_WEBHOOK_SECRET here is a
 * value WE mint and configure on the assistant (see VapiAssistantSync.ts),
 * not something Vapi generates -- if it isn't set, this route fails closed
 * rather than trusting an unverified caller.
 */
function mapEndedReasonToStatus(endedReason: string | undefined): CallStatus {
  if (!endedReason) return 'completed';
  if (endedReason.includes('no-answer') || endedReason.includes('busy')) return 'no_answer';
  if (endedReason.includes('failed') || endedReason.includes('error') || endedReason.includes('cancelled')) return 'failed';
  return 'completed';
}

/** Real "price tracking and control" (Topic Q) -- checks the business's
 * actual month-to-date Vapi spend (webhook-reported cost_usd only) against
 * their admin-set cap, notifying once per month (not once per call) to
 * avoid spamming once already over. */
async function checkCostCap(contactId: string | null): Promise<void> {
  if (!contactId) return;
  const ownerCustomerId = await getContactOwnerCustomerId(contactId);
  if (!ownerCustomerId) return;

  const [cap, spent] = await Promise.all([getMonthlyCostCap(ownerCustomerId), monthToDateCostForCustomer(ownerCustomerId)]);
  if (cap === null || spent < cap) return;

  const alreadyNotified = await hasNotificationThisMonth('business_customer', ownerCustomerId, 'cost_cap_exceeded');
  if (alreadyNotified) return;

  await createNotification({
    recipientKind: 'business_customer',
    recipientId: ownerCustomerId,
    type: 'cost_cap_exceeded',
    title: 'Monthly Vapi spend cap reached',
    body: `Month-to-date spend is $${spent.toFixed(2)}, at or above your $${cap.toFixed(2)} cap.`,
  });
  await createNotification({
    recipientKind: 'admin',
    type: 'cost_cap_exceeded',
    title: 'A business reached its monthly spend cap',
    body: `Business ${ownerCustomerId} is at $${spent.toFixed(2)} of a $${cap.toFixed(2)} monthly cap.`,
  });
}

export async function POST(req: NextRequest) {
  const configuredSecret = process.env.VAPI_WEBHOOK_SECRET?.trim();
  if (!configuredSecret) {
    return NextResponse.json(
      { error: 'VAPI_WEBHOOK_SECRET is not configured -- refusing to process unverifiable webhook calls.' },
      { status: 503 }
    );
  }
  const receivedSecret = req.headers.get('x-vapi-secret');
  if (receivedSecret !== configuredSecret) {
    return NextResponse.json({ error: 'Invalid webhook secret.' }, { status: 401 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Request body must be JSON.' }, { status: 400 });
  }

  const message = body?.message;

  // Real-time status (Topic B/H): lets a call show 'in_progress' while it's
  // actually happening instead of sitting at 'queued' for its whole
  // duration. Every other event type Vapi sends to this same URL
  // (transcript, function-call, etc.) is acknowledged and ignored -- this
  // app has no use for live transcript streaming or tool-call handling.
  if (message?.type === 'status-update') {
    const externalCallId: string | undefined = message.call?.id;
    const vapiStatus: string | undefined = message.status;
    if (externalCallId && vapiStatus === 'in-progress') {
      await updateCallStatusByExternalId(externalCallId, 'in_progress');
    }
    return NextResponse.json({ acknowledged: true, type: 'status-update' });
  }

  if (message?.type !== 'end-of-call-report') {
    return NextResponse.json({ ignored: true, type: message?.type ?? 'unknown' });
  }

  const call = message.call ?? {};
  const artifact = message.artifact ?? {};
  const externalCallId: string | undefined = call.id;
  if (!externalCallId) {
    return NextResponse.json({ error: 'Payload missing message.call.id.' }, { status: 400 });
  }

  const startedAt = call.startedAt ? new Date(call.startedAt) : null;
  const endedAt = call.endedAt ? new Date(call.endedAt) : new Date();
  const durationSeconds = startedAt ? Math.max(0, Math.round((endedAt.getTime() - startedAt.getTime()) / 1000)) : null;

  const report: WebhookReport = {
    status: mapEndedReasonToStatus(message.endedReason),
    durationSeconds,
    costUsd: typeof call.cost === 'number' ? call.cost : null,
    transcript: artifact.transcript || null,
    recordingUrl: artifact.recording?.stereoUrl || artifact.recording?.url || call.recordingUrl || null,
    endedReason: message.endedReason || null,
    startedAt,
    endedAt,
  };

  const existing = await getCallByExternalId(externalCallId);
  if (existing) {
    const updated = await applyWebhookReportToCall(existing.id, report);
    if (report.costUsd !== null) await checkCostCap(updated.contactId);
    return NextResponse.json({ updated: true, callId: updated.id });
  }

  // No pre-existing row -- this was a real inbound call that never went
  // through placeCall(). Try to match the caller's number to a known contact.
  const callerNumber: string | undefined = call.customer?.number;
  const contact = callerNumber ? await getContactByPhone(callerNumber) : null;
  const created = await createInboundCallFromWebhook({
    externalCallId,
    contactId: contact?.id ?? null,
    report,
  });

  if (!contact) {
    await createNotification({
      recipientKind: 'admin',
      type: 'inbound_call_unmatched',
      title: 'Unmatched inbound call',
      body: `A real inbound call from ${callerNumber ?? 'an unknown number'} did not match any known contact.`,
      relatedCallId: created.id,
    });
  } else if (report.costUsd !== null) {
    await checkCostCap(contact.id);
  }

  return NextResponse.json({ created: true, callId: created.id }, { status: 201 });
}
