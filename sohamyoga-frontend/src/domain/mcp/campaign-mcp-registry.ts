/**
 * Campaign MCP — Digital Marketing Command Centre.
 * 12 tools covering unified brief creation, AI platform adaptation, content
 * calendar management, approval workflow, campaign attribution, and analytics.
 *
 * Backed by: Postiz (social scheduling), Mautic (marketing automation),
 *            Listmonk (email), Strapi (CMS/content), Frappe CRM (leads),
 *            Matomo/PostHog (attribution), Ollama (local AI adaptation).
 *
 * Data residency: ALL campaign briefs, content variants, brand kit data,
 * calendar entries, UTM links, and lead records stay in LOCAL Postgres.
 * Only rendered content + recipient address + OAuth token leave the server.
 */
import { McpServerManifest, McpTool } from './types';

const TOOLS: McpTool[] = [
  {
    name: 'list_marketing_campaigns',
    description: 'List marketing campaign briefs: name, objective, status, channels, date range, and budget utilization.',
    tier: 'auto', riskLevel: 1,
    inputSchema: { type: 'object',
      properties: {
        status:    { type: 'string', enum: ['draft','approved','active','paused','completed','archived','all'], default: 'active' },
        objective: { type: 'string' },
        fromDate:  { type: 'string', format: 'date' },
        toDate:    { type: 'string', format: 'date' },
      },
    },
  },
  {
    name: 'get_marketing_campaign',
    description: 'Get a full marketing campaign brief: objective, channels, content sequence, budget, UTM slug, and content variants.',
    tier: 'auto', riskLevel: 1,
    inputSchema: { type: 'object', required: ['campaignId'],
      properties: { campaignId: { type: 'string' } },
    },
  },
  {
    name: 'create_marketing_brief',
    description: 'Create a new marketing campaign brief: name, objective, persona, offer, channels, budget, content sequence, and UTM slug.',
    tier: 'staff', riskLevel: 2,
    inputSchema: { type: 'object', required: ['name', 'objective', 'channels', 'startDate', 'endDate', 'utmCampaign'],
      properties: {
        name:             { type: 'string' },
        objective:        { type: 'string', enum: ['awareness','lead','registration','booking','sale','retention'] },
        offerType:        { type: 'string', enum: ['trial','membership','workshop','retreat','referral','promotional','educational'] },
        targetPersona:    { type: 'array', items: { type: 'string' } },
        channels:         { type: 'array', items: { type: 'string' } },
        contentSequence:  { type: 'array', items: { type: 'string' }, description: "e.g. ['teaser','launch','reminder','last_chance']" },
        budgetPlannedCAD: { type: 'number' },
        startDate:        { type: 'string', format: 'date' },
        endDate:          { type: 'string', format: 'date' },
        utmCampaign:      { type: 'string', description: 'slug-format UTM campaign name e.g. yoga_spring_2026' },
      },
    },
  },
  {
    name: 'adapt_content_for_platform',
    description: 'Use local Ollama to adapt a master message for a specific platform: applies character limits, hashtag style, tone, and brand kit guidelines. Returns DRAFT only — never publishes.',
    tier: 'auto', riskLevel: 1,
    inputSchema: { type: 'object', required: ['masterContent', 'platform'],
      properties: {
        masterContent: { type: 'string', description: 'The master campaign message to adapt' },
        platform:      { type: 'string', description: 'Target platform (instagram, linkedin, email, sms, ...)' },
        brandKitId:    { type: 'string', description: 'Brand kit ID for tone and hashtag guidance' },
        campaignId:    { type: 'string' },
        locale:        { type: 'string', default: 'en' },
      },
    },
    safetyNote: 'AI adaptation is DRAFT — human review required before approving for publish. Local Ollama only — no content sent to cloud AI.',
  },
  {
    name: 'get_content_calendar',
    description: 'Return the content calendar for a date range: entries per day with channel, content type, campaign, status, and assigned owner.',
    tier: 'auto', riskLevel: 1,
    inputSchema: { type: 'object', required: ['fromDate', 'toDate'],
      properties: {
        fromDate:   { type: 'string', format: 'date' },
        toDate:     { type: 'string', format: 'date' },
        channel:    { type: 'string' },
        campaignId: { type: 'string' },
        status:     { type: 'string', enum: ['planned','in_production','ready','scheduled','published','cancelled','all'], default: 'all' },
      },
    },
  },
  {
    name: 'add_calendar_entry',
    description: 'Add an entry to the content calendar: content type, channel, scheduled datetime, campaign link, title, and assigned owner.',
    tier: 'staff', riskLevel: 2,
    inputSchema: { type: 'object', required: ['contentType', 'channel', 'scheduledAt', 'title'],
      properties: {
        contentType:     { type: 'string', enum: ['social_post','email','sms','blog','banner','event','workshop','retreat'] },
        channel:         { type: 'string' },
        scheduledAt:     { type: 'string', format: 'date-time' },
        title:           { type: 'string' },
        campaignId:      { type: 'string' },
        contentVariantId:{ type: 'string' },
        assignedTo:      { type: 'string' },
        tags:            { type: 'array', items: { type: 'string' } },
      },
    },
  },
  {
    name: 'approve_campaign_schedule',
    description: 'Approve a campaign brief for live scheduling — transitions it from approved to active and unlocks content for publishing. Requires staff approval.',
    tier: 'staff_approval', riskLevel: 3,
    inputSchema: { type: 'object', required: ['campaignId', 'confirmApprovalId'],
      properties: {
        campaignId:        { type: 'string' },
        confirmApprovalId: { type: 'string', description: 'Approval token from MCP approval queue' },
        note:              { type: 'string' },
      },
    },
    safetyNote: 'Activating a campaign unlocks all scheduled content for publish — review all variants before approving',
  },
  {
    name: 'pause_all_campaign_posts',
    description: 'Emergency pause: immediately halt all scheduled content for a campaign across all channels. Requires admin approval.',
    tier: 'admin', riskLevel: 4,
    inputSchema: { type: 'object', required: ['campaignId', 'reason', 'confirmApprovalId'],
      properties: {
        campaignId:        { type: 'string' },
        reason:            { type: 'string' },
        confirmApprovalId: { type: 'string' },
      },
    },
    safetyNote: 'Pauses campaign and all pending social/email/SMS jobs — requires confirmApprovalId; audit-logged',
  },
  {
    name: 'get_campaign_attribution',
    description: 'Return attribution data for a campaign: UTM-tracked visits, lead captures, registrations, bookings, and revenue generated.',
    tier: 'auto', riskLevel: 1,
    inputSchema: { type: 'object', required: ['campaignId'],
      properties: {
        campaignId:  { type: 'string' },
        fromDate:    { type: 'string', format: 'date' },
        toDate:      { type: 'string', format: 'date' },
      },
    },
  },
  {
    name: 'build_utm_link',
    description: 'Generate a UTM-tagged URL for campaign attribution. UTM parameters stored locally for analytics.',
    tier: 'auto', riskLevel: 1,
    inputSchema: { type: 'object', required: ['baseUrl', 'campaignId'],
      properties: {
        baseUrl:    { type: 'string', description: 'Destination URL (must be portal domain)' },
        campaignId: { type: 'string' },
        utmSource:  { type: 'string', default: 'social' },
        utmMedium:  { type: 'string', default: 'organic' },
        utmContent: { type: 'string', description: 'Content variant label for A/B tracking' },
      },
    },
    safetyNote: 'Only builds UTM links to portal-owned domains — never builds tracking links to third-party sites',
  },
  {
    name: 'generate_campaign_copy',
    description: 'Use local Ollama to generate a master campaign message from a brief (objective, offer, persona, tone). Returns DRAFT only — never publishes automatically.',
    tier: 'auto', riskLevel: 1,
    inputSchema: { type: 'object', required: ['campaignId'],
      properties: {
        campaignId:    { type: 'string' },
        contentType:   { type: 'string', enum: ['social_post','email_subject','email_body','sms','banner_headline'], default: 'social_post' },
        locale:        { type: 'string', default: 'en' },
        toneOverride:  { type: 'string', description: 'Override brand kit tone (e.g. urgent, celebratory)' },
      },
    },
    safetyNote: 'AI copy is DRAFT — human review required. Local Ollama only — no campaign data sent to cloud AI. Health/wellness claims must be reviewed by qualified staff.',
  },
  {
    name: 'archive_marketing_campaign',
    description: 'Archive a completed or cancelled campaign. Soft-delete only — data retained for attribution and audit. Requires admin approval.',
    tier: 'admin', riskLevel: 4,
    inputSchema: { type: 'object', required: ['campaignId', 'confirmApprovalId'],
      properties: {
        campaignId:        { type: 'string' },
        confirmApprovalId: { type: 'string' },
        reason:            { type: 'string' },
      },
    },
    safetyNote: 'Archive is permanent for status purposes — data retained for compliance; audit-logged',
  },
];

export const CAMPAIGN_MCP: McpServerManifest = {
  id:          'campaign-mcp',
  slug:        'campaign-mcp',
  name:        'Campaign MCP',
  description: 'Digital Marketing Command Centre: unified brief creation, AI platform adaptation, content calendar, campaign scheduling, UTM attribution, and analytics.',
  version:     '1.0.0',
  tools:       TOOLS,
  backingServices: [
    'Postiz (social scheduling across 16+ platforms)',
    'Mautic (marketing automation and drip campaigns)',
    'Listmonk (email newsletters and campaigns)',
    'Strapi (CMS — blog and landing page content)',
    'Frappe CRM (lead capture and attribution)',
    'Matomo (UTM and conversion analytics — self-hosted)',
    'PostHog (funnel and attribution analytics — self-hosted)',
    'Ollama (local AI for content generation and platform adaptation)',
    'Activepieces (campaign automation workflows)',
  ],
  availability: 'custom',
  implementationNote: 'All campaign briefs, content variants, brand kit, calendar entries, UTM links, and lead records stored in local Postgres. Outbound social publishing goes through Postiz approval gateway. Email via Listmonk. Only rendered content leaves the server.',
};
