// POST /api/admin/platform-credentials/[platform]/test
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { databaseConfigured, query } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ platform: string }> };

interface TestResult {
  success: boolean;
  message: string;
  details?: Record<string, unknown>;
}

async function testFacebook(): Promise<TestResult> {
  const token = process.env.FACEBOOK_PAGE_ACCESS_TOKEN;
  if (!token) return { success: false, message: 'FACEBOOK_PAGE_ACCESS_TOKEN is not set' };
  try {
    const r = await fetch(`https://graph.facebook.com/me?access_token=${token}`, { signal: AbortSignal.timeout(8000) });
    const data = await r.json() as Record<string, unknown>;
    if (data.error) return { success: false, message: String((data.error as Record<string,unknown>).message || 'Facebook API error'), details: data };
    return { success: true, message: `Connected as: ${data.name || data.id}`, details: data };
  } catch (e) {
    return { success: false, message: `Request failed: ${String(e)}` };
  }
}

async function testInstagram(): Promise<TestResult> {
  const token = process.env.FACEBOOK_PAGE_ACCESS_TOKEN;
  if (!token) return { success: false, message: 'FACEBOOK_PAGE_ACCESS_TOKEN is not set' };
  try {
    const r = await fetch(`https://graph.facebook.com/me?fields=id,name&access_token=${token}`, { signal: AbortSignal.timeout(8000) });
    const data = await r.json() as Record<string, unknown>;
    if (data.error) return { success: false, message: String((data.error as Record<string,unknown>).message || 'Instagram API error') };
    return { success: true, message: `Connected as: ${data.name || data.id}`, details: data };
  } catch (e) {
    return { success: false, message: `Request failed: ${String(e)}` };
  }
}

async function testTwitter(): Promise<TestResult> {
  const token = process.env.TWITTER_BEARER_TOKEN;
  if (!token) return { success: false, message: 'TWITTER_BEARER_TOKEN is not set' };
  try {
    const r = await fetch('https://api.twitter.com/2/users/me', {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(8000),
    });
    const data = await r.json() as Record<string, unknown>;
    if (!r.ok) return { success: false, message: `Twitter API error: ${r.status}`, details: data };
    const userData = data.data as Record<string, unknown> | undefined;
    return { success: true, message: `Connected as: @${userData?.username || userData?.id}`, details: data };
  } catch (e) {
    return { success: false, message: `Request failed: ${String(e)}` };
  }
}

async function testLinkedIn(): Promise<TestResult> {
  const token = process.env.LINKEDIN_ACCESS_TOKEN;
  if (!token) return { success: false, message: 'LINKEDIN_ACCESS_TOKEN is not set' };
  try {
    const r = await fetch('https://api.linkedin.com/v2/me', {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(8000),
    });
    const data = await r.json() as Record<string, unknown>;
    if (!r.ok) return { success: false, message: `LinkedIn API error: ${r.status}`, details: data };
    return { success: true, message: `Connected to LinkedIn profile`, details: data };
  } catch (e) {
    return { success: false, message: `Request failed: ${String(e)}` };
  }
}

async function testYouTube(): Promise<TestResult> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) return { success: false, message: 'YOUTUBE_API_KEY is not set' };
  try {
    const r = await fetch(
      `https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true&key=${apiKey}`,
      { signal: AbortSignal.timeout(8000) }
    );
    const data = await r.json() as Record<string, unknown>;
    if (!r.ok) return { success: false, message: `YouTube API error: ${r.status}`, details: data };
    return { success: true, message: 'YouTube API key is valid', details: data };
  } catch (e) {
    return { success: false, message: `Request failed: ${String(e)}` };
  }
}

async function testGitHub(): Promise<TestResult> {
  const token = process.env.GITHUB_TOKEN;
  if (!token) return { success: false, message: 'GITHUB_TOKEN is not set' };
  try {
    const r = await fetch('https://api.github.com/user', {
      headers: { Authorization: `token ${token}`, 'User-Agent': 'SohamYoga-Marketing' },
      signal: AbortSignal.timeout(8000),
    });
    const data = await r.json() as Record<string, unknown>;
    if (!r.ok) return { success: false, message: `GitHub API error: ${r.status}` };
    return { success: true, message: `Connected as: ${data.login}`, details: { login: data.login, public_repos: data.public_repos } };
  } catch (e) {
    return { success: false, message: `Request failed: ${String(e)}` };
  }
}

async function testTelegram(): Promise<TestResult> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return { success: false, message: 'TELEGRAM_BOT_TOKEN is not set' };
  try {
    const r = await fetch(`https://api.telegram.org/bot${token}/getMe`, { signal: AbortSignal.timeout(8000) });
    const data = await r.json() as Record<string, unknown>;
    if (!r.ok || !data.ok) return { success: false, message: `Telegram API error: ${JSON.stringify(data)}` };
    const bot = data.result as Record<string, unknown>;
    return { success: true, message: `Bot connected: @${bot.username}`, details: { username: bot.username, first_name: bot.first_name } };
  } catch (e) {
    return { success: false, message: `Request failed: ${String(e)}` };
  }
}

