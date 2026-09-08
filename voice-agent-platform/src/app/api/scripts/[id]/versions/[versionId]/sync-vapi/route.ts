import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/requireAdmin';
import { getVersion, getScript, recordVapiSyncSuccess, recordVapiSyncFailure, appendVapiSyncLog } from '@/domain/script/repository';
import { syncScriptVersionToVapi } from '@/domain/call/VapiAssistantSync';
import { VoiceProviderNotConfiguredError } from '@/domain/call/VoiceProviderAdapter';
import { getBusinessCustomer } from '@/domain/customer/repository';
import { createNotification } from '@/domain/notification/repository';

// POST /api/scripts/:id/versions/:versionId/sync-vapi -- pushes this
// version's sections to Vapi as an assistant config. Fails closed with a
// clear error (never a fake success) when VAPI_API_KEY is not set. Every
// attempt -- success, Vapi-side failure, or not-configured -- is appended
// to vapi_sync_log so there's a real trace of what happened, not just the
// latest state.
export async function POST(req: NextRequest, { params }: { params: { id: string; versionId: string } }) {
  const auth = await requireAdmin(req);
  if (auth.denied) return auth.denied;

  const [script, version] = await Promise.all([getScript(params.id), getVersion(params.versionId)]);
  if (!script || !version || version.scriptId !== params.id) {
    return NextResponse.json({ error: 'Script or version not found.' }, { status: 404 });
  }

  const action = version.vapiAssistantId ? 'update' : 'create';
  const startedAt = Date.now();

  // Prefix the Vapi assistant name with the owning business so it's
  // traceable in the Vapi dashboard back to which customer it belongs to --
  // house-owned scripts (no owner) keep just their own name. Vapi enforces
  // a real 40-character max on assistant names (confirmed live 2026-09-02),
  // so truncate rather than let a long combined name fail the sync outright.
  const owner = script.ownerCustomerId ? await getBusinessCustomer(script.ownerCustomerId) : null;
  const assistantName = (owner ? `[${owner.businessName}] ${script.toJSON().name}` : script.toJSON().name).slice(0, 40);

  try {
    const businessContext = owner ? {
      servicesDescription: owner.servicesDescription, pricingInfo: owner.pricingInfo,
      businessHours: owner.businessHours, holidaysClosures: owner.holidaysClosures,
      welcomeNote: owner.welcomeNote, thankYouNote: owner.thankYouNote, paymentNote: owner.paymentNote,
    } : null;
    const result = await syncScriptVersionToVapi(assistantName, version.sections, version.vapiConfig, version.vapiAssistantId, auth.principal.email, version.id, businessContext);
    const updated = await recordVapiSyncSuccess(version.id, result.assistantId);
    await appendVapiSyncLog({
      versionId: version.id, action, success: true, assistantId: result.assistantId,
      durationMs: Date.now() - startedAt, initiatedBy: auth.principal.email,
    });
    return NextResponse.json({ ok: true, assistantId: result.assistantId, createdNew: result.createdNew, version: updated.toJSON() });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Vapi sync failed.';
    const notConfigured = err instanceof VoiceProviderNotConfiguredError;
    if (!notConfigured) {
      await recordVapiSyncFailure(version.id, message);
      await createNotification({
        recipientKind: 'admin',
        type: 'vapi_sync_failed',
        title: `Vapi sync failed: ${assistantName}`,
        body: message,
      });
    }
    await appendVapiSyncLog({
      versionId: version.id, action, success: false, errorMessage: message,
      durationMs: Date.now() - startedAt, initiatedBy: auth.principal.email,
    });
    return NextResponse.json({ error: message }, { status: notConfigured ? 409 : 502 });
  }
}
