// Real execution for first-party (non-external-platform) MCP tools that
// have tier='auto' but, unlike external-platform-mcp.ts's 14 platforms,
// need no third-party credentials at all -- they just write to this
// portal's own tables. Kept separate from external-platform-mcp.ts because
// that file is explicitly scoped to the 14 non-Postiz external platforms;
// mixing an internal portal action in there would blur that boundary.
//
// First tool: build_utm_link (campaign-mcp-registry.ts) -- had a real
// tool definition and safetyNote since early in this project but, until
// 2026-09-07, no execution handler anywhere (confirmed by grep: no case
// for it in the gateway's execute route). Mirrors the exact insert logic
// already proven live in POST /api/admin/utm-tracking.
import { query } from '@/lib/postgres';
import { getPrimaryTenantId } from '@/domain/ingestion/Connector';

export interface InternalExecutionResult {
  executed: boolean;
  reason?: string;
  data?: unknown;
}

const INTERNAL_EXECUTABLE_TOOLS = new Set(['campaign.build_utm_link']);

export function isInternalToolExecutable(serverSlug: string, toolName: string): boolean {
  return INTERNAL_EXECUTABLE_TOOLS.has(`${serverSlug.replace('-mcp', '')}.${toolName}`);
}

async function executeBuildUtmLink(args: {
  baseUrl?: string; campaignId?: string; utmSource?: string; utmMedium?: string; utmContent?: string;
}): Promise<InternalExecutionResult> {
  const baseUrl = args.baseUrl?.trim();
  if (!baseUrl) return { executed: false, reason: 'baseUrl is required.' };
  // Same portal-owned-only rule as the manual /admin/utm-tracking form and
  // the tool's own declared safetyNote -- never builds a tracking link to
  // a third-party site.
  if (!baseUrl.startsWith('/') || baseUrl.startsWith('//')) {
    return { executed: false, reason: 'baseUrl must be a portal-owned relative path starting with "/" -- external URLs are rejected, per this tool\'s safetyNote.' };
  }
  const utmSource = args.utmSource?.trim() || 'social';
  const utmMedium = args.utmMedium?.trim() || 'organic';
  const utmCampaign = args.campaignId?.trim();
  if (!utmCampaign) return { executed: false, reason: 'campaignId is required.' };
  const utmContent = args.utmContent?.trim() || null;

  const tenantId = await getPrimaryTenantId();
  const params = new URLSearchParams({ utm_source: utmSource, utm_medium: utmMedium, utm_campaign: utmCampaign });
  if (utmContent) params.set('utm_content', utmContent);
  const [path, existingQuery] = baseUrl.split('?');
  const merged = existingQuery ? `${existingQuery}&${params.toString()}` : params.toString();
  const fullUrl = `${path}?${merged}`;

  const result = await query<{ id: string }>(
    `INSERT INTO utm_link (tenant_id, base_url, utm_source, utm_medium, utm_campaign, utm_content, full_url, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,'mcp:campaign-mcp') RETURNING id`,
    [tenantId, baseUrl, utmSource, utmMedium, utmCampaign, utmContent, fullUrl],
  );

  return { executed: true, data: { id: result.rows[0].id, fullUrl, trackingUrl: `/utm/${result.rows[0].id}` } };
}

export async function executeInternalTool(serverSlug: string, toolName: string, args: Record<string, unknown>): Promise<InternalExecutionResult> {
  const key = `${serverSlug.replace('-mcp', '')}.${toolName}`;
  switch (key) {
    case 'campaign.build_utm_link':
      return executeBuildUtmLink(args as { baseUrl?: string; campaignId?: string; utmSource?: string; utmMedium?: string; utmContent?: string });
    default:
      return { executed: false, reason: 'This internal tool has no execution handler yet.' };
  }
}
