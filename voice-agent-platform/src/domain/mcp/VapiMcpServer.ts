import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { listCalls, getCall, vapiApiHealthLast7Days, totalCallCostUsd } from '@/domain/call/repository';
import { listContacts, getContact } from '@/domain/contact/repository';
import { listScripts, getScript, getVersion, vapiSyncHealthLast7Days } from '@/domain/script/repository';
import { syncScriptVersionToVapi } from '@/domain/call/VapiAssistantSync';
import { getVoiceProviderAdapter } from '@/domain/call/getVoiceProviderAdapter';
import { createManualCall } from '@/domain/call/repository';
import { getBusinessCustomer } from '@/domain/customer/repository';

function textResult(data: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
}

function errorResult(message: string) {
  return { content: [{ type: 'text' as const, text: message }], isError: true };
}

/**
 * The real MCP-protocol server for this platform -- the first genuine one
 * anywhere in this codebase (the sohamyoga-frontend "MCP gateway" is a
 * hand-rolled REST API, confirmed NOT real MCP: no JSON-RPC, no tools/list,
 * no @modelcontextprotocol/sdk). This wraps operations that already exist
 * and are already tenant-isolation-checked (VapiClient.ts) -- it does not
 * add a second implementation of Vapi access, it exposes the existing one.
 *
 * Read-only tools are safe for any caller. `sync_script_to_vapi` has a real
 * but reversible effect (creates/updates a Vapi assistant). `place_call` is
 * the one tool with an irreversible real-world side effect -- it rings a
 * real phone -- and requires an explicit confirmed:true argument, mirroring
 * the same human-confirmation gate already enforced in the admin UI
 * (PlaceCallButton.tsx's window.confirm()). An MCP client (an LLM agent)
 * must not be able to trigger a real call without an explicit, named
 * confirmation step no automated retry could accidentally satisfy.
 */
export function buildVapiMcpServer(initiatedBy: string): McpServer {
  const server = new McpServer({ name: 'voice-agent-platform-vapi', version: '1.0.0' });

  server.registerTool(
    'list_calls',
    { description: 'List recent calls (real call_log rows, most recent first).', inputSchema: { limit: z.number().min(1).max(200).default(50) } },
    async ({ limit }) => textResult(await listCalls(limit))
  );

  server.registerTool(
    'get_call',
    { description: 'Get one call by id, including cost/transcript/quality review if the webhook has reported them.', inputSchema: { callId: z.string() } },
    async ({ callId }) => {
      const call = await getCall(callId);
      return call ? textResult(call.toJSON()) : errorResult(`No call found with id ${callId}.`);
    }
  );

  server.registerTool(
    'list_contacts',
    { description: 'List contacts (real contact rows).', inputSchema: {} },
    async () => textResult((await listContacts()).map((c) => c.toJSON()))
  );

  server.registerTool(
    'get_contact',
    { description: 'Get one contact by id.', inputSchema: { contactId: z.string() } },
    async ({ contactId }) => {
      const contact = await getContact(contactId);
      return contact ? textResult(contact.toJSON()) : errorResult(`No contact found with id ${contactId}.`);
    }
  );

  server.registerTool(
    'list_scripts',
    { description: 'List call scripts (name, direction, category, sync status) -- not their full content.', inputSchema: {} },
    async () => textResult((await listScripts()).map((s) => s.toJSON()))
  );

  server.registerTool(
    'get_vapi_ops_health',
    { description: 'Real Vapi API + sync health for the last 7 days, derived from this app\'s own audit tables (never fabricated).', inputSchema: {} },
    async () => textResult({
      apiHealth: await vapiApiHealthLast7Days(),
      syncHealth: await vapiSyncHealthLast7Days(),
      totalCostUsd: await totalCallCostUsd(),
    })
  );

  server.registerTool(
    'sync_script_to_vapi',
    {
      description: 'Pushes a script version\'s content to Vapi as a real assistant (creates or updates). Real but reversible -- does not place a call.',
      inputSchema: { scriptId: z.string(), versionId: z.string() },
    },
    async ({ scriptId, versionId }) => {
      const [script, version] = await Promise.all([getScript(scriptId), getVersion(versionId)]);
      if (!script || !version || version.scriptId !== scriptId) return errorResult('Script or version not found.');

      const owner = script.ownerCustomerId ? await getBusinessCustomer(script.ownerCustomerId) : null;
      const assistantName = (owner ? `[${owner.businessName}] ${script.toJSON().name}` : script.toJSON().name).slice(0, 40);
      const businessContext = owner ? {
        servicesDescription: owner.servicesDescription, pricingInfo: owner.pricingInfo,
        businessHours: owner.businessHours, holidaysClosures: owner.holidaysClosures,
        welcomeNote: owner.welcomeNote, thankYouNote: owner.thankYouNote, paymentNote: owner.paymentNote,
      } : null;

      try {
        const result = await syncScriptVersionToVapi(assistantName, version.sections, version.vapiConfig, version.vapiAssistantId, `mcp:${initiatedBy}`, version.id, businessContext);
        return textResult(result);
      } catch (err) {
        return errorResult(err instanceof Error ? err.message : 'Sync failed.');
      }
    }
  );

  server.registerTool(
    'place_call',
    {
      description:
        'DANGEROUS: places a REAL outbound phone call via Vapi, immediately, to a real contact\'s real phone number. ' +
        'This has a real-world side effect and real cost -- it is not reversible once the phone rings. ' +
        'Requires confirmed:true. If confirmed is not exactly true, this tool refuses and does nothing.',
      inputSchema: { contactId: z.string(), scriptVersionId: z.string(), confirmed: z.boolean().default(false) },
    },
    async ({ contactId, scriptVersionId, confirmed }) => {
      if (confirmed !== true) {
        return errorResult('Refused: this places a real phone call. Re-call this tool with confirmed:true only after explicit human confirmation of the destination contact.');
      }
      const contact = await getContact(contactId);
      if (!contact) return errorResult(`Contact ${contactId} not found.`);
      if (!contact.phone) return errorResult('This contact has no phone number on file.');
      if (!contact.isCallable) return errorResult(`Contact status '${contact.status}' is not callable.`);

      try {
        const adapter = getVoiceProviderAdapter();
        const result = await adapter.placeCall({
          contactId, contactPhone: contact.phone, scriptVersionId, direction: 'outbound', initiatedBy: `mcp:${initiatedBy}`,
        });
        const call = await createManualCall({
          direction: 'outbound', contactId, scriptVersionId, status: 'queued',
          provider: adapter.providerKey, createdBy: `mcp:${initiatedBy}`, externalCallId: result.externalCallId,
        });
        return textResult({ call: call.toJSON(), providerStatus: result.providerStatus });
      } catch (err) {
        return errorResult(err instanceof Error ? err.message : 'placeCall failed.');
      }
    }
  );

  return server;
}
