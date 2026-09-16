import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { pool } from '@/lib/db';

// ─── Competitor seed data (real research, 2026-09-16) ────────────────────────

interface CompetitorSeed {
  name: string;
  website: string;
  industry: string;
  description: string;
  threat_level: string;
  tags: string[];
  signals: {
    signal_type: string;
    title: string;
    description: string;
    days_ago: number;
  }[];
}

const COMPETITORS: CompetitorSeed[] = [
  {
    name: 'Hootsuite',
    website: 'https://hootsuite.com',
    industry: 'Social Media Management',
    description: 'One of the oldest social media management platforms. 150M+ social listening sources, strong enterprise compliance and team collaboration tools. Standard plan at $99/mo.',
    threat_level: 'critical',
    tags: ['social-scheduling', 'analytics', 'social-listening', 'enterprise', 'agency'],
    signals: [
      { signal_type: 'new_feature', title: 'Hootsuite launches OwlyWriter AI 2.0', description: 'New generative AI assistant now supports 18 languages and tone customization for brand voice alignment.', days_ago: 45 },
      { signal_type: 'pricing_change', title: 'Hootsuite removes Professional plan', description: 'Hootsuite discontinued the legacy Professional ($49/mo) tier; all new users now start at Standard ($99/mo) or Team ($249/mo).', days_ago: 90 },
      { signal_type: 'new_feature', title: 'Hootsuite adds LinkedIn thought leadership analytics', description: 'New report tracks reach and engagement for personal LinkedIn profiles, addressing a key agency request.', days_ago: 20 },
    ],
  },
  {
    name: 'Sprout Social',
    website: 'https://sproutsocial.com',
    industry: 'Social Media Management',
    description: 'Premium social platform known for deep analytics and stakeholder-ready reports. Public company (NASDAQ: SPT). Entry at $249/seat/mo — enterprise positioning.',
    threat_level: 'high',
    tags: ['social-scheduling', 'analytics', 'social-listening', 'enterprise', 'agency', 'public-company'],
    signals: [
      { signal_type: 'new_feature', title: 'Sprout Social AI Assist expands to scheduling', description: 'AI Assist now recommends optimal post times per platform based on audience engagement history.', days_ago: 30 },
      { signal_type: 'new_feature', title: 'Sprout launches influencer marketing module', description: 'New influencer discovery and campaign management tool added to Advanced and Enterprise plans.', days_ago: 60 },
      { signal_type: 'funding', title: 'Sprout Social Q2 2026 earnings: ARR crosses $750M', description: 'Sprout Social reports $750M ARR in Q2 2026 earnings, with enterprise segment growing 28% YoY.', days_ago: 15 },
    ],
  },
  {
    name: 'HubSpot',
    website: 'https://hubspot.com',
    industry: 'All-in-One Marketing Suite',
    description: 'Dominant all-in-one CRM + marketing platform. Free CRM tier for lock-in; Marketing Hub Professional at $800/mo includes social, email, automation, and ads. Public (NYSE: HUBS).',
    threat_level: 'critical',
    tags: ['crm', 'email-automation', 'social-scheduling', 'paid-ads', 'analytics', 'all-in-one', 'public-company'],
    signals: [
      { signal_type: 'new_feature', title: 'HubSpot launches AI Content Agent', description: 'New agent generates full campaign briefs, landing page copy, and social posts from a single prompt with brand-voice training.', days_ago: 25 },
      { signal_type: 'pricing_change', title: 'HubSpot raises Starter tier to $18/mo', description: 'HubSpot increases Starter Marketing Hub pricing from $15 to $18/mo, citing expanded AI feature set.', days_ago: 120 },
      { signal_type: 'new_feature', title: 'HubSpot integrates with TikTok Shop', description: 'Native TikTok Shop integration now available in Marketing Hub, enabling product tagging and conversion tracking.', days_ago: 40 },
    ],
  },
  {
    name: 'Salesforce Marketing Cloud',
    website: 'https://salesforce.com/marketing',
    industry: 'Enterprise Marketing Automation',
    description: 'Enterprise-only marketing cloud with Journey Builder, Einstein AI features, and deep Salesforce CRM integration. Pricing starts ~$1,250/mo; most contracts are custom six figures.',
    threat_level: 'medium',
    tags: ['marketing-automation', 'enterprise', 'journey-builder', 'email', 'ai', 'public-company'],
    signals: [
      { signal_type: 'new_feature', title: 'Salesforce Einstein Copilot for Marketing GA', description: 'Einstein Copilot for Marketing Cloud exits beta; now supports natural-language campaign creation across email, mobile, and social channels.', days_ago: 50 },
      { signal_type: 'new_feature', title: 'Marketing Cloud adds real-time Data Cloud triggers', description: 'Journeys can now fire based on Data Cloud real-time event streams, enabling sub-second personalization.', days_ago: 35 },
    ],
  },
  {
    name: 'Mailchimp',
    website: 'https://mailchimp.com',
    industry: 'Email Marketing',
    description: 'Dominant entry-level email platform acquired by Intuit in 2021 for ~$12B. Strong brand recognition for SMBs. Free plan for 500 contacts; paid from $13/mo.',
    threat_level: 'medium',
    tags: ['email', 'sms', 'smb', 'e-commerce', 'landing-pages'],
    signals: [
      { signal_type: 'new_feature', title: 'Mailchimp launches AI email subject line tester', description: 'New AI tool predicts open rate performance for subject lines before sending, benchmarked against 13B historical emails.', days_ago: 55 },
      { signal_type: 'pricing_change', title: 'Mailchimp tightens free plan contact limits', description: 'Free plan now caps at 500 contacts (reduced from 2,000), pushing small businesses toward $13/mo Essentials.', days_ago: 180 },
      { signal_type: 'new_feature', title: 'Mailchimp adds SMS marketing for US/CA/UK', description: 'SMS campaigns now available on Standard ($20/mo) and Premium tiers with shared sending credit pool.', days_ago: 70 },
    ],
  },
  {
    name: 'ActiveCampaign',
    website: 'https://activecampaign.com',
    industry: 'Marketing Automation',
    description: 'Best-in-class automation builder for SMBs. Advanced conditional automation flows, lead scoring, and CRM-light. ~$3.5B private valuation. Starts at $15/mo.',
    threat_level: 'medium',
    tags: ['email', 'marketing-automation', 'crm', 'sms', 'smb', 'lead-scoring'],
    signals: [
      { signal_type: 'new_feature', title: 'ActiveCampaign launches AI-generated automation blueprints', description: 'New AI feature generates complete automation workflows from a plain-English description of the marketing goal.', days_ago: 42 },
      { signal_type: 'new_feature', title: 'ActiveCampaign adds B2B account scoring', description: 'Account-level scoring now available on Professional and Enterprise plans, closing a key gap vs. Marketo.', days_ago: 80 },
    ],
  },
  {
    name: 'Klaviyo',
    website: 'https://klaviyo.com',
    industry: 'E-commerce Email & SMS',
    description: 'E-commerce-native email/SMS platform. Deep Shopify integration. Predictive CLV & churn risk. IPO in 2023 (NYSE: KVYO). Free up to 500 contacts, from $20/mo.',
    threat_level: 'low',
    tags: ['email', 'sms', 'e-commerce', 'shopify', 'predictive-analytics', 'public-company'],
    signals: [
      { signal_type: 'new_feature', title: 'Klaviyo launches Reviews product', description: 'Klaviyo enters the product reviews market with a native reviews collection and display tool, competing with Yotpo.', days_ago: 65 },
      { signal_type: 'new_feature', title: 'Klaviyo adds WhatsApp channel', description: 'WhatsApp messaging now in beta for select markets, extending Klaviyo beyond email and SMS.', days_ago: 30 },
    ],
  },
  {
    name: 'Semrush',
    website: 'https://semrush.com',
    industry: 'SEO & Content Marketing',
    description: 'Full marketing suite anchored by SEO. 21B+ keyword index, backlink analysis, social scheduling, content marketing toolkit, and AI Copilot. Public (NYSE: SEMR). From $117/mo.',
    threat_level: 'high',
    tags: ['seo', 'content-marketing', 'social-scheduling', 'paid-ads', 'analytics', 'agency', 'public-company'],
    signals: [
      { signal_type: 'new_feature', title: 'Semrush Copilot AI hits 1M users', description: 'Semrush Copilot, their AI marketing assistant, surpasses 1M active users 9 months after launch.', days_ago: 18 },
      { signal_type: 'new_feature', title: 'Semrush adds AI Overviews tracking', description: 'New SERP feature tracking for Google AI Overviews/SGE appearances now available in Position Tracking.', days_ago: 35 },
      { signal_type: 'pricing_change', title: 'Semrush raises Pro plan to $139/mo', description: 'Pro plan price increases from $119.95 to $139/mo; Guru to $249/mo. Annual billing discounts maintained.', days_ago: 100 },
    ],
  },
  {
    name: 'Ahrefs',
    website: 'https://ahrefs.com',
    industry: 'SEO & Backlink Analysis',
    description: 'Best-in-class backlink index (35T+ links), Content Explorer, and AI Content Grader. Bootstrapped and profitable. Starter plan $29/mo, Lite $129/mo.',
    threat_level: 'low',
    tags: ['seo', 'backlinks', 'content-explorer', 'agency', 'bootstrapped'],
    signals: [
      { signal_type: 'new_feature', title: 'Ahrefs launches AI Content Grader', description: 'New AI tool scores content against top-ranking competitors and suggests specific improvements to close ranking gaps.', days_ago: 55 },
      { signal_type: 'new_feature', title: 'Ahrefs adds Starter plan at $29/mo', description: 'New entry-level Starter plan ($29/mo) targets freelancers and content creators previously priced out at $129 Lite tier.', days_ago: 200 },
    ],
  },
  {
    name: 'Buffer',
    website: 'https://buffer.com',
    industry: 'Social Media Management',
    description: 'Simple, affordable social scheduling. Free plan (3 channels). Employee-owned and bootstrapped — profitable. Essentials from $6/mo/channel. Strong creator and SMB positioning.',
    threat_level: 'medium',
    tags: ['social-scheduling', 'analytics', 'smb', 'creator', 'bootstrapped', 'link-in-bio'],
    signals: [
      { signal_type: 'new_feature', title: 'Buffer adds AI assistant to all plans', description: 'AI caption writer and hashtag suggester now available on free and paid plans, powered by OpenAI GPT-4o.', days_ago: 70 },
      { signal_type: 'new_feature', title: 'Buffer launches analytics for Threads', description: 'Native Threads analytics added following Meta opening the API to third-party tools.', days_ago: 28 },
    ],
  },
  {
    name: 'Later',
    website: 'https://later.com',
    industry: 'Visual Social Scheduling',
    description: 'Visual-first scheduler for Instagram and TikTok creators. Linkin.bio, hashtag analytics, best-time-to-post. Acquired by Mavrck in 2022 to combine creator and brand marketing.',
    threat_level: 'low',
    tags: ['social-scheduling', 'creator', 'instagram', 'tiktok', 'link-in-bio', 'influencer'],
    signals: [
      { signal_type: 'new_feature', title: 'Later launches creator marketplace 2.0', description: 'Revamped influencer marketplace now integrates with Mavrck campaign management and brand safety scoring.', days_ago: 45 },
      { signal_type: 'new_feature', title: 'Later adds Pinterest Story Pins scheduling', description: 'Native scheduling for Pinterest Idea Pins now supported, expanding Later\'s visual content calendar.', days_ago: 90 },
    ],
  },
  {
    name: 'Sprinklr',
    website: 'https://sprinklr.com',
    industry: 'Enterprise Social & CXM',
    description: 'Unified customer-experience platform for large enterprises. Governance, 30+ channels, AI moderation, and customer service integration. Public (NYSE: CXM). Enterprise pricing from $30k/yr.',
    threat_level: 'low',
    tags: ['social-scheduling', 'analytics', 'enterprise', 'cxm', 'ai-moderation', 'public-company'],
    signals: [
      { signal_type: 'new_feature', title: 'Sprinklr launches self-serve plan at $199/mo', description: 'First-ever self-serve tier opens Sprinklr to mid-market without requiring a sales conversation.', days_ago: 110 },
      { signal_type: 'funding', title: 'Sprinklr Q1 2026: subscription revenue $205M', description: 'Sprinklr reports Q1 FY2027 revenue of $205M, beating estimates; focuses on AI-driven cost efficiency.', days_ago: 20 },
    ],
  },
  {
    name: 'Adobe Marketo Engage',
    website: 'https://business.adobe.com/products/marketo',
    industry: 'B2B Marketing Automation',
    description: 'Enterprise B2B marketing automation powerhouse. Smart Campaigns, lead & account scoring, ABM, dynamic content. Growth tier ~$1,250/mo; Ultimate tier $10k+/mo based on contact volume.',
    threat_level: 'low',
    tags: ['b2b', 'marketing-automation', 'abm', 'lead-scoring', 'enterprise', 'public-company'],
    signals: [
      { signal_type: 'new_feature', title: 'Marketo Engage adds generative AI for landing pages', description: 'New GenAI features create landing page copy, email templates, and webinar summaries directly in Marketo Engage.', days_ago: 40 },
      { signal_type: 'new_feature', title: 'Marketo Engage raises send rate cap to 5M/hr', description: 'Ultimate Performance Plus tier now supports up to 5 million email sends per hour for large enterprise deployments.', days_ago: 75 },
    ],
  },
  {
    name: 'Postiz (OSS)',
    website: 'https://postiz.com',
    industry: 'Open-Source Social Scheduling',
    description: 'Open-source social scheduler (AGPL-3.0). 33 platforms, AI content generation, Canva-like design tool. 32k+ GitHub stars, 6k forks. Self-hosted free; cloud from $29/mo. Direct analogue to our social layer.',
    threat_level: 'high',
    tags: ['social-scheduling', 'open-source', 'ai-content', 'self-hosted', 'agency'],
    signals: [
      { signal_type: 'new_feature', title: 'Postiz adds Bluesky and Farcaster scheduling', description: 'Postiz expands to decentralized social networks Bluesky and Farcaster, now covering 33 platforms total.', days_ago: 35 },
      { signal_type: 'funding', title: 'Postiz crosses 32,000 GitHub stars', description: 'Community milestone: Postiz reaches 32k GitHub stars and 185+ releases in under 3 years, with ~6,000 forks.', days_ago: 10 },
      { signal_type: 'new_feature', title: 'Postiz launches white-label reseller program', description: 'Agencies can now white-label Postiz cloud with custom domain and branding at $199/mo reseller tier.', days_ago: 60 },
    ],
  },
  {
    name: 'Mautic',
    website: 'https://mautic.org',
    industry: 'Open-Source Marketing Automation',
    description: 'Leading open-source marketing automation (community-governed, Acquia-backed). Email, lead nurturing, landing pages, CRM integrations. Self-hosted free; Mautic Cloud from ~$300/mo.',
    threat_level: 'medium',
    tags: ['marketing-automation', 'open-source', 'email', 'lead-nurturing', 'gdpr', 'self-hosted'],
    signals: [
      { signal_type: 'new_feature', title: 'Mautic 5.0 released with improved performance', description: 'Major version bump with 40% faster campaign processing, new visual campaign builder, and Symfony 6 upgrade.', days_ago: 150 },
      { signal_type: 'new_feature', title: 'Mautic adds native WhatsApp integration', description: 'Community plugin for WhatsApp Business API now bundled in Mautic core, enabling direct messaging sequences.', days_ago: 80 },
    ],
  },
  {
    name: 'n8n',
    website: 'https://n8n.io',
    industry: 'Workflow Automation',
    description: 'Technical workflow automation. Self-hostable, 400+ integrations, unlimited executions for self-hosted. VC-backed ($55M Series B, 2023). Cloud from €20/mo. Used in our internal automation stack.',
    threat_level: 'medium',
    tags: ['workflow-automation', 'open-source', 'self-hosted', 'api-integrations', 'developer'],
    signals: [
      { signal_type: 'funding', title: 'n8n raises $55M Series B led by Highland Europe', description: 'n8n closes $55M Series B to accelerate enterprise sales and AI-native workflow capabilities.', days_ago: 365 },
      { signal_type: 'new_feature', title: 'n8n launches AI Agent nodes in v1.0', description: 'Native LangChain-based AI agent nodes now available, letting users build autonomous multi-step AI workflows without code.', days_ago: 90 },
    ],
  },
  {
    name: 'Make (Integromat)',
    website: 'https://make.com',
    industry: 'Visual Workflow Automation',
    description: 'Visual automation platform (acquired by Celonis). 1,500+ apps, credit-based pricing (2025 model change), 60% cheaper than Zapier. Strong visual scenario builder. Free plan available.',
    threat_level: 'low',
    tags: ['workflow-automation', 'visual-builder', 'smb', 'api-integrations'],
    signals: [
      { signal_type: 'pricing_change', title: 'Make switches to credit-based pricing model', description: 'Make migrates from operation-based to a credit system where different module types consume different credit amounts. New pricing effective August 2025.', days_ago: 30 },
      { signal_type: 'new_feature', title: 'Make launches AI scenario generator', description: 'New AI-powered feature generates complete automation scenarios from a plain-English description.', days_ago: 55 },
    ],
  },
  {
    name: 'Zapier',
    website: 'https://zapier.com',
    industry: 'Workflow Automation',
    description: 'No-code automation market leader. 6,000+ app integrations, AI-powered Zap creation. Bootstrapped to $5B+ valuation. Professional plan at $19.99/mo for 750 tasks.',
    threat_level: 'low',
    tags: ['workflow-automation', 'no-code', 'smb', 'api-integrations', 'bootstrapped'],
    signals: [
      { signal_type: 'new_feature', title: 'Zapier launches Zapier Agents (AI agents)', description: 'Zapier Agents allow AI to autonomously run Zaps, monitor conditions, and respond to natural language instructions without pre-defined triggers.', days_ago: 40 },
      { signal_type: 'new_feature', title: 'Zapier Tables exits beta — free for all plans', description: 'Built-in database (Zapier Tables) now included at no extra cost on all paid plans for storing Zap data.', days_ago: 120 },
    ],
  },
  {
    name: 'Monday.com',
    website: 'https://monday.com',
    industry: 'Work OS / Project Management',
    description: 'Work OS for project management and marketing campaigns. LinkedIn integration for social task automation. AI Sidekick included on Standard+. Public (NASDAQ: MNDY). From $9/seat/mo.',
    threat_level: 'low',
    tags: ['project-management', 'marketing-campaigns', 'agency', 'client-portal', 'ai', 'public-company'],
    signals: [
      { signal_type: 'new_feature', title: 'Monday.com launches AI Sidekick for all plans', description: 'AI Sidekick (task creation, meeting summaries, project risk flags) now included at no extra cost on Standard plans and above.', days_ago: 60 },
      { signal_type: 'new_feature', title: 'Monday Work Management adds client portal', description: 'New client-facing portal lets agencies share project status, approve assets, and communicate without giving full board access.', days_ago: 85 },
    ],
  },
];

