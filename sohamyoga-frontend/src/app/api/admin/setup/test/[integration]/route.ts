export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';

const TIMEOUT = 5000;

async function testGmail(): Promise<Record<string, unknown>> {
  const clientId = process.env.GMAIL_CLIENT_ID;
  const clientSecret = process.env.GMAIL_CLIENT_SECRET;
  const refreshToken = process.env.GMAIL_REFRESH_TOKEN;
  const allSet = Boolean(clientId && clientSecret && refreshToken);
  return {
    ok: allSet,
    message: allSet
      ? 'All Gmail env vars are configured.'
      : 'One or more Gmail env vars are missing (GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN).',
  };
}

async function testWhatsapp(): Promise<Record<string, unknown>> {
  const token = process.env.WHATSAPP_TOKEN;
  if (!token) {
    return { ok: false, message: 'WHATSAPP_TOKEN is not set.' };
  }
  try {
    const url = `https://graph.facebook.com/v18.0/me?access_token=${encodeURIComponent(token)}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT) });
    const data = await res.json() as Record<string, unknown>;
    if (res.ok && data.id) {
      return { ok: true, accountName: data.name ?? data.id, message: 'WhatsApp token is valid.' };
    }
    const errMsg = (data.error as Record<string, unknown>)?.message ?? 'Unknown error';
    return { ok: false, message: `Graph API error: ${errMsg}` };
  } catch (e) {
    return { ok: false, message: `Request failed: ${e instanceof Error ? e.message : String(e)}` };
  }
}

async function testTwilio(): Promise<Record<string, unknown>> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) {
    return { ok: false, message: 'TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN is not set.' };
  }
  try {
    const credentials = Buffer.from(`${sid}:${token}`).toString('base64');
    const url = `https://api.twilio.com/2010-04-01/Accounts/${sid}.json`;
    const res = await fetch(url, {
      headers: { Authorization: `Basic ${credentials}` },
      signal: AbortSignal.timeout(TIMEOUT),
    });
    const data = await res.json() as Record<string, unknown>;
    if (res.ok && data.sid) {
      return { ok: true, accountName: data.friendly_name ?? sid, message: 'Twilio credentials are valid.' };
    }
    const errMsg = (data as Record<string, unknown>).message ?? 'Unknown error';
    return { ok: false, message: `Twilio API error: ${errMsg}` };
  } catch (e) {
    return { ok: false, message: `Request failed: ${e instanceof Error ? e.message : String(e)}` };
  }
}

async function testStripe(): Promise<Record<string, unknown>> {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    return { ok: false, message: 'STRIPE_SECRET_KEY is not set.' };
  }
  try {
    const res = await fetch('https://api.stripe.com/v1/account', {
      headers: { Authorization: `Bearer ${secretKey}` },
      signal: AbortSignal.timeout(TIMEOUT),
    });
    const data = await res.json() as Record<string, unknown>;
    if (res.ok && data.id) {
      return { ok: true, accountName: data.business_profile ? (data.business_profile as Record<string, unknown>).name ?? data.id : data.id, message: 'Stripe credentials are valid.' };
    }
    const errMsg = (data.error as Record<string, unknown>)?.message ?? 'Unknown error';
    return { ok: false, message: `Stripe API error: ${errMsg}` };
  } catch (e) {
    return { ok: false, message: `Request failed: ${e instanceof Error ? e.message : String(e)}` };
  }
}

async function testOllama(): Promise<Record<string, unknown>> {
  try {
    const res = await fetch('http://localhost:11434/api/tags', {
      signal: AbortSignal.timeout(TIMEOUT),
    });
    if (res.ok) {
      const data = await res.json() as { models?: { name: string }[] };
      const models = (data.models ?? []).map((m) => m.name);
      return { ok: true, models, message: `Ollama is running. ${models.length} model(s) available.` };
    }
    return { ok: false, models: [], message: `Ollama returned HTTP ${res.status}.` };
  } catch (e) {
    return { ok: false, models: [], message: `Ollama is not reachable: ${e instanceof Error ? e.message : String(e)}` };
  }
}

