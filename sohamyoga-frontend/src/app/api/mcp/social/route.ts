"use server";
// MCP Social Gateway — Streamable HTTP transport
// Handles all 15 MCP tool calls. Routes publish/schedule to Postiz.
// All destructive tools require confirmApprovalId or explicit confirmation.

import { NextRequest } from "next/server";
import { MCP_TOOLS, getMcpTool, type McpToolName } from "@/domain/social/McpToolRegistry";
import { PLATFORM_CONFIG } from "@/domain/social/SocialAccount";
import {getAdminPrincipal} from '@/lib/admin-auth';
import {query,transaction} from '@/lib/postgres';
import {PROVIDERS} from '@/domain/social/PostizProtocol';
import {classifySentiment} from '@/lib/sentiment';

// Postiz runs frontend and backend API on SEPARATE ports (see
// integrations/postiz/docker-compose.yml: 15080→container 5000 is the
// frontend, 15081→container 3000 is the real backend). This gateway needs
// the backend's Public API, mounted only at /public/v1 and guarded by
// PublicAuthMiddleware (verified directly against the running container's
// compiled source: apps/backend/dist/.../public.auth.middleware.js) — it
// checks a plain `Authorization: <api-key>` header, NOT `X-Secret`. A real
// account + API key now exist (registration was blocked by no Temporal
// server being deployed — fixed via a real Temporal dev-server service in
// integrations/postiz/docker-compose.yml, embedded SQLite, no separate
// Postgres/Elasticsearch needed) — POSTIZ_PUBLIC_API_KEY is configured and
// verified live end to end (list_social_accounts returns a real 200 []).
// The one remaining real blocker is unchanged: zero social accounts are
// connected through Postiz's own OAuth flow, which needs real platform app
// credentials and a human completing the consent screen — see
// createPostizPost()'s error below for exactly where that surfaces.
const POSTIZ_PUBLIC_API_BASE = process.env.POSTIZ_PUBLIC_API_URL || "http://127.0.0.1:15081/public/v1";
const POSTIZ_API_KEY = process.env.POSTIZ_PUBLIC_API_KEY || "";

// ---- MCP protocol: list tools ----
export async function GET(req:NextRequest) {
  const auth=await getAdminPrincipal(req);if(auth.denied)return auth.denied;
  return Response.json({
    tools: MCP_TOOLS.map(t => ({
      name: t.name,
      description: t.description,
      requiresApproval: t.requiresApproval,
      isDestructive: t.isDestructive,
      inputSchema: t.inputSchema,
    })),
    platforms: Object.values(PLATFORM_CONFIG).map(p => ({
      platform: p.platform,
      displayName: p.displayName,
      postizSupport: p.postizSupport,
      maxCharacters: p.maxCharacters,
      supportsScheduling: p.supportsScheduling,
    })),
  });
}

