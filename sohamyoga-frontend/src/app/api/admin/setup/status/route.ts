export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';

const check = (key: string) => {
  const val = process.env[key];
  return {
    key,
    set: Boolean(val && val.length > 0),
    masked: val ? val.slice(0, 4) + '****' : null,
  };
};

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const integrations = [
    {
      id: 'gmail',
      name: 'Gmail / Google OAuth',
      emoji: '📧',
      category: 'communication',
      priority: 'high',
      devPortalUrl: 'https://console.cloud.google.com/apis/credentials',
      docsUrl: 'https://developers.google.com/gmail/api/quickstart/nodejs',
      vars: [
        check('GMAIL_CLIENT_ID'),
        check('GMAIL_CLIENT_SECRET'),
        check('GMAIL_REFRESH_TOKEN'),
      ],
      webhookUrl: null,
      steps: [
        'Go to Google Cloud Console → Create project',
        'Enable Gmail API in API Library',
        'Create OAuth 2.0 credentials (Desktop app)',
        'Download client_secret.json',
        'Run: npx gmail-oauth2-tokens to get refresh token',
        'Add GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN to .env.local',
      ],
    },
    {
      id: 'whatsapp',
      name: 'WhatsApp Business API',
      emoji: '💬',
      category: 'communication',
      priority: 'high',
      devPortalUrl: 'https://business.facebook.com/',
      docsUrl: 'https://developers.facebook.com/docs/whatsapp/cloud-api',
      vars: [
        check('WHATSAPP_TOKEN'),
        check('WHATSAPP_PHONE_NUMBER_ID'),
        check('WHATSAPP_VERIFY_TOKEN'),
      ],
      webhookUrl: '/api/admin/communications/webhooks/whatsapp',
      steps: [
        'Go to business.facebook.com → Create Business Account',
        'Add WhatsApp product to your Meta App',
        'Generate a permanent System User Token',
        'Note your Phone Number ID from WhatsApp dashboard',
        'Choose any string as WHATSAPP_VERIFY_TOKEN',
        'Register webhook URL in Meta App dashboard',
        'Add all 3 vars to .env.local',
      ],
    },
    {
      id: 'twilio',
      name: 'Twilio SMS & Phone',
      emoji: '📱',
      category: 'communication',
      priority: 'high',
      devPortalUrl: 'https://console.twilio.com/',
      docsUrl: 'https://www.twilio.com/docs/sms/quickstart/node',
      vars: [
        check('TWILIO_ACCOUNT_SID'),
        check('TWILIO_AUTH_TOKEN'),
        check('TWILIO_PHONE_NUMBER'),
      ],
      webhookUrl: '/api/admin/communications/webhooks/twilio',
      steps: [
        'Sign up at twilio.com/try-twilio (free $15 credit)',
        'Buy a phone number (~$1.15/month)',
        'Get Account SID and Auth Token from Console Dashboard',
        'Set SMS webhook URL to your domain + /api/admin/communications/webhooks/twilio',
        'Add TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER to .env.local',
      ],
    },
    {
      id: 'google_drive',
      name: 'Google Drive',
      emoji: '💾',
      category: 'storage',
      priority: 'medium',
      devPortalUrl: 'https://console.cloud.google.com/apis/credentials',
      docsUrl: 'https://developers.google.com/drive/api/quickstart/nodejs',
      vars: [
        check('GOOGLE_DRIVE_CLIENT_ID'),
        check('GOOGLE_DRIVE_CLIENT_SECRET'),
        check('GOOGLE_DRIVE_REDIRECT_URI'),
      ],
      webhookUrl: null,
      steps: [
        'Use same Google Cloud project as Gmail (or create new)',
        'Enable Google Drive API in API Library',
        'Create OAuth 2.0 credentials (Web app)',
        'Set redirect URI to your domain + /api/auth/google/callback',
        'Add GOOGLE_DRIVE_CLIENT_ID, GOOGLE_DRIVE_CLIENT_SECRET, GOOGLE_DRIVE_REDIRECT_URI to .env.local',
      ],
    },
    {
      id: 'google_ads',
      name: 'Google Ads',
      emoji: '🎯',
      category: 'advertising',
      priority: 'high',
      devPortalUrl: 'https://ads.google.com/',
      docsUrl: 'https://developers.google.com/google-ads/api/docs/get-started/introduction',
      vars: [
        check('GOOGLE_ADS_CLIENT_ID'),
        check('GOOGLE_ADS_CLIENT_SECRET'),
        check('GOOGLE_ADS_DEVELOPER_TOKEN'),
        check('GOOGLE_ADS_CUSTOMER_ID'),
      ],
      webhookUrl: null,
      steps: [
        'Create Google Ads account at ads.google.com',
        'Apply for API access at developers.google.com/google-ads/api/docs/get-started/dev-token',
        'Create OAuth credentials in same Google Cloud project',
        'Note your Customer ID (10-digit number in Google Ads top bar)',
        'Add all 4 vars to .env.local',
      ],
    },
    {
      id: 'linkedin',
      name: 'LinkedIn API',
      emoji: '💼',
      category: 'social',
      priority: 'medium',
      devPortalUrl: 'https://www.linkedin.com/developers/apps',
      docsUrl: 'https://learn.microsoft.com/en-us/linkedin/shared/authentication/authorization-code-flow',
      vars: [
        check('LINKEDIN_CLIENT_ID'),
        check('LINKEDIN_CLIENT_SECRET'),
      ],
      webhookUrl: null,
      steps: [
        'Go to linkedin.com/developers/apps → Create App',
        'Add your company page',
        'Request access to Marketing Developer Platform',
        'Note Client ID and Client Secret from Auth tab',
        'Add redirect URI: your domain + /api/auth/linkedin/callback',
        'Add LINKEDIN_CLIENT_ID, LINKEDIN_CLIENT_SECRET to .env.local',
      ],
    },
    {
      id: 'youtube',
      name: 'YouTube Data API',
      emoji: '▶️',
      category: 'social',
      priority: 'medium',
      devPortalUrl: 'https://console.cloud.google.com/apis/library/youtube.googleapis.com',
      docsUrl: 'https://developers.google.com/youtube/v3/getting-started',
      vars: [
        check('YOUTUBE_API_KEY'),
      ],
      webhookUrl: null,
      steps: [
        'Go to Google Cloud Console → API Library',
        'Enable "YouTube Data API v3"',
        'Create API Key credential (not OAuth — API Key is enough for public data)',
        'Optionally restrict key to YouTube Data API only',
        'Add YOUTUBE_API_KEY to .env.local',
      ],
    },
    {
      id: 'calcom',
      name: 'Cal.com Scheduling',
      emoji: '📅',
      category: 'scheduling',
      priority: 'medium',
      devPortalUrl: 'https://app.cal.com/settings/developer/api-keys',
      docsUrl: 'https://cal.com/docs/enterprise-features/api',
      vars: [
        check('CALCOM_API_KEY'),
      ],
      webhookUrl: '/api/admin/calendar-integration/webhook',
      steps: [
        'Log in at app.cal.com',
        'Go to Settings → Developer → API Keys',
        'Create a new API key',
        'Add CALCOM_API_KEY to .env.local',
        'Optionally set up webhook for booking events',
      ],
    },
    {
      id: 'stripe',
      name: 'Stripe Payments',
      emoji: '💳',
      category: 'payments',
      priority: 'high',
      devPortalUrl: 'https://dashboard.stripe.com/apikeys',
      docsUrl: 'https://stripe.com/docs/api',
      vars: [
        check('STRIPE_SECRET_KEY'),
        check('NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY'),
        check('STRIPE_WEBHOOK_SECRET'),
      ],
      webhookUrl: '/api/payments/webhook',
      steps: [
        'Create account at stripe.com',
        'Go to Dashboard → Developers → API Keys',
        'Copy Publishable key and Secret key',
        'Set up webhook endpoint in Stripe Dashboard → Webhooks',
        'Copy webhook signing secret',
        'Add all 3 vars to .env.local',
      ],
    },
    {
      id: 'smtp',
      name: 'SMTP Email Sending',
      emoji: '✉️',
      category: 'communication',
      priority: 'high',
      devPortalUrl: null,
      docsUrl: null,
      vars: [
        check('SMTP_HOST'),
        check('SMTP_PORT'),
        check('SMTP_USER'),
        check('SMTP_PASS'),
        check('SMTP_FROM'),
      ],
      webhookUrl: null,
      steps: [
        'Option A — Gmail SMTP: Host=smtp.gmail.com, Port=587, use App Password',
        'Option B — SendGrid: Host=smtp.sendgrid.net, Port=587, User=apikey, Pass=SG.xxx',
        'Option C — Mailgun: Host=smtp.mailgun.org, Port=587',
        'Add SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM to .env.local',
      ],
    },
    {
      id: 'ollama',
      name: 'Ollama Local AI',
      emoji: '🤖',
      category: 'ai',
      priority: 'high',
      devPortalUrl: 'https://ollama.com/download',
      docsUrl: 'https://github.com/ollama/ollama',
      vars: [],
      webhookUrl: null,
      ollamaCheck: true,
      steps: [
        'Download Ollama from ollama.com/download',
        'Run: ollama serve (starts on port 11434)',
        'Pull model: ollama pull llama3.2',
        'Verify: curl http://localhost:11434/api/tags',
        'Ollama URL is hardcoded to http://localhost:11434 (no env var needed)',
      ],
    },
    {
      id: 'serpapi',
      name: 'SerpAPI (Review Scraping)',
      emoji: '🔍',
      category: 'data',
      priority: 'low',
      devPortalUrl: 'https://serpapi.com/dashboard',
      docsUrl: 'https://serpapi.com/google-maps-reviews-api',
      vars: [
        check('SERPAPI_KEY'),
      ],
      webhookUrl: null,
      steps: [
        'Sign up at serpapi.com (100 free searches/month)',
        'Go to Dashboard → API Key',
        'Add SERPAPI_KEY to .env.local',
        'Without this key, review scraper uses mock data fallback',
      ],
    },
  ];

  let ollamaRunning = false;
  try {
    const r = await fetch('http://localhost:11434/api/tags', { signal: AbortSignal.timeout(2000) });
    ollamaRunning = r.ok;
  } catch {
    ollamaRunning = false;
  }

  const summary = {
    total: integrations.length,
    fullyConfigured:
      integrations.filter(i => i.vars.length > 0 && i.vars.every(v => v.set)).length +
      (ollamaRunning ? 1 : 0),
    partiallyConfigured: integrations.filter(
      i => i.vars.some(v => v.set) && !i.vars.every(v => v.set),
    ).length,
    notConfigured: integrations.filter(i => i.vars.length > 0 && i.vars.every(v => !v.set)).length,
  };

  return Response.json({ integrations, ollamaRunning, summary });
}
