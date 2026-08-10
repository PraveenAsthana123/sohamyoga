// MCP Tool Registry — 15 tools for AI agent control of social media portal
// Compact interface: AI routes internally, not one tool per platform.
// All destructive actions (publish, delete, reply) require explicit approval.

export type McpToolName =
  | "list_social_accounts"
  | "create_content_draft"
  | "adapt_content"
  | "upload_media"
  | "preview_post"
  | "request_approval"
  | "schedule_post"
  | "publish_post"
  | "get_post_status"
  | "retry_failed_post"
  | "read_analytics"
  | "read_comments"
  | "draft_reply"
  | "pause_campaign"
  | "disconnect_account";

export interface McpToolDef {
  name: McpToolName;
  description: string;
  requiresApproval: boolean;
  isDestructive: boolean;
  inputSchema: Record<string, unknown>;
}

export const MCP_TOOLS: McpToolDef[] = [
  {
    name: "list_social_accounts",
    description: "List all connected social accounts, their platforms, connection status, and token expiry.",
    requiresApproval: false,
    isDestructive: false,
    inputSchema: {
      type: "object",
      properties: {
        tenantId: { type: "string", description: "Tenant UUID that owns this content" },
        workspaceId: { type: "string" },
        platform: { type: "string", description: "Filter by platform (optional)" },
        status: { type: "string", enum: ["connected", "expired", "error", "all"], default: "all" },
      },
      required: ["workspaceId"],
    },
  },
  {
    name: "create_content_draft",
    description: "Create a new content draft. Generates master text and targets one or more platforms. Returns draft ID for subsequent tools.",
    requiresApproval: false,
    isDestructive: false,
    inputSchema: {
      type: "object",
      properties: {
        workspaceId: { type: "string" },
        masterText: { type: "string", description: "Master copy before platform adaptation" },
        contentType: { type: "string", enum: ["text", "image", "video", "carousel", "story", "reel", "short"] },
        platforms: { type: "array", items: { type: "string" }, description: "Platform IDs to target" },
        campaignId: { type: "string" },
        generatedWithAI: { type: "boolean", default: true },
        tags: { type: "array", items: { type: "string" } },
      },
      required: ["tenantId", "workspaceId", "masterText", "contentType", "platforms"],
    },
  },
  {
    name: "adapt_content",
    description: "Rewrite master text for a specific platform — enforcing character limits, hashtags, tone, and aspect ratios.",
    requiresApproval: false,
    isDestructive: false,
    inputSchema: {
      type: "object",
      properties: {
        draftId: { type: "string" },
        platform: { type: "string" },
        tone: { type: "string", enum: ["professional", "casual", "inspirational", "educational", "promotional"] },
        includeHashtags: { type: "boolean", default: true },
        maxHashtags: { type: "number", default: 5 },
      },
      required: ["draftId", "platform"],
    },
  },
  {
    name: "upload_media",
    description: "Upload an image or video file and attach it to a draft. Returns media URL.",
    requiresApproval: false,
    isDestructive: false,
    inputSchema: {
      type: "object",
      properties: {
        draftId: { type: "string" },
        filePath: { type: "string", description: "Local or remote URL to media file" },
        mediaType: { type: "string", enum: ["image", "video"] },
        platform: { type: "string", description: "Target platform for dimension validation" },
      },
      required: ["draftId", "filePath", "mediaType"],
    },
  },
  {
    name: "preview_post",
    description: "Render a platform-specific preview of the post showing how it will appear to audience.",
    requiresApproval: false,
    isDestructive: false,
    inputSchema: {
      type: "object",
      properties: {
        draftId: { type: "string" },
        platform: { type: "string" },
      },
      required: ["draftId", "platform"],
    },
  },
  {
    name: "request_approval",
    description: "Send a draft to the approval inbox for human review. Post CANNOT be published without approval.",
    requiresApproval: true,
    isDestructive: false,
    inputSchema: {
      type: "object",
      properties: {
        draftId: { type: "string" },
        reviewerUserId: { type: "string", description: "User who should review this draft" },
        note: { type: "string", description: "Context note for the reviewer" },
        urgency: { type: "string", enum: ["low", "normal", "urgent"], default: "normal" },
      },
      required: ["draftId"],
    },
  },
  {
    name: "schedule_post",
    description: "Schedule an approved post for future publishing. Requires the post to be in 'approved' status.",
    requiresApproval: true,
    isDestructive: false,
    inputSchema: {
      type: "object",
      properties: {
        draftId: { type: "string" },
        scheduledAt: { type: "string", format: "date-time" },
        timezone: { type: "string", default: "UTC" },
        platforms: { type: "array", items: { type: "string" }, description: "Subset of platforms (if omitting some)" },
        confirmApprovalId: { type: "string", description: "Approved, unexpired token bound to this draft" },
      },
      required: ["draftId", "scheduledAt", "confirmApprovalId"],
    },
  },
  {
    name: "publish_post",
    description: "Immediately publish an approved post. REQUIRES prior human approval. Never publishes autonomously.",
    requiresApproval: true,
    isDestructive: true,
    inputSchema: {
      type: "object",
      properties: {
        draftId: { type: "string" },
        platforms: { type: "array", items: { type: "string" }, description: "Platforms to publish to now" },
        confirmApprovalId: { type: "string", description: "Approval token from the approval workflow — required" },
      },
      required: ["draftId", "confirmApprovalId"],
    },
  },
  {
    name: "get_post_status",
    description: "Get current status of a post across all target platforms — queued, publishing, published, or failed.",
    requiresApproval: false,
    isDestructive: false,
    inputSchema: {
      type: "object",
      properties: {
        draftId: { type: "string" },
      },
      required: ["draftId"],
    },
  },
  {
    name: "retry_failed_post",
    description: "Retry publishing on platforms where a post failed. Maximum 3 retries per platform.",
    requiresApproval: true,
    isDestructive: false,
    inputSchema: {
      type: "object",
      properties: {
        draftId: { type: "string" },
        platforms: { type: "array", items: { type: "string" }, description: "Specific failed platforms to retry (all if omitted)" },
      },
      required: ["draftId"],
    },
  },
  {
    name: "read_analytics",
    description: "Retrieve reach, impressions, clicks, engagement rate, and conversions for a post or campaign.",
    requiresApproval: false,
    isDestructive: false,
    inputSchema: {
      type: "object",
      properties: {
        draftId: { type: "string", description: "Specific post (optional)" },
        campaignId: { type: "string", description: "Campaign rollup (optional)" },
        platform: { type: "string" },
        dateFrom: { type: "string", format: "date" },
        dateTo: { type: "string", format: "date" },
        metrics: { type: "array", items: { type: "string", enum: ["impressions","reach","clicks","engagement","conversions","follower_change"] } },
      },
    },
  },
  {
    name: "read_comments",
    description: "Retrieve recent comments on a published post. Read-only — does NOT reply automatically.",
    requiresApproval: false,
    isDestructive: false,
    inputSchema: {
      type: "object",
      properties: {
        draftId: { type: "string" },
        platform: { type: "string" },
        limit: { type: "number", default: 20 },
        sentiment: { type: "string", enum: ["positive", "negative", "neutral", "all"], default: "all" },
      },
      required: ["draftId", "platform"],
    },
  },
  {
    name: "draft_reply",
    description: "Generate a reply draft to a comment. ONLY creates draft — never posts automatically. Human must approve and post manually.",
    requiresApproval: true,
    isDestructive: false,
    inputSchema: {
      type: "object",
      properties: {
        commentId: { type: "string" },
        platform: { type: "string" },
        tone: { type: "string", enum: ["professional", "warm", "concise", "empathetic"] },
        context: { type: "string", description: "Additional context for reply generation" },
      },
      required: ["commentId", "platform"],
    },
  },
  {
    name: "pause_campaign",
    description: "Pause all scheduled posts in a campaign. Useful during brand incidents or policy reviews.",
    requiresApproval: true,
    isDestructive: false,
    inputSchema: {
      type: "object",
      properties: {
        campaignId: { type: "string" },
        reason: { type: "string", description: "Reason for pause (required for audit log)" },
        pausedBy: { type: "string" },
      },
      required: ["campaignId", "reason"],
    },
  },
  {
    name: "disconnect_account",
    description: "Revoke and disconnect a social media account. Tokens are deleted. Scheduled posts on this account are cancelled.",
    requiresApproval: true,
    isDestructive: true,
    inputSchema: {
      type: "object",
      properties: {
        accountId: { type: "string" },
        reason: { type: "string" },
        confirmText: { type: "string", description: "Must be 'DISCONNECT' to confirm" },
      },
      required: ["accountId", "confirmText"],
    },
  },
];

// Lookup helper
export function getMcpTool(name: McpToolName): McpToolDef | undefined {
  return MCP_TOOLS.find(t => t.name === name);
}
