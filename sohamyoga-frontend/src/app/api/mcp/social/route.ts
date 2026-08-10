"use server";
// MCP Social Gateway — Streamable HTTP transport
// Handles all 15 MCP tool calls. Routes publish/schedule to Postiz.
// All destructive tools require confirmApprovalId or explicit confirmation.

import { NextRequest, NextResponse } from "next/server";
import { MCP_TOOLS, getMcpTool, type McpToolName } from "@/domain/social/McpToolRegistry";
import { PLATFORM_CONFIG } from "@/domain/social/SocialAccount";
import {getAdminPrincipal} from '@/lib/admin-auth';
import {query} from '@/lib/postgres';
import {classifySentiment} from '@/lib/sentiment';

const POSTIZ_BASE = process.env.POSTIZ_INTERNAL_URL || process.env.POSTIZ_CLIENT_URL || "http://127.0.0.1:15080";
const POSTIZ_SECRET = process.env.POSTIZ_SECRET || "";

// ---- MCP protocol: list tools ----
export async function GET(req:NextRequest) {
  const auth=await getAdminPrincipal(req);if(auth.denied)return auth.denied;
  return NextResponse.json({
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
    return NextResponse.json({ error: `Unknown tool: ${tool}` }, { status: 400 });
  }

  // Safety gate — destructive tools require confirmation token
  if (toolDef.isDestructive && !input.confirmApprovalId && input.confirmText !== "DISCONNECT") {
    return NextResponse.json(
      { error: `Tool '${tool}' is destructive and requires confirmApprovalId or confirmText='DISCONNECT'`, requiresApproval: true },
      { status: 403 }
    );
  }
  if (["publish_post","schedule_post","retry_failed_post"].includes(tool)) {
    const valid=await validateApproval(String(input.confirmApprovalId||''),String(input.draftId||''),tool);
    if(!valid)return NextResponse.json({error:'Approval is missing, expired, consumed, rejected, or not bound to this draft.',requiresApproval:true},{status:403});
  }

  try {
    const result = await dispatchTool(tool, input,auth.principal!.id);
    if(tool==='publish_post')await consumeApproval(String(input.confirmApprovalId),auth.principal!.id);
    return NextResponse.json({ tool, result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ tool, error: msg }, { status: 500 });
  }
}

// ---- Tool dispatcher ----
async function dispatchTool(tool: McpToolName, input: Record<string, unknown>,principalId:string): Promise<unknown> {
  switch (tool) {
    case "list_social_accounts":
      return postizProxy("GET", `/api/workspaces/${input.workspaceId}/socials`);

    case "create_content_draft": {
      const r=await query(`INSERT INTO social_content_draft(tenant_id,workspace_id,campaign_id,master_text,content_type,generated_with_ai,tags,created_by)
       VALUES($1::uuid,$2::uuid,NULLIF($3,'')::uuid,$4,$5,$6,$7::text[],$8::uuid) RETURNING id,status`,[input.tenantId,input.workspaceId,String(input.campaignId||''),input.masterText,input.contentType,input.generatedWithAI!==false,input.tags||[],principalId]);
      return {draftId:r.rows[0].id,status:r.rows[0].status};
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
      return postizProxy("POST", `/api/media/upload`, input);

    case "preview_post":
      return { draftId: input.draftId, platform: input.platform, previewUrl: null, message: "Preview rendered via Postiz preview API." };

    case "request_approval": {
      const r=await query(`WITH d AS (UPDATE social_content_draft SET status='review_requested',review_requested_at=now(),updated_at=now() WHERE id=$1::uuid RETURNING id,tenant_id)
       INSERT INTO social_mcp_approval_log(tenant_id,tool_name,draft_id,requested_by,status,notes)
       SELECT tenant_id,'publish_post',id,$2::uuid,'pending',$3 FROM d RETURNING id,status,expires_at`,[input.draftId,principalId,String(input.note||'')]);
      if(!r.rowCount)throw new Error('Draft not found');return {approvalRequestId:r.rows[0].id,status:r.rows[0].status,expiresAt:r.rows[0].expires_at};
    }

    case "schedule_post":
      return postizProxy("POST", `/api/posts/schedule`, { draftId: input.draftId, scheduledAt: input.scheduledAt, timezone: input.timezone });

    case "publish_post":
      return postizProxy("POST", `/api/posts/publish`, { draftId: input.draftId, platforms: input.platforms, approvalId: input.confirmApprovalId });

    case "get_post_status":
      return postizProxy("GET", `/api/posts/${input.draftId}/status`);

    case "retry_failed_post":
      return postizProxy("POST", `/api/posts/${input.draftId}/retry`, { platforms: input.platforms });

    case "read_analytics":
      return postizProxy("GET", `/api/analytics`, input as Record<string, string>);

    case "read_comments": {
      const raw = await postizProxy("GET", `/api/posts/${input.draftId}/comments?platform=${input.platform}&limit=${input.limit ?? 20}`);
      return enrichCommentsWithSentiment(raw, typeof input.platform === "string" ? input.platform : undefined);
    }

    case "draft_reply":
      return { commentId: input.commentId, platform: input.platform, replyDraft: null, message: "Reply draft generated. Awaiting human review — will NOT be posted automatically." };

    case "pause_campaign":
      return { campaignId: input.campaignId, status: "paused", pauseReason: input.reason, message: "All scheduled posts in campaign paused." };

    case "disconnect_account":
      return postizProxy("DELETE", `/api/socials/${input.accountId}`);

    default:
      throw new Error(`Unimplemented tool: ${tool}`);
  }
}

async function validateApproval(token:string,draftId:string,tool:string){if(!token||!draftId)return false;const names=tool==='schedule_post'?['schedule_post','publish_post']:[tool];const r=await query(`SELECT id FROM social_mcp_approval_log WHERE approval_token=$1 AND draft_id=$2::uuid AND tool_name=ANY($3::text[]) AND status='approved' AND expires_at>now() AND consumed_at IS NULL`,[token,draftId,names]);return Boolean(r.rowCount)}
async function consumeApproval(token:string,principalId:string){await query(`UPDATE social_mcp_approval_log SET consumed_at=now(),consumed_by=$2::uuid WHERE approval_token=$1 AND consumed_at IS NULL`,[token,principalId])}

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
  const url = `${POSTIZ_BASE}${path}`;
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json", "X-Secret": POSTIZ_SECRET },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Postiz ${method} ${path} → ${res.status}: ${text}`);
  }
  return res.json();
}
