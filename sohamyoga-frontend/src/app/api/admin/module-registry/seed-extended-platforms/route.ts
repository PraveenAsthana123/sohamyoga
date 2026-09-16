import { NextRequest} from 'next/server';
import { query } from '@/lib/postgres';

import { requireAdmin } from '@/lib/admin-auth';
export const dynamic = 'force-dynamic';

// Module registry seed for extended platform adapters (Task 8 of 28-platform coverage).
// Idempotent via ON CONFLICT (app, module_key) DO NOTHING.

const EXTENDED_PLATFORM_MODULES = [
  {
    app: 'sohamyoga-frontend',
    module_key: 'whatsapp-business',
    name: 'WhatsApp Business Messaging',
    description: 'Direct customer messaging via WhatsApp Cloud API — scheduled delivery, 24h window management, template messages, media dispatch. Analytics synced via WhatsAppMessageQueueJob.',
    built_status: 'real',
    has_admin_ui: true,
    has_user_ui: false,
    user_flow: 'Customers receive WhatsApp messages for order confirmations, class reminders, and marketing (with opt-in). No direct customer UI — messages arrive in WhatsApp app.',
    admin_flow: 'Admin navigates to /admin/social/whatsapp_business to draft, schedule, and review WhatsApp messages. WhatsAppMessageQueueJob dispatches scheduled messages. Admin sees delivery status and 24h window expiry alerts.',
    job_name: 'WhatsAppMessageQueueJob',
    report_location: '/admin/social/whatsapp_business?tab=report',
    dashboard_location: '/admin/social/whatsapp_business',
    schema_tables: ['social_post', 'unified_content_item', 'social_account'],
    demo_use_cases: [
      'Send class booking confirmation via WhatsApp',
      'Send marketing template to opted-in customers',
      'Monitor message delivery status and 24h window expiry',
    ],
    integration_platforms: ['whatsapp_business'],
  },
  {
    app: 'sohamyoga-frontend',
    module_key: 'pinterest-marketing',
    name: 'Pinterest Marketing & Pins',
    description: 'Visual content publishing to Pinterest via API v5 — pins, idea pins, video pins to boards. Analytics sync (impressions, saves, clicks, outbound_clicks) via PinterestPinSyncJob every 4 hours.',
    built_status: 'real',
    has_admin_ui: true,
    has_user_ui: false,
    user_flow: 'End customers discover content via Pinterest Search and feed. Pins drive website traffic with outbound click tracking.',
    admin_flow: 'Admin drafts pin content at /admin/social/pinterest, selects board, adds image URL and description. PinterestPinSyncJob refreshes analytics. Report tab shows pin performance over 30 days.',
    job_name: 'PinterestPinSyncJob',
    report_location: '/admin/social/pinterest?tab=report',
    dashboard_location: '/admin/social/pinterest',
    schema_tables: ['social_post', 'social_post_analytics', 'unified_content_item', 'social_account'],
    demo_use_cases: [
      'Schedule yoga pose pins with 2:3 vertical images',
      'View 30-day pin analytics dashboard (impressions, saves, outbound clicks)',
      'Publish idea pin with step-by-step yoga sequence pages',
    ],
    integration_platforms: ['pinterest'],
  },
  {
    app: 'sohamyoga-frontend',
    module_key: 'github-releases',
    name: 'GitHub Releases & Announcements',
    description: 'Automated GitHub release publishing — creates releases, syncs download stats to unified_content_item. GitHubReleaseSyncJob runs daily at 8am to detect new releases and cross-post them.',
    built_status: 'real',
    has_admin_ui: true,
    has_user_ui: false,
    user_flow: 'Developers and technical users see releases on GitHub repository. Release notes linked from social cross-posts drive traffic.',
    admin_flow: 'Admin can publish a GitHub release via /api/social/publish-extended or the social/github page. GitHubReleaseSyncJob auto-detects new releases daily and creates social_post records for cross-posting approval.',
    job_name: 'GitHubReleaseSyncJob',
    report_location: '/admin/social/github?tab=report',
    dashboard_location: '/admin/social/github',
    schema_tables: ['social_post', 'unified_content_item'],
    demo_use_cases: [
      'Publish a new platform release with changelog to GitHub',
      'Auto-detect release download count and sync to unified content metrics',
      'Cross-post release announcement to LinkedIn and Twitter',
    ],
    integration_platforms: ['github'],
  },
  {
    app: 'sohamyoga-frontend',
    module_key: 'gitlab-releases',
    name: 'GitLab Releases & Snippets',
    description: 'GitLab release publishing and snippet management via GitLab API v4. Credential-gated via GITLAB_TOKEN + GITLAB_PROJECT_ID.',
    built_status: 'real',
    has_admin_ui: true,
    has_user_ui: false,
    user_flow: 'Developer community sees releases on GitLab. Snippets shared for technical content distribution.',
    admin_flow: 'Admin publishes releases via /api/social/publish-extended with platform=gitlab. Status tracked in unified_content_item.',
    job_name: null,
    report_location: '/admin/social/gitlab?tab=report',
    dashboard_location: '/admin/social/gitlab',
    schema_tables: ['social_post', 'unified_content_item'],
    demo_use_cases: [
      'Publish a GitLab release with deployment notes',
      'Create a public snippet for sharing code examples',
    ],
    integration_platforms: ['gitlab'],
  },
  {
    app: 'sohamyoga-frontend',
    module_key: 'google-business-profile',
    name: 'Google Business Profile Posts',
    description: 'Google Business Profile post management — standard posts, events, offers, products. Insights synced via GoogleBusinessSyncJob daily at 9am (impressions, clicks, direction_requests, phone_calls).',
    built_status: 'real',
    has_admin_ui: true,
    has_user_ui: false,
    user_flow: 'Local customers discover business via Google Search and Maps. Business posts appear in knowledge panel and local pack results.',
    admin_flow: 'Admin drafts posts at /admin/social/google_business with CTA buttons (Call Now, Book, Order). GoogleBusinessSyncJob syncs insights. Report shows per-location engagement.',
    job_name: 'GoogleBusinessSyncJob',
    report_location: '/admin/social/google_business?tab=report',
    dashboard_location: '/admin/social/google_business',
    schema_tables: ['social_post', 'social_platform_analytics', 'unified_content_item', 'social_account'],
    demo_use_cases: [
      'Post a weekly yoga class schedule update to Google Business',
      'Publish a special offer with coupon code for local SEO',
      'Monitor direction requests and phone calls from Google Maps profile',
    ],
    integration_platforms: ['google_business'],
  },
  {
    app: 'sohamyoga-frontend',
    module_key: 'trustpilot-reviews',
    name: 'Trustpilot Review Management',
    description: 'Trustpilot review invitation dispatch, review sync, and urgent-response flagging. TrustpilotReviewSyncJob runs every 6h, auto-creates reputation_review table, flags low-rating reviews.',
    built_status: 'real',
    has_admin_ui: true,
    has_user_ui: false,
    user_flow: 'Customers receive review invitation emails after service. Reviews appear on Trustpilot and widget-embedded on business website.',
    admin_flow: 'Admin sends review invitations via /api/social/publish-extended. TrustpilotReviewSyncJob imports new reviews into reputation_review table. Urgent reviews (1-2 stars) flagged for 24h response SLA.',
    job_name: 'TrustpilotReviewSyncJob',
    report_location: '/admin/social/trustpilot?tab=report',
    dashboard_location: '/admin/social/trustpilot',
    schema_tables: ['reputation_review', 'unified_content_item'],
    demo_use_cases: [
      'Send automated review invitation after class booking completion',
      'Sync latest Trustpilot reviews and flag 1-star urgent responses',
      'View review volume and rating distribution dashboard',
    ],
    integration_platforms: ['trustpilot'],
  },
  {
    app: 'sohamyoga-frontend',
    module_key: 'vimeo-video-hosting',
    name: 'Vimeo Video Hosting & Analytics',
    description: 'Professional video hosting via Vimeo API with pull-URL upload. Analytics (plays, likes, comments, downloads) synced daily via VimeoAnalyticsSyncJob.',
    built_status: 'real',
    has_admin_ui: true,
    has_user_ui: false,
    user_flow: 'Class recordings and preview videos embedded from Vimeo with no competing ads. Password-protected links for premium content delivery.',
    admin_flow: 'Admin uploads videos via /api/social/publish-extended (pull URL approach). VimeoAnalyticsSyncJob syncs stats to unified_content_item. Showcase creation supported for organized portfolio delivery.',
    job_name: 'VimeoAnalyticsSyncJob',
    report_location: '/admin/social/vimeo?tab=report',
    dashboard_location: '/admin/social/vimeo',
    schema_tables: ['unified_content_item', 'social_post'],
    demo_use_cases: [
      'Upload yoga class recording to Vimeo via pull URL',
      'Monitor video plays and engagement analytics dashboard',
      'Create a showcase for organized class video delivery',
    ],
    integration_platforms: ['vimeo'],
  },
  {
    app: 'sohamyoga-frontend',
    module_key: 'patreon-creator',
    name: 'Patreon Creator Posts & Analytics',
    description: 'Patreon post publishing (public and patron-only) via OAuth2 API. Post stats (likes, comments, patron_count) synced daily via PatreonPostSyncJob.',
    built_status: 'real',
    has_admin_ui: true,
    has_user_ui: false,
    user_flow: 'Patrons receive posts in Patreon feed. Patron-only posts gated by subscription tier. Audio posts delivered to patron podcast feeds.',
    admin_flow: 'Admin publishes creator posts via /api/social/publish-extended. PatreonPostSyncJob syncs engagement metrics daily. Patron count tracked in social_platform_analytics.',
    job_name: 'PatreonPostSyncJob',
    report_location: '/admin/social/patreon?tab=report',
    dashboard_location: '/admin/social/patreon',
    schema_tables: ['unified_content_item', 'social_platform_analytics'],
    demo_use_cases: [
      'Publish exclusive patron-only yoga flow breakdown post',
      'Monitor monthly patron count growth in analytics dashboard',
      'Sync Patreon post engagement (likes, comments) to unified metrics',
    ],
    integration_platforms: ['patreon'],
  },
];