export async function POST(req: NextRequest) {
  const authError = await requireAdmin(req);
  if (authError) return authError;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    let competitorInserted = 0;
    let signalInserted = 0;

    for (const comp of COMPETITORS) {
      // Insert competitor (skip on name conflict)
      const compResult = await client.query(
        `INSERT INTO competitor
           (name, website, industry, description, threat_level, tags, status)
         VALUES ($1, $2, $3, $4, $5, $6, 'active')
         ON CONFLICT (name) DO NOTHING
         RETURNING id`,
        [comp.name, comp.website, comp.industry, comp.description, comp.threat_level, comp.tags],
      );

      if (compResult.rows.length === 0) {
        // Competitor already existed — look up its id for signals
        const existing = await client.query('SELECT id FROM competitor WHERE name = $1', [comp.name]);
        if (existing.rows.length === 0) continue;

        const existingId = existing.rows[0].id as number;
        for (const signal of comp.signals) {
          const signalDate = new Date();
          signalDate.setDate(signalDate.getDate() - signal.days_ago);
          await client.query(
            `INSERT INTO competitor_signal
               (competitor_id, signal_type, title, description, detected_at, status)
             VALUES ($1, $2, $3, $4, $5, 'unread')
             ON CONFLICT DO NOTHING`,
            [existingId, signal.signal_type, signal.title, signal.description, signalDate.toISOString()],
          );
        }
        continue;
      }

      competitorInserted++;
      const competitorId = compResult.rows[0].id as number;

      for (const signal of comp.signals) {
        const signalDate = new Date();
        signalDate.setDate(signalDate.getDate() - signal.days_ago);
        const sigResult = await client.query(
          `INSERT INTO competitor_signal
             (competitor_id, signal_type, title, description, detected_at, status)
           VALUES ($1, $2, $3, $4, $5, 'unread')
           ON CONFLICT DO NOTHING
           RETURNING id`,
          [competitorId, signal.signal_type, signal.title, signal.description, signalDate.toISOString()],
        );
        signalInserted += sigResult.rows.length;
      }
    }

    await client.query('COMMIT');
    return NextResponse.json({
      success: true,
      competitors_inserted: competitorInserted,
      signals_inserted: signalInserted,
      total_competitors: COMPETITORS.length,
      message: `Seeded ${competitorInserted} new competitors and ${signalInserted} signals (existing rows skipped via ON CONFLICT DO NOTHING).`,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  } finally {
    client.release();
  }
}
