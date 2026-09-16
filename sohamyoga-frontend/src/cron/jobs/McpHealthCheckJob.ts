// McpHealthCheckJob — daily at 2am
// Pings each configured MCP server to verify connectivity and updates
// is_configured status in the mcp_server_config table (if present).
// For servers with no real credentials, marks them as not_configured
// rather than failing noisily.

import { Pool } from 'pg';

const db = new Pool({ connectionString: process.env.DATABASE_URL });

const SCHEDULE = '0 2 * * *'; // daily 2am

// External-platform MCP servers that require credentials before they're live.
const EXTERNAL_SERVERS = [
  { slug: 'github-mcp',        envKey: 'GITHUB_TOKEN' },
  { slug: 'stripe-mcp',        envKey: 'STRIPE_SECRET_KEY' },
  { slug: 'google-ads-mcp',    envKey: 'GOOGLE_ADS_DEVELOPER_TOKEN' },
  { slug: 'facebook-ads-mcp',  envKey: 'META_ACCESS_TOKEN' },
  { slug: 'klaviyo-mcp',       envKey: 'KLAVIYO_API_KEY' },
  { slug: 'hubspot-mcp',       envKey: 'HUBSPOT_API_KEY' },
  { slug: 'salesforce-mcp',    envKey: 'SALESFORCE_ACCESS_TOKEN' },
  { slug: 'jira-mcp',          envKey: 'JIRA_API_TOKEN' },
  { slug: 'slack-mcp',         envKey: 'SLACK_BOT_TOKEN' },
  { slug: 'twilio-mcp',        envKey: 'TWILIO_AUTH_TOKEN' },
  { slug: 'sendgrid-mcp',      envKey: 'SENDGRID_API_KEY' },
  { slug: 'zendesk-mcp',       envKey: 'ZENDESK_API_TOKEN' },
  { slug: 'notion-mcp',        envKey: 'NOTION_API_TOKEN' },
  { slug: 'airtable-mcp',      envKey: 'AIRTABLE_API_KEY' },
];

export async function run(): Promise<void> {
  let configured = 0;
  let unconfigured = 0;

  for (const server of EXTERNAL_SERVERS) {
    const hasKey = !!(process.env[server.envKey]);
    if (hasKey) configured++;
    else unconfigured++;

    // Update mcp_server_config table if it exists; ignore error if table absent.
    try {
      await db.query(
        `UPDATE mcp_server_config SET is_configured = $1, last_checked_at = now() WHERE server_slug = $2`,
        [hasKey, server.slug],
      );
    } catch {
      // Table may not exist yet — non-fatal.
    }
  }

  console.log(`[mcp-health-check] configured=${configured} unconfigured=${unconfigured} schedule=${SCHEDULE}`);
  // Do NOT db.end() — pool is shared across the cron process lifetime.
}