export async function POST(req: NextRequest) {

  const denied = await requireAdmin(req);
  if (denied) return denied;
  let inserted = 0;
  let skipped = 0;

  for (const mod of EXTENDED_PLATFORM_MODULES) {
    const result = await query(
      `INSERT INTO module_registry
         (app, module_key, name, description, built_status, has_admin_ui, has_user_ui,
          user_flow, admin_flow, job_name, report_location, dashboard_location,
          schema_tables, demo_use_cases, integration_platforms, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,now(),now())
       ON CONFLICT (app, module_key) DO NOTHING`,
      [
        mod.app, mod.module_key, mod.name, mod.description,
        mod.built_status, mod.has_admin_ui, mod.has_user_ui,
        mod.user_flow, mod.admin_flow, mod.job_name,
        mod.report_location, mod.dashboard_location,
        mod.schema_tables,
        JSON.stringify(mod.demo_use_cases),
        JSON.stringify(mod.integration_platforms),
      ],
    );

    if ((result.rowCount ?? 0) > 0) {
      inserted++;
    } else {
      skipped++;
    }
  }

  return Response.json({
    ok: true,
    inserted,
    skipped,
    total: EXTENDED_PLATFORM_MODULES.length,
    message: `Seeded ${inserted} new extended-platform module registry entries (${skipped} already existed).`,
  });
}