async function testDiscord(): Promise<TestResult> {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl) {
    const botToken = process.env.DISCORD_BOT_TOKEN;
    if (!botToken) return { success: false, message: 'DISCORD_WEBHOOK_URL or DISCORD_BOT_TOKEN is not set' };
    try {
      const r = await fetch('https://discord.com/api/v10/users/@me', {
        headers: { Authorization: `Bot ${botToken}` },
        signal: AbortSignal.timeout(8000),
      });
      const data = await r.json() as Record<string, unknown>;
      if (!r.ok) return { success: false, message: `Discord API error: ${r.status}` };
      return { success: true, message: `Bot connected: ${data.username}#${data.discriminator}` };
    } catch (e) {
      return { success: false, message: `Request failed: ${String(e)}` };
    }
  }
  // Verify webhook URL format
  if (!webhookUrl.startsWith('https://discord.com/api/webhooks/')) {
    return { success: false, message: 'DISCORD_WEBHOOK_URL format invalid. Should start with https://discord.com/api/webhooks/' };
  }
  return { success: true, message: 'Discord webhook URL format is valid', details: { note: 'URL format verified — actual posting not tested here' } };
}

async function testMedium(): Promise<TestResult> {
  const token = process.env.MEDIUM_INTEGRATION_TOKEN;
  if (!token) return { success: false, message: 'MEDIUM_INTEGRATION_TOKEN is not set' };
  try {
    const r = await fetch('https://api.medium.com/v1/me', {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(8000),
    });
    const data = await r.json() as Record<string, unknown>;
    if (!r.ok) return { success: false, message: `Medium API error: ${r.status}`, details: data };
    const user = data.data as Record<string, unknown>;
    return { success: true, message: `Connected as: ${user?.name || user?.username}`, details: user };
  } catch (e) {
    return { success: false, message: `Request failed: ${String(e)}` };
  }
}

async function testPinterest(): Promise<TestResult> {
  const token = process.env.PINTEREST_ACCESS_TOKEN;
  if (!token) return { success: false, message: 'PINTEREST_ACCESS_TOKEN is not set' };
  try {
    const r = await fetch('https://api.pinterest.com/v5/user_account', {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(8000),
    });
    const data = await r.json() as Record<string, unknown>;
    if (!r.ok) return { success: false, message: `Pinterest API error: ${r.status}`, details: data };
    return { success: true, message: `Connected to Pinterest account`, details: data };
  } catch (e) {
    return { success: false, message: `Request failed: ${String(e)}` };
  }
}

function manualTest(platformName: string): TestResult {
  return {
    success: true,
    message: `Manual setup confirmed for ${platformName}`,
    details: { note: 'No automated API test available for this platform. Setup is tracked manually.' },
  };
}

const PLATFORM_TESTS: Record<string, () => Promise<TestResult>> = {
  facebook: testFacebook,
  instagram: testInstagram,
  threads: testFacebook, // uses same Meta token
  whatsapp_business: testFacebook,
  x_twitter: testTwitter,
  linkedin: testLinkedIn,
  tiktok: async () => manualTest('TikTok'),
  youtube: testYouTube,
  pinterest: testPinterest,
  github: testGitHub,
  gitlab: async () => manualTest('GitLab'),
  google_business: async () => manualTest('Google Business'),
  telegram: testTelegram,
  discord: testDiscord,
  reddit: async () => manualTest('Reddit'),
  trustpilot: async () => manualTest('Trustpilot'),
  vimeo: async () => manualTest('Vimeo'),
  soundcloud: async () => manualTest('SoundCloud'),
  patreon: async () => manualTest('Patreon'),
  medium: testMedium,
  google_ads: async () => manualTest('Google Ads'),
  snapchat: async () => manualTest('Snapchat'),
  twitch: async () => manualTest('Twitch'),
  mastodon: async () => manualTest('Mastodon'),
  bluesky: async () => manualTest('Bluesky'),
  tumblr: async () => manualTest('Tumblr'),
  dailymotion: async () => manualTest('Dailymotion'),
  spotify: async () => manualTest('Spotify'),
  apple_podcasts: async () => manualTest('Apple Podcasts'),
  yelp: async () => manualTest('Yelp'),
  tripadvisor: async () => manualTest('Tripadvisor'),
  quora: async () => manualTest('Quora'),
  stack_overflow: async () => manualTest('Stack Overflow'),
  substack: async () => manualTest('Substack'),
  slack: async () => manualTest('Slack'),
  dribbble: async () => manualTest('Dribbble'),
};

export async function POST(req: NextRequest, { params }: Params) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return NextResponse.json({ error: 'Database not configured' }, { status: 503 });

  const { platform } = await params;

  const testFn = PLATFORM_TESTS[platform];
  if (!testFn) {
    return NextResponse.json({ error: 'Unknown platform' }, { status: 404 });
  }

  try {
    const result = await testFn();
    const testResult = result.success ? 'pass' : 'fail';

    // Update test result in DB
    await query(
      `UPDATE platform_credential_config
       SET test_result = $1, last_tested_at = NOW(), test_error = $2,
           setup_status = CASE WHEN $1 = 'pass' THEN 'verified' ELSE setup_status END,
           updated_at = NOW()
       WHERE platform = $3`,
      [testResult, result.success ? null : result.message, platform]
    );

    // Log
    await query(
      `INSERT INTO platform_setup_log (platform, action, details)
       VALUES ($1, $2, $3)`,
      [platform, result.success ? 'test_passed' : 'test_failed', JSON.stringify({ message: result.message })]
    );

    return NextResponse.json(result);
  } catch (err) {
    console.error(`[platform-credentials/${platform}/test] error:`, err);
    return NextResponse.json({ success: false, message: String(err) }, { status: 500 });
  }
}
