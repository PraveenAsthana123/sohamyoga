// PostizProviderHealthJob — Daily 06:30 UTC
// Uses Ollama to analyse which social providers are missing configuration,
// generate prioritized setup guidance, and alert admin via in-app notification.
// Does NOT read, log, or transmit actual secret values.

import { Pool } from 'pg';
import { ollama } from '../OllamaClient';

const db = new Pool({ connectionString: process.env.DATABASE_URL });

// Postiz provider env variable pairs — from official Postiz documentation
const PROVIDERS = [
  { name: 'Telegram',   priority: 1, vars: ['TELEGRAM_BOT_TOKEN'],                              setupUrl: 'Open Telegram → @BotFather → /newbot',       reviewRequired: false },
  { name: 'Discord',    priority: 2, vars: ['DISCORD_CLIENT_ID', 'DISCORD_CLIENT_SECRET'],      setupUrl: 'discord.com/developers/applications',         reviewRequired: false },
  { name: 'Bluesky',    priority: 3, vars: ['BLUESKY_APP_PASSWORD'],                             setupUrl: 'bsky.app Settings → App Passwords',           reviewRequired: false },
  { name: 'Reddit',     priority: 4, vars: ['REDDIT_CLIENT_ID', 'REDDIT_CLIENT_SECRET'],        setupUrl: 'reddit.com/prefs/apps → web app',             reviewRequired: false },
  { name: 'YouTube',    priority: 5, vars: ['YOUTUBE_CLIENT_ID', 'YOUTUBE_CLIENT_SECRET'],      setupUrl: 'console.cloud.google.com → YouTube Data API v3', reviewRequired: false },
  { name: 'Facebook',   priority: 6, vars: ['FACEBOOK_APP_ID', 'FACEBOOK_APP_SECRET'],          setupUrl: 'developers.facebook.com → Business App',      reviewRequired: true  },
  { name: 'Instagram',  priority: 7, vars: ['FACEBOOK_APP_ID', 'FACEBOOK_APP_SECRET'],          setupUrl: 'Same app as Facebook — add Instagram Graph API product', reviewRequired: true  },
  { name: 'Threads',    priority: 8, vars: ['THREADS_APP_ID', 'THREADS_APP_SECRET'],            setupUrl: 'Same Meta app — add Threads API product',     reviewRequired: true  },
  { name: 'LinkedIn',   priority: 9, vars: ['LINKEDIN_CLIENT_ID', 'LINKEDIN_CLIENT_SECRET'],   setupUrl: 'linkedin.com/developers → Share on LinkedIn', reviewRequired: true  },
  { name: 'X',          priority: 10,vars: ['X_CLIENT_ID', 'X_CLIENT_SECRET'],                  setupUrl: 'developer.twitter.com → New Project + App',  reviewRequired: false },
  { name: 'TikTok',     priority: 11,vars: ['TIKTOK_CLIENT_ID', 'TIKTOK_CLIENT_SECRET'],        setupUrl: 'developers.tiktok.com → Content Posting API',reviewRequired: true  },
  { name: 'Pinterest',  priority: 12,vars: ['PINTEREST_CLIENT_ID', 'PINTEREST_CLIENT_SECRET'], setupUrl: 'developers.pinterest.com',                     reviewRequired: false },
  { name: 'Mastodon',   priority: 13,vars: ['MASTODON_CLIENT_ID', 'MASTODON_CLIENT_SECRET'],   setupUrl: 'YOUR_INSTANCE/settings/applications',          reviewRequired: false },
];

interface ProviderStatus {
  name:             string;
  priority:         number;
  isConfigured:     boolean;
  missingVars:      string[];
  reviewRequired:   boolean;
  setupUrl:         string;
}

function checkProviders(): ProviderStatus[] {
  return PROVIDERS.map(p => {
    const missingVars = p.vars.filter(v => !process.env[v]);
    return {
      name:           p.name,
      priority:       p.priority,
      isConfigured:   missingVars.length === 0,
      missingVars,
      reviewRequired: p.reviewRequired,
      setupUrl:       p.setupUrl,
    };
  });
}

const SYSTEM = `You are a technical setup assistant for a yoga studio's social media system.
Given a list of unconfigured social media providers, write a SHORT admin notification (max 200 words).
Format:
- First line: summary (X of 13 providers configured)
- Then: numbered list of next 3 to set up (simplest first)
- Last line: encouragement
Plain text only. No markdown. No secret values.`;

export async function run(): Promise<void> {
  const statuses = checkProviders();
  const configured = statuses.filter(s => s.isConfigured);
  const missing    = statuses.filter(s => !s.isConfigured).sort((a, b) => a.priority - b.priority);

  // Store status in DB (no secret values stored)
  for (const s of statuses) {
    await db.query(`
      INSERT INTO postiz_provider_status
        (provider_name, is_configured, missing_vars, review_required, checked_at)
      VALUES ($1, $2, $3, $4, NOW())
      ON CONFLICT (provider_name) DO UPDATE SET
        is_configured=$2, missing_vars=$3, checked_at=NOW()
    `, [s.name, s.isConfigured, s.missingVars, s.reviewRequired]);
  }

  // Only notify if something changed or weekly
  if (missing.length === 0) {
    console.log(`[postiz-health] All ${configured.length} providers configured ✓`);
    return;
  }

  // Generate Ollama guidance message
  const context = [
    `Configured (${configured.length}): ${configured.map(s => s.name).join(', ') || 'none'}`,
    `Missing (${missing.length}): ${missing.map(s => `${s.name} (missing: ${s.missingVars.join(', ')}${s.reviewRequired ? ', needs app review' : ''})`).join(' | ')}`,
    `Next 3 to set up: ${missing.slice(0, 3).map(s => `${s.name} — ${s.setupUrl}`).join('; ')}`,
  ].join('\n');

  const guidance = await ollama.generate(context, {
    tier: 'fast', system: SYSTEM, maxTokens: 300, timeoutMs: 30_000,
  });

  // Queue admin notification — `student` has no role column at all; admin
  // identity lives on app_user (role enum: owner/admin/staff/teacher/
  // student/guest).
  const admins = await db.query<{ id: string; tenant_id: string; email: string }>(
    `SELECT DISTINCT ON (tenant_id) id, tenant_id, email FROM app_user WHERE role='admin' AND status='active'`,
  );
  for (const a of admins.rows) {
    await db.query(
      `INSERT INTO notification_queue
         (tenant_id, template_slug, channel, type, recipient_user_id, recipient_address, payload, idempotency_key)
       VALUES ($1,'postiz_setup_reminder','in_app','alert',$2,$3,$4,$5)
       ON CONFLICT (tenant_id, idempotency_key) DO NOTHING`,
      [a.tenant_id, a.id, a.email,
        JSON.stringify({
          configuredCount: configured.length, missingCount: missing.length, guidance,
          nextProvider: missing[0]?.name ?? '', nextSetupUrl: missing[0]?.setupUrl ?? '',
        }),
        `postiz_health_${a.tenant_id}_${new Date().toISOString().slice(0, 10)}`],
    );
  }

  console.log(`[postiz-health] ${configured.length}/13 configured, ${missing.length} missing — guidance queued`);
  // Do NOT db.end() here — runner.ts caches this module across every
  // scheduled invocation in the long-lived cron container; ending the pool
  // breaks every run after the first.
}
