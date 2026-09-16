// Static API catalog for all 36 social/content platforms.
// Reference data for credential management, API documentation, and compliance.
// Pure data — no React, no Next.js, no database code.

import type { PlatformApiOffering } from './types';

export const PLATFORM_API_CATALOG: PlatformApiOffering[] = [
  // ---- FACEBOOK ----
  { platform: 'facebook', apiName: 'Graph API', apiVersion: 'v19.0', endpointPath: '/me/feed', httpMethod: 'POST', capability: 'Publish text/link/image posts to page', category: 'publish', authType: 'oauth2', requiredScopes: ['pages_manage_posts', 'pages_read_engagement'], requiredEnvVars: ['FACEBOOK_APP_ID', 'FACEBOOK_PAGE_ACCESS_TOKEN'], rateLimitCalls: 200, rateLimitWindow: '1 hour', implementationStatus: 'built' },
  { platform: 'facebook', apiName: 'Graph API', apiVersion: 'v19.0', endpointPath: '/me/photos', httpMethod: 'POST', capability: 'Upload photo to page', category: 'media', authType: 'oauth2', requiredScopes: ['pages_manage_posts'], requiredEnvVars: ['FACEBOOK_APP_ID', 'FACEBOOK_PAGE_ACCESS_TOKEN'], implementationStatus: 'built' },
  { platform: 'facebook', apiName: 'Graph API', apiVersion: 'v19.0', endpointPath: '/{page-id}/insights', httpMethod: 'GET', capability: 'Page-level analytics: reach, impressions, engagement', category: 'analytics', authType: 'oauth2', requiredScopes: ['read_insights'], requiredEnvVars: ['FACEBOOK_APP_ID', 'FACEBOOK_PAGE_ACCESS_TOKEN'], implementationStatus: 'partial' },
  // ---- INSTAGRAM ----
  { platform: 'instagram', apiName: 'Instagram Graph API', apiVersion: 'v19.0', endpointPath: '/{ig-user-id}/media', httpMethod: 'POST', capability: 'Create media container (image/video/reel)', category: 'publish', authType: 'oauth2', requiredScopes: ['instagram_content_publish', 'pages_read_engagement'], requiredEnvVars: ['FACEBOOK_APP_ID', 'FACEBOOK_PAGE_ACCESS_TOKEN', 'INSTAGRAM_ACCOUNT_ID'], implementationStatus: 'built' },
  { platform: 'instagram', apiName: 'Instagram Graph API', apiVersion: 'v19.0', endpointPath: '/{ig-user-id}/media_publish', httpMethod: 'POST', capability: 'Publish the created media container', category: 'publish', authType: 'oauth2', requiredScopes: ['instagram_content_publish'], requiredEnvVars: ['FACEBOOK_APP_ID', 'FACEBOOK_PAGE_ACCESS_TOKEN', 'INSTAGRAM_ACCOUNT_ID'], implementationStatus: 'built' },
  { platform: 'instagram', apiName: 'Instagram Graph API', apiVersion: 'v19.0', endpointPath: '/{ig-user-id}/insights', httpMethod: 'GET', capability: 'Account-level analytics: reach, impressions, profile views', category: 'analytics', authType: 'oauth2', requiredScopes: ['instagram_manage_insights'], requiredEnvVars: ['FACEBOOK_APP_ID', 'FACEBOOK_PAGE_ACCESS_TOKEN', 'INSTAGRAM_ACCOUNT_ID'], implementationStatus: 'partial' },
  // ---- LINKEDIN ----
  { platform: 'linkedin', apiName: 'LinkedIn Marketing API', apiVersion: 'v2', endpointPath: '/ugcPosts', httpMethod: 'POST', capability: 'Publish text/image/video UGC posts to company page', category: 'publish', authType: 'oauth2', requiredScopes: ['w_member_social', 'r_liteprofile'], requiredEnvVars: ['LINKEDIN_CLIENT_ID', 'LINKEDIN_CLIENT_SECRET', 'LINKEDIN_ACCESS_TOKEN'], rateLimitCalls: 100, rateLimitWindow: '1 day', implementationStatus: 'built' },
  { platform: 'linkedin', apiName: 'LinkedIn Marketing API', apiVersion: 'v2', endpointPath: '/organizationPageStatistics', httpMethod: 'GET', capability: 'Page analytics: views, followers, engagement', category: 'analytics', authType: 'oauth2', requiredScopes: ['r_organization_social'], requiredEnvVars: ['LINKEDIN_CLIENT_ID', 'LINKEDIN_CLIENT_SECRET', 'LINKEDIN_ACCESS_TOKEN'], implementationStatus: 'partial' },
  // ---- X / TWITTER ----
  { platform: 'x_twitter', apiName: 'X API v2', apiVersion: 'v2', endpointPath: '/2/tweets', httpMethod: 'POST', capability: 'Post tweet (text, media, poll)', category: 'publish', authType: 'oauth2', requiredScopes: ['tweet.write', 'users.read'], requiredEnvVars: ['TWITTER_CLIENT_ID', 'TWITTER_CLIENT_SECRET', 'TWITTER_ACCESS_TOKEN', 'TWITTER_ACCESS_TOKEN_SECRET'], rateLimitCalls: 50, rateLimitWindow: '15 minutes', implementationStatus: 'built', notes: 'Requires Twitter Basic or Pro plan for write access' },
  { platform: 'x_twitter', apiName: 'X API v2', apiVersion: 'v2', endpointPath: '/2/users/{id}/tweets', httpMethod: 'GET', capability: 'Read user tweets timeline', category: 'read', authType: 'oauth2', requiredScopes: ['tweet.read', 'users.read'], requiredEnvVars: ['TWITTER_CLIENT_ID', 'TWITTER_CLIENT_SECRET', 'TWITTER_ACCESS_TOKEN'], rateLimitCalls: 15, rateLimitWindow: '15 minutes', implementationStatus: 'stub' },
  // ---- YOUTUBE ----
  { platform: 'youtube', apiName: 'YouTube Data API v3', apiVersion: 'v3', endpointPath: '/videos', httpMethod: 'POST', capability: 'Upload video to YouTube channel', category: 'publish', authType: 'oauth2', requiredScopes: ['https://www.googleapis.com/auth/youtube.upload'], requiredEnvVars: ['YOUTUBE_CLIENT_ID', 'YOUTUBE_CLIENT_SECRET', 'YOUTUBE_API_KEY'], rateLimitCalls: 10000, rateLimitWindow: '1 day (quota units)', implementationStatus: 'built' },
  { platform: 'youtube', apiName: 'YouTube Analytics API', apiVersion: 'v2', endpointPath: '/reports', httpMethod: 'GET', capability: 'Channel analytics: views, watch time, subscribers, revenue', category: 'analytics', authType: 'oauth2', requiredScopes: ['https://www.googleapis.com/auth/yt-analytics.readonly'], requiredEnvVars: ['YOUTUBE_CLIENT_ID', 'YOUTUBE_CLIENT_SECRET'], implementationStatus: 'partial' },
  // ---- TIKTOK ----
  { platform: 'tiktok', apiName: 'TikTok Content Posting API', endpointPath: '/v2/post/publish/video/init/', httpMethod: 'POST', capability: 'Init video upload to TikTok', category: 'publish', authType: 'oauth2', requiredScopes: ['video.publish'], requiredEnvVars: ['TIKTOK_CLIENT_KEY', 'TIKTOK_CLIENT_SECRET', 'TIKTOK_ACCESS_TOKEN'], implementationStatus: 'built' },
  { platform: 'tiktok', apiName: 'TikTok Research API', endpointPath: '/v2/video/query/', httpMethod: 'POST', capability: 'Query video analytics (Research API)', category: 'analytics', authType: 'oauth2', requiredScopes: ['research.data.basic'], requiredEnvVars: ['TIKTOK_CLIENT_KEY', 'TIKTOK_CLIENT_SECRET', 'TIKTOK_ACCESS_TOKEN'], implementationStatus: 'partial', requiresReview: true },
  // ---- WHATSAPP BUSINESS ----
  { platform: 'whatsapp_business', apiName: 'WhatsApp Cloud API', endpointPath: '/{phone-number-id}/messages', httpMethod: 'POST', capability: 'Send text/template/media messages', category: 'messaging', authType: 'bearer_token', requiredEnvVars: ['WHATSAPP_PHONE_NUMBER_ID', 'WHATSAPP_ACCESS_TOKEN'], rateLimitCalls: 1000, rateLimitWindow: '1 second', implementationStatus: 'built' },
  { platform: 'whatsapp_business', apiName: 'WhatsApp Cloud API', endpointPath: '/{phone-number-id}/message_templates', httpMethod: 'GET', capability: 'List approved message templates', category: 'read', authType: 'bearer_token', requiredEnvVars: ['WHATSAPP_PHONE_NUMBER_ID', 'WHATSAPP_ACCESS_TOKEN'], implementationStatus: 'built' },
  // ---- PINTEREST ----
  { platform: 'pinterest', apiName: 'Pinterest API v5', apiVersion: 'v5', endpointPath: '/pins', httpMethod: 'POST', capability: 'Create pin with image/video and link', category: 'publish', authType: 'oauth2', requiredScopes: ['pins:write', 'boards:read'], requiredEnvVars: ['PINTEREST_APP_ID', 'PINTEREST_APP_SECRET', 'PINTEREST_ACCESS_TOKEN'], implementationStatus: 'built' },
  { platform: 'pinterest', apiName: 'Pinterest API v5', apiVersion: 'v5', endpointPath: '/user_account/analytics', httpMethod: 'GET', capability: 'Account analytics: impressions, saves, clicks', category: 'analytics', authType: 'oauth2', requiredScopes: ['user_accounts:read'], requiredEnvVars: ['PINTEREST_APP_ID', 'PINTEREST_APP_SECRET', 'PINTEREST_ACCESS_TOKEN'], implementationStatus: 'partial' },
  // ---- REDDIT ----
  { platform: 'reddit', apiName: 'Reddit API', endpointPath: '/api/submit', httpMethod: 'POST', capability: 'Submit post to subreddit (text/link/image)', category: 'publish', authType: 'oauth2', requiredScopes: ['submit'], requiredEnvVars: ['REDDIT_CLIENT_ID', 'REDDIT_CLIENT_SECRET', 'REDDIT_USERNAME', 'REDDIT_PASSWORD'], rateLimitCalls: 60, rateLimitWindow: '1 minute', implementationStatus: 'stub' },
  // ---- TELEGRAM ----
  { platform: 'telegram', apiName: 'Telegram Bot API', endpointPath: '/bot{token}/sendMessage', httpMethod: 'POST', capability: 'Send text message to channel/group', category: 'messaging', authType: 'api_key', requiredEnvVars: ['TELEGRAM_BOT_TOKEN', 'TELEGRAM_CHAT_ID'], implementationStatus: 'built' },
  { platform: 'telegram', apiName: 'Telegram Bot API', endpointPath: '/bot{token}/sendPhoto', httpMethod: 'POST', capability: 'Send photo with caption to channel', category: 'media', authType: 'api_key', requiredEnvVars: ['TELEGRAM_BOT_TOKEN', 'TELEGRAM_CHAT_ID'], implementationStatus: 'built' },
  // ---- DISCORD ----
  { platform: 'discord', apiName: 'Discord Bot API', endpointPath: '/channels/{channel.id}/messages', httpMethod: 'POST', capability: 'Send message to Discord channel via bot', category: 'messaging', authType: 'bearer_token', requiredEnvVars: ['DISCORD_BOT_TOKEN'], implementationStatus: 'stub' },
  // ---- GITHUB ----
  { platform: 'github', apiName: 'GitHub REST API', apiVersion: 'v3', endpointPath: '/repos/{owner}/{repo}/releases', httpMethod: 'POST', capability: 'Create GitHub release with changelog', category: 'publish', authType: 'bearer_token', requiredEnvVars: ['GITHUB_TOKEN', 'GITHUB_OWNER'], implementationStatus: 'not_built' },
  { platform: 'github', apiName: 'GitHub REST API', apiVersion: 'v3', endpointPath: '/repos/{owner}/{repo}/traffic/views', httpMethod: 'GET', capability: 'Repository traffic views (14-day window)', category: 'analytics', authType: 'bearer_token', requiredEnvVars: ['GITHUB_TOKEN', 'GITHUB_OWNER'], implementationStatus: 'not_built' },
  // ---- GOOGLE BUSINESS ----
  { platform: 'google_business', apiName: 'My Business Business Information API', endpointPath: '/v1/accounts/{account}/locations/{location}/localPosts', httpMethod: 'POST', capability: 'Create Google Business post (standard/event/offer)', category: 'publish', authType: 'oauth2', requiredScopes: ['https://www.googleapis.com/auth/business.manage'], requiredEnvVars: ['GOOGLE_BUSINESS_ACCOUNT_ID', 'GOOGLE_BUSINESS_ACCESS_TOKEN'], implementationStatus: 'stub' },
  { platform: 'google_business', apiName: 'My Business Business Information API', endpointPath: '/v1/accounts/{account}/locations/{location}/reviews', httpMethod: 'GET', capability: 'List Google Business reviews', category: 'review', authType: 'oauth2', requiredScopes: ['https://www.googleapis.com/auth/business.manage'], requiredEnvVars: ['GOOGLE_BUSINESS_ACCOUNT_ID', 'GOOGLE_BUSINESS_ACCESS_TOKEN'], implementationStatus: 'stub' },
  // ---- TRUSTPILOT ----
  { platform: 'trustpilot', apiName: 'Trustpilot Business API', endpointPath: '/v1/private/business-units/{businessUnitId}/reviews', httpMethod: 'GET', capability: 'List business reviews', category: 'review', authType: 'oauth2', requiredEnvVars: ['TRUSTPILOT_API_KEY', 'TRUSTPILOT_BUSINESS_UNIT_ID'], implementationStatus: 'stub' },
  { platform: 'trustpilot', apiName: 'Trustpilot Business API', endpointPath: '/v1/private/business-units/{businessUnitId}/reviews/{reviewId}/reply', httpMethod: 'POST', capability: 'Reply to a Trustpilot review', category: 'review', authType: 'oauth2', requiredEnvVars: ['TRUSTPILOT_API_KEY', 'TRUSTPILOT_BUSINESS_UNIT_ID'], implementationStatus: 'not_built' },
  // ---- VIMEO ----
  { platform: 'vimeo', apiName: 'Vimeo API', endpointPath: '/me/videos', httpMethod: 'POST', capability: 'Upload video to Vimeo account', category: 'publish', authType: 'bearer_token', requiredEnvVars: ['VIMEO_ACCESS_TOKEN'], implementationStatus: 'not_built' },
  // ---- MEDIUM ----
  { platform: 'medium', apiName: 'Medium API', apiVersion: 'v1', endpointPath: '/v1/users/{userId}/posts', httpMethod: 'POST', capability: 'Create and publish article on Medium', category: 'publish', authType: 'bearer_token', requiredEnvVars: ['MEDIUM_INTEGRATION_TOKEN', 'MEDIUM_USER_ID'], implementationStatus: 'not_built', notes: 'Medium API is deprecated; Postiz connector handles this' },
  // ---- PATREON ----
  { platform: 'patreon', apiName: 'Patreon API v2', apiVersion: 'v2', endpointPath: '/api/oauth2/v2/posts', httpMethod: 'POST', capability: 'Create Patreon post for patrons/public', category: 'publish', authType: 'oauth2', requiredEnvVars: ['PATREON_ACCESS_TOKEN', 'PATREON_CAMPAIGN_ID'], implementationStatus: 'not_built' },
  // ---- BLUESKY ----
  { platform: 'bluesky', apiName: 'ATProto / Bluesky API', endpointPath: '/xrpc/com.atproto.repo.createRecord', httpMethod: 'POST', capability: 'Create post (skeet) on Bluesky', category: 'publish', authType: 'bearer_token', requiredEnvVars: ['BLUESKY_IDENTIFIER', 'BLUESKY_APP_PASSWORD'], implementationStatus: 'built', notes: 'Uses app password for auth, not OAuth' },
  // ---- MASTODON ----
  { platform: 'mastodon', apiName: 'Mastodon API', endpointPath: '/api/v1/statuses', httpMethod: 'POST', capability: 'Post a toot (status) to Mastodon', category: 'publish', authType: 'bearer_token', requiredEnvVars: ['MASTODON_INSTANCE_URL', 'MASTODON_ACCESS_TOKEN'], implementationStatus: 'built' },
  // ---- SOUNDCLOUD ----
  { platform: 'soundcloud', apiName: 'SoundCloud API', endpointPath: '/tracks', httpMethod: 'POST', capability: 'Upload audio track to SoundCloud', category: 'publish', authType: 'oauth2', requiredEnvVars: ['SOUNDCLOUD_CLIENT_ID', 'SOUNDCLOUD_ACCESS_TOKEN'], implementationStatus: 'not_built' },
  // ---- SLACK ----
  { platform: 'slack', apiName: 'Slack Web API', endpointPath: '/api/chat.postMessage', httpMethod: 'POST', capability: 'Post message to Slack channel via bot', category: 'messaging', authType: 'bearer_token', requiredEnvVars: ['SLACK_BOT_TOKEN'], implementationStatus: 'not_built' },
  // ---- YELP ----
  { platform: 'yelp', apiName: 'Yelp Fusion API', endpointPath: '/v3/businesses/{id}/reviews', httpMethod: 'GET', capability: 'Read business reviews (last 3 via free tier)', category: 'review', authType: 'bearer_token', requiredEnvVars: ['YELP_API_KEY'], rateLimitCalls: 5000, rateLimitWindow: '1 day', implementationStatus: 'not_built' },
  // ---- DAILYMOTION ----
  { platform: 'dailymotion', apiName: 'Dailymotion API', endpointPath: '/me/videos', httpMethod: 'POST', capability: 'Upload video to Dailymotion channel', category: 'publish', authType: 'oauth2', requiredEnvVars: ['DAILYMOTION_API_KEY', 'DAILYMOTION_API_SECRET', 'DAILYMOTION_ACCESS_TOKEN'], implementationStatus: 'not_built' },
];

/**
 * Get all API offerings for a specific platform.
 */
export function getApiCatalogForPlatform(platform: string): PlatformApiOffering[] {
  return PLATFORM_API_CATALOG.filter(a => a.platform === platform);
}

/**
 * Get all API offerings by implementation status.
 */
export function getApiCatalogByStatus(status: PlatformApiOffering['implementationStatus']): PlatformApiOffering[] {
  return PLATFORM_API_CATALOG.filter(a => a.implementationStatus === status);
}

/**
 * Get all API offerings by category.
 */
export function getApiCatalogByCategory(category: PlatformApiOffering['category']): PlatformApiOffering[] {
  return PLATFORM_API_CATALOG.filter(a => a.category === category);
}
