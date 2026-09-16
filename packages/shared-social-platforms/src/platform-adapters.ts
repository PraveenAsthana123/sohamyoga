// Platform adapter utilities — credential checking, routing logic.
// No actual fetch calls here — the fetch implementation lives in each app.
// Pure TypeScript, no React, no Next.js.

import type { AdapterReadiness, PlatformKey } from './types';
import { PLATFORM_REGISTRY } from './platform-registry';

// Required environment variables per platform
export const PLATFORM_REQUIRED_CREDENTIALS: Record<string, string[]> = {
  facebook: ['FACEBOOK_APP_ID', 'FACEBOOK_PAGE_ACCESS_TOKEN'],
  instagram: ['FACEBOOK_APP_ID', 'FACEBOOK_PAGE_ACCESS_TOKEN', 'INSTAGRAM_ACCOUNT_ID'],
  x_twitter: ['TWITTER_CLIENT_ID', 'TWITTER_CLIENT_SECRET', 'TWITTER_ACCESS_TOKEN', 'TWITTER_ACCESS_TOKEN_SECRET'],
  linkedin: ['LINKEDIN_CLIENT_ID', 'LINKEDIN_CLIENT_SECRET', 'LINKEDIN_ACCESS_TOKEN'],
  youtube: ['YOUTUBE_CLIENT_ID', 'YOUTUBE_CLIENT_SECRET', 'YOUTUBE_API_KEY'],
  tiktok: ['TIKTOK_CLIENT_KEY', 'TIKTOK_CLIENT_SECRET', 'TIKTOK_ACCESS_TOKEN'],
  pinterest: ['PINTEREST_APP_ID', 'PINTEREST_APP_SECRET', 'PINTEREST_ACCESS_TOKEN'],
  whatsapp_business: ['WHATSAPP_PHONE_NUMBER_ID', 'WHATSAPP_ACCESS_TOKEN'],
  telegram: ['TELEGRAM_BOT_TOKEN', 'TELEGRAM_CHAT_ID'],
  discord: ['DISCORD_BOT_TOKEN'],
  reddit: ['REDDIT_CLIENT_ID', 'REDDIT_CLIENT_SECRET', 'REDDIT_USERNAME', 'REDDIT_PASSWORD'],
  github: ['GITHUB_TOKEN', 'GITHUB_OWNER'],
  gitlab: ['GITLAB_TOKEN', 'GITLAB_PROJECT_ID'],
  google_business: ['GOOGLE_BUSINESS_ACCOUNT_ID', 'GOOGLE_BUSINESS_ACCESS_TOKEN'],
  trustpilot: ['TRUSTPILOT_API_KEY', 'TRUSTPILOT_BUSINESS_UNIT_ID'],
  vimeo: ['VIMEO_ACCESS_TOKEN'],
  medium: ['MEDIUM_INTEGRATION_TOKEN', 'MEDIUM_USER_ID'],
  patreon: ['PATREON_ACCESS_TOKEN', 'PATREON_CAMPAIGN_ID'],
  bluesky: ['BLUESKY_IDENTIFIER', 'BLUESKY_APP_PASSWORD'],
  mastodon: ['MASTODON_INSTANCE_URL', 'MASTODON_ACCESS_TOKEN'],
  soundcloud: ['SOUNDCLOUD_CLIENT_ID', 'SOUNDCLOUD_ACCESS_TOKEN'],
  spotify: ['SPOTIFY_CLIENT_ID', 'SPOTIFY_CLIENT_SECRET'],
  apple_podcasts: [],  // RSS-only; no direct API key required
  slack: ['SLACK_BOT_TOKEN'],
  yelp: ['YELP_API_KEY'],
  dailymotion: ['DAILYMOTION_API_KEY', 'DAILYMOTION_API_SECRET', 'DAILYMOTION_ACCESS_TOKEN'],
  twitch: ['TWITCH_CLIENT_ID', 'TWITCH_CLIENT_SECRET', 'TWITCH_ACCESS_TOKEN'],
  substack: [],  // No API — manual only
  tumblr: ['TUMBLR_CONSUMER_KEY', 'TUMBLR_CONSUMER_SECRET', 'TUMBLR_TOKEN', 'TUMBLR_TOKEN_SECRET'],
  threads: ['FACEBOOK_APP_ID', 'FACEBOOK_PAGE_ACCESS_TOKEN', 'INSTAGRAM_ACCOUNT_ID'],
  tripadvisor: ['TRIPADVISOR_API_KEY'],
  quora_manual: [],   // No API — manual only
  stack_overflow: [], // Read-only public API — no credentials required for reads
  dribbble: ['DRIBBBLE_ACCESS_TOKEN'],
  kijiji: [],         // No API — manual only
};

/**
 * Check whether all required credentials for a platform are present in the
 * provided env map. Returns which credentials are missing.
 *
 * @param platform  Platform key string
 * @param env       Key/value map of environment variables (pass process.env in Node.js apps)
 */
export function checkAdapterReadiness(
  platform: string,
  env: Record<string, string | undefined>
): AdapterReadiness {
  const required = PLATFORM_REQUIRED_CREDENTIALS[platform] ?? [];
  const missing = required.filter(key => !env[key]?.trim());
  return {
    ready: missing.length === 0,
    missing,
    platform: platform as PlatformKey,
  };
}

/**
 * Check readiness for ALL platforms at once.
 * Returns a map of platform → AdapterReadiness.
 */
export function checkAllAdaptersReadiness(
  env: Record<string, string | undefined>
): Record<string, AdapterReadiness> {
  return Object.fromEntries(
    Object.keys(PLATFORM_REQUIRED_CREDENTIALS).map(platform => [
      platform,
      checkAdapterReadiness(platform, env),
    ])
  );
}

/**
 * Get platform keys that use the Postiz connector.
 */
export function getPostizPlatforms(): string[] {
  return Object.entries(PLATFORM_REGISTRY)
    .filter(([, meta]) => meta.connector === 'postiz')
    .map(([key]) => key);
}

/**
 * Get platform keys that use a custom connector (not Postiz, not manual).
 */
export function getCustomConnectorPlatforms(): string[] {
  return Object.entries(PLATFORM_REGISTRY)
    .filter(([, meta]) => meta.connector === 'custom_connector')
    .map(([key]) => key);
}

/**
 * Get platform keys that are manual-only (no API automation).
 */
export function getManualOnlyPlatforms(): string[] {
  return Object.entries(PLATFORM_REGISTRY)
    .filter(([, meta]) => meta.connector === 'manual_only')
    .map(([key]) => key);
}

/**
 * Determine which publish path a platform uses.
 * Returns: 'postiz' | 'custom' | 'manual'
 */
export function getPublishPath(platform: string): 'postiz' | 'custom' | 'manual' {
  const meta = PLATFORM_REGISTRY[platform];
  if (!meta) return 'manual';
  switch (meta.connector) {
    case 'postiz': return 'postiz';
    case 'custom_connector': return 'custom';
    case 'manual_only': return 'manual';
  }
}

/**
 * Get the list of required credential env var names for a platform.
 * Returns empty array for manual-only platforms with no API.
 */
export function getRequiredCredentials(platform: string): string[] {
  return PLATFORM_REQUIRED_CREDENTIALS[platform] ?? [];
}