async function testSmtp(): Promise<Record<string, unknown>> {
  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM;
  const allSet = Boolean(host && port && user && pass && from);
  const missing = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'SMTP_FROM'].filter(k => !process.env[k]);
  return {
    ok: allSet,
    message: allSet
      ? `SMTP configured — host: ${host}:${port}, from: ${from}`
      : `Missing vars: ${missing.join(', ')}. Note: SMTP cannot be live-tested without sending an email.`,
  };
}

async function testGoogleDrive(): Promise<Record<string, unknown>> {
  const clientId = process.env.GOOGLE_DRIVE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_DRIVE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_DRIVE_REDIRECT_URI;
  const allSet = Boolean(clientId && clientSecret && redirectUri);
  return {
    ok: allSet,
    message: allSet
      ? 'All Google Drive env vars are configured.'
      : 'One or more Google Drive env vars are missing.',
  };
}

async function testGoogleAds(): Promise<Record<string, unknown>> {
  const clientId = process.env.GOOGLE_ADS_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_ADS_CLIENT_SECRET;
  const devToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
  const customerId = process.env.GOOGLE_ADS_CUSTOMER_ID;
  const allSet = Boolean(clientId && clientSecret && devToken && customerId);
  return {
    ok: allSet,
    message: allSet
      ? 'All Google Ads env vars are configured.'
      : 'One or more Google Ads env vars are missing.',
  };
}

async function testLinkedin(): Promise<Record<string, unknown>> {
  const clientId = process.env.LINKEDIN_CLIENT_ID;
  const clientSecret = process.env.LINKEDIN_CLIENT_SECRET;
  const allSet = Boolean(clientId && clientSecret);
  return {
    ok: allSet,
    message: allSet
      ? 'LinkedIn client credentials are configured.'
      : 'LINKEDIN_CLIENT_ID or LINKEDIN_CLIENT_SECRET is not set.',
  };
}

async function testYoutube(): Promise<Record<string, unknown>> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    return { ok: false, message: 'YOUTUBE_API_KEY is not set.' };
  }
  return { ok: true, message: 'YOUTUBE_API_KEY is configured.' };
}

async function testCalcom(): Promise<Record<string, unknown>> {
  const apiKey = process.env.CALCOM_API_KEY;
  if (!apiKey) {
    return { ok: false, message: 'CALCOM_API_KEY is not set.' };
  }
  return { ok: true, message: 'CALCOM_API_KEY is configured.' };
}

async function testSerpapi(): Promise<Record<string, unknown>> {
  const apiKey = process.env.SERPAPI_KEY;
  if (!apiKey) {
    return { ok: false, message: 'SERPAPI_KEY is not set. Review scraper will use mock data.' };
  }
  return { ok: true, message: 'SERPAPI_KEY is configured.' };
}

const TESTERS: Record<string, () => Promise<Record<string, unknown>>> = {
  gmail: testGmail,
  whatsapp: testWhatsapp,
  twilio: testTwilio,
  stripe: testStripe,
  ollama: testOllama,
  smtp: testSmtp,
  google_drive: testGoogleDrive,
  google_ads: testGoogleAds,
  linkedin: testLinkedin,
  youtube: testYoutube,
  calcom: testCalcom,
  serpapi: testSerpapi,
};

export async function POST(
  req: NextRequest,
  { params }: { params: { integration: string } },
): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const { integration } = params;
  const tester = TESTERS[integration];
  if (!tester) {
    return Response.json({ ok: false, message: `Unknown integration: ${integration}` }, { status: 404 });
  }

  try {
    const result = await tester();
    return Response.json(result);
  } catch (e) {
    return Response.json(
      { ok: false, message: `Test threw an error: ${e instanceof Error ? e.message : String(e)}` },
      { status: 500 },
    );
  }
}