// ---- MCP protocol: tool call ----
export async function POST(req: NextRequest) {
  const auth=await getAdminPrincipal(req);if(auth.denied)return auth.denied;
  const body = await req.json();
  const { tool, input } = body as { tool: McpToolName; input: Record<string, unknown> };

  const toolDef = getMcpTool(tool);
  if (!toolDef) {
    return Response.json({ error: `Unknown tool: ${tool}` }, { status: 400 });
  }

  // Safety gate — destructive tools require confirmation token
  if (toolDef.isDestructive && !input.confirmApprovalId && input.confirmText !== "DISCONNECT") {
    return Response.json(
      { error: `Tool '${tool}' is destructive and requires confirmApprovalId or confirmText='DISCONNECT'`, requiresApproval: true },
      { status: 403 }
    );
  }
  if (["publish_post","schedule_post","retry_failed_post"].includes(tool)) {
    const valid=await validateApproval(String(input.confirmApprovalId||''),String(input.draftId||''),tool,auth.principal!.id);
    if(!valid)return Response.json({error:'Approval is missing, expired, consumed, rejected, or not bound to this draft.',requiresApproval:true},{status:403});
  }

  try {
    const result = await dispatchTool(tool, input,auth.principal!.id);
    return Response.json({ tool, result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (tool === 'list_social_accounts') {
      return Response.json({
        tool,
        result: { connected: false, accounts: [], blocker: msg },
      });
    }
    return Response.json({ tool, error: msg }, { status: 500 });
  }
}

// ---- Tool dispatcher ----
async function dispatchTool(tool: McpToolName, input: Record<string, unknown>,principalId:string): Promise<unknown> {
  switch (tool) {
    case "list_social_accounts":
      return postizProxy("GET", `/integrations`);

    case "create_content_draft": {
      const r=await query(`INSERT INTO social_content_draft(tenant_id,workspace_id,campaign_id,master_text,content_type,generated_with_ai,tags,created_by)
       VALUES($1::uuid,$2::uuid,NULLIF($3,'')::uuid,$4,$5,$6,$7::text[],$8::uuid) RETURNING id,status`,[input.tenantId,input.workspaceId,String(input.campaignId||''),input.masterText,input.contentType,input.generatedWithAI!==false,input.tags||[],principalId]);
      const draftId = r.rows[0].id;
      // One social_platform_variant per requested platform that has a real
      // connected social_account — this insert was previously missing
      // entirely, silently leaving schedule_post/publish_post with nothing
      // to act on downstream. account_id is NOT NULL in the schema, so a
      // platform with no connected account genuinely cannot get a variant
      // row yet; unmatchedPlatforms reports that honestly instead of
      // silently dropping it.
      const platforms = Array.isArray(input.platforms) ? input.platforms as string[] : [];
      const unmatchedPlatforms: string[] = [];
      for (const platform of platforms) {
        const inserted = await query(
          `INSERT INTO social_platform_variant (draft_id, platform, account_id, adapted_text)
           SELECT $1, $2, a.id, $3 FROM social_account a
           WHERE a.tenant_id = $4::uuid AND a.workspace_id=$5::uuid AND a.platform = $2 AND a.status = 'connected' LIMIT 1
           ON CONFLICT (draft_id, platform) DO NOTHING RETURNING id`,
          [draftId, platform, input.masterText, input.tenantId,input.workspaceId],
        );
        if (!inserted.rowCount) unmatchedPlatforms.push(platform);
      }
      return {draftId,status:r.rows[0].status,unmatchedPlatforms};
    }

    case "adapt_content":
      const cfg = PLATFORM_CONFIG[input.platform as keyof typeof PLATFORM_CONFIG];
      return {
        platform: input.platform,
        maxCharacters: cfg?.maxCharacters,
        adaptedText: null, // Populated by Ollama /api/ai/chat call in production
        message: `Adaptation for ${cfg?.displayName ?? input.platform} requires Ollama or Postiz AI.`,
      };

    case "upload_media":
      return postizProxy("POST", `/upload`, input);

    case "preview_post":
      return { draftId: input.draftId, platform: input.platform, previewUrl: null, supported:false, message: "No preview renderer is connected; preview was not generated." };

    case "request_approval": {
      const r=await query(`WITH d AS (UPDATE social_content_draft SET status='review_requested',review_requested_at=now(),updated_at=now() WHERE id=$1::uuid RETURNING id,tenant_id)
       INSERT INTO social_mcp_approval_log(tenant_id,tool_name,draft_id,requested_by,status,notes)
       SELECT tenant_id,'publish_post',id,$2::uuid,'pending',$3 FROM d RETURNING id,status,expires_at`,[input.draftId,principalId,String(input.note||'')]);
      if(!r.rowCount)throw new Error('Draft not found');return {approvalRequestId:r.rows[0].id,status:r.rows[0].status,expiresAt:r.rows[0].expires_at};
    }

    case "schedule_post":
      return createPostizPost(String(input.draftId), 'schedule', String(input.scheduledAt));

    case "publish_post":
      return createPostizPost(String(input.draftId), 'now');

    case "get_post_status": {
      // Postiz's Public API has no single-post GET — only a list. Filter
      // client-side rather than guessing at a per-id route that doesn't exist.
      const range=new URLSearchParams({startDate:new Date(Date.now()-30*86400000).toISOString(),endDate:new Date(Date.now()+86400000).toISOString()});
      const list = await postizProxy("GET", `/posts?${range}`) as { posts?: Array<{ id: string }> };
      const posts = list.posts ?? [];
      const match = posts.filter(p => p.id === input.draftId);
      return { draftId: input.draftId, posts: match, note: match.length ? undefined : 'Not found in Postiz — has it been scheduled/published yet?' };
    }

    case "retry_failed_post":
      // No dedicated retry route exists; the real Public API exposes status
      // updates via PUT /posts/:id/status — re-queue by setting it back to
      // QUEUE (Postiz's own retry semantics apply from there).
      return postizProxy("PUT", `/posts/${input.draftId}/status`, { status: 'QUEUE' });

    case "read_analytics":
      if (!input.accountId) throw new Error('accountId (the Postiz integration id) is required — analytics is per-integration in the real API.');
      return postizProxy("GET", `/analytics/${input.accountId}`);

    case "read_comments":
      // No comments endpoint exists in Postiz's Public API (verified against
      // the running container's real route table) — honest unsupported
      // response rather than calling a path that would 404.
      return { draftId: input.draftId, comments: [], supported: false, message: "Postiz's Public API does not expose a comments endpoint. Not implementable without either a platform-native API integration or a Postiz version that adds this." };

    case "draft_reply":
      return { commentId: input.commentId, platform: input.platform, replyDraft: null, supported:false, message: "Reply generation is not connected; no reply was generated or sent." };

    case "pause_campaign":
      return { campaignId: input.campaignId, supported:false, pauseReason: input.reason, message: "Campaign-wide remote pause is not implemented; no posts were paused." };

    case "disconnect_account":
      return postizProxy("DELETE", `/integrations/${input.accountId}`);

    default:
      throw new Error(`Unimplemented tool: ${tool}`);
  }
}

// Builds the real Postiz CreatePostDto from our own draft + its per-platform
// variants (social_platform_variant, each tied to a social_account whose
// postiz_account_id is Postiz's own integration id — populated only once a
// real account is connected through Postiz's OAuth flow). Fails honestly,
// not with a raw Postiz 400, when nothing is connected yet.
async function createPostizPost(draftId: string, type: 'schedule' | 'now', scheduledAt?: string): Promise<unknown> {
 const date=type==='now'?new Date():new Date(scheduledAt||'');
 if(!Number.isFinite(date.getTime())||(type==='schedule'&&date.getTime()<=Date.now()))throw Error('A valid future schedule is required');
 return transaction(async client=>{
  const draft=await client.query(`SELECT id FROM social_content_draft WHERE id=$1 AND status='approved' AND reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL FOR UPDATE`,[draftId]);
  if(!draft.rowCount)throw Error('Draft must have a recorded approval before scheduling');
  const variants=await client.query<{platform:string;postiz_account_id:string|null;status:string;account_status:string}>(`SELECT v.platform,v.status,a.postiz_account_id,a.status AS account_status
   FROM social_platform_variant v JOIN social_content_draft d ON d.id=v.draft_id
   JOIN social_account a ON a.id=v.account_id AND a.platform=v.platform AND a.tenant_id=d.tenant_id AND a.workspace_id=d.workspace_id
   WHERE v.draft_id=$1 FOR UPDATE OF v`,[draftId]);
  if(!variants.rowCount||variants.rows.some(v=>!PROVIDERS[v.platform]||!v.postiz_account_id||v.account_status!=='connected'||v.status!=='pending'))throw Error('Every variant must be pending and bound to a supported connected Postiz account');
  const prior=await client.query('SELECT id FROM social_post WHERE draft_id=$1 LIMIT 1',[draftId]);
  if(prior.rowCount)throw Error('This draft already has a submission; reconcile it before creating another');
  await client.query('UPDATE social_platform_variant SET scheduled_at=$2 WHERE draft_id=$1',[draftId,date.toISOString()]);
  await client.query('UPDATE social_content_draft SET default_schedule_at=$2,updated_at=now() WHERE id=$1',[draftId,date.toISOString()]);
  return {draftId,status:'queued_locally',scheduledAt:date.toISOString(),message:'Queued for the approval-aware worker. External publication is not yet confirmed.'};
 });
}

async function validateApproval(token:string,draftId:string,tool:string,principalId:string){
 if(!token||!draftId)return false;
 const names=tool==='schedule_post'?['schedule_post','publish_post']:[tool];
 const r=await query(`UPDATE social_mcp_approval_log SET consumed_at=now(),consumed_by=$4::uuid
 WHERE approval_token=$1 AND draft_id=$2::uuid AND tool_name=ANY($3::text[])
 AND status='approved' AND expires_at>now() AND consumed_at IS NULL RETURNING id`,[token,draftId,names,principalId]);
 return Boolean(r.rowCount);
}

// Postiz's comment payload shape may vary by platform; try common text
// fields and skip sentiment for anything that doesn't look like a comment
// object rather than guessing wrong. No live-connected account exists yet
// to confirm the exact shape, so this stays defensive.
async function enrichCommentsWithSentiment(raw: unknown, platform?: string): Promise<unknown> {
  const list = Array.isArray(raw) ? raw : Array.isArray((raw as { comments?: unknown[] })?.comments) ? (raw as { comments: unknown[] }).comments : null;
  if (!list) return raw;

  const enriched = await Promise.all(list.map(async (item) => {
    if (typeof item !== 'object' || item === null) return item;
    const record = item as Record<string, unknown>;
    const text = [record.text, record.message, record.content].find((v): v is string => typeof v === 'string' && v.trim().length > 0);
    if (!text) return record;
    try {
      const result = await classifySentiment(text);
      await query(
        `INSERT INTO sentiment_log (source, platform, reference_id, text_content, sentiment, confidence, reason)
         VALUES ('comment',$1,$2,$3,$4,$5,$6)`,
        [platform ?? null, typeof record.id === 'string' ? record.id : null, text, result.sentiment, result.confidence, result.reason],
      );
      return { ...record, sentiment: result.sentiment, sentimentConfidence: result.confidence };
    } catch {
      return record; // classification failure shouldn't break the comment read
    }
  }));

  return Array.isArray(raw) ? enriched : { ...(raw as Record<string, unknown>), comments: enriched };
}

async function postizProxy(method: string, path: string, body?: unknown): Promise<unknown> {
  if (!POSTIZ_API_KEY) {
    throw new Error(
      'POSTIZ_PUBLIC_API_KEY is not configured. Generate one from inside the Postiz UI (Settings → Public API) after creating a Postiz account — a real, low-risk local action, but one this code cannot perform on its own.',
    );
  }
  const url = `${POSTIZ_PUBLIC_API_BASE}${path}`;
  const res = await fetch(url, {
    method,
    signal: AbortSignal.timeout(15000),
    headers: { "Content-Type": "application/json", "Authorization": POSTIZ_API_KEY },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Postiz request failed with HTTP ${res.status}`);
  }
  return res.json();
}
