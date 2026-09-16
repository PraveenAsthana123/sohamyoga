'use client';

import { useState } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

type Priority = 'red' | 'orange' | 'yellow';
type ConnectorType = 'postiz' | 'custom' | 'manual';
type AutomationPotential = 'high' | 'medium' | 'limited';

interface SetupStep {
  label: string;
  detail?: string;
  url?: string;
}

interface PlatformGuide {
  key: string;
  name: string;
  emoji: string;
  priority: Priority;
  businessUse: string;
  contentStrength: string;
  automationPotential: AutomationPotential;
  connectorType: ConnectorType;
  requiredEnvVars: string[];
  setupSteps: SetupStep[];
  contentTypes: string[];
  oauthUrl?: string;
}

// ─── Platform definitions ─────────────────────────────────────────────────────

const PLATFORMS: PlatformGuide[] = [
  // ── Red Priority ──────────────────────────────────────────────────────────
  {
    key: 'whatsapp_business',
    name: 'WhatsApp Business',
    emoji: '💬',
    priority: 'red',
    businessUse: 'Direct customer messaging, order confirmations, service alerts',
    contentStrength: 'High-open-rate direct channel; 98% open rate vs 20% email',
    automationPotential: 'high',
    connectorType: 'custom',
    requiredEnvVars: ['WHATSAPP_PHONE_NUMBER_ID', 'WHATSAPP_ACCESS_TOKEN'],
    oauthUrl: 'https://developers.facebook.com/docs/whatsapp/cloud-api/get-started',
    setupSteps: [
      { label: 'Create Meta Business Account', url: 'https://business.facebook.com/', detail: 'Required for WhatsApp Business API access' },
      { label: 'Create a WhatsApp Business App', url: 'https://developers.facebook.com/apps/', detail: 'Select "Business" type app, add WhatsApp product' },
      { label: 'Get a Phone Number ID', detail: 'From WhatsApp > API Setup in your app dashboard. Copy the Phone Number ID.' },
      { label: 'Generate a permanent access token', url: 'https://developers.facebook.com/docs/whatsapp/business-management-api/get-started', detail: 'Use System Users in Meta Business Manager for production tokens' },
      { label: 'Set env vars', detail: 'WHATSAPP_PHONE_NUMBER_ID=<number_id>\nWHATSAPP_ACCESS_TOKEN=<token>' },
    ],
    contentTypes: ['text_message', 'image_message', 'video_message', 'template_message', 'document_message', 'catalog_message'],
  },
  {
    key: 'pinterest',
    name: 'Pinterest',
    emoji: '📌',
    priority: 'red',
    businessUse: 'Visual product discovery, driving website traffic, SEO-boosting pins',
    contentStrength: 'Long pin lifespan (months vs hours on Twitter); strong e-commerce intent',
    automationPotential: 'high',
    connectorType: 'custom',
    requiredEnvVars: ['PINTEREST_ACCESS_TOKEN'],
    oauthUrl: 'https://developers.pinterest.com/apps/',
    setupSteps: [
      { label: 'Create a Pinterest Developer App', url: 'https://developers.pinterest.com/apps/', detail: 'Log in with a Pinterest Business account' },
      { label: 'Enable "Read" and "Write" board/pin scopes', detail: 'Under app permissions, enable pins:read, pins:write, boards:read' },
      { label: 'Generate an access token', url: 'https://developers.pinterest.com/docs/getting-started/authentication/', detail: 'Use OAuth 2.0 flow or generate a token in the developer console' },
      { label: 'Get your Board ID', detail: 'From your Pinterest profile URL or via GET /v5/boards API' },
      { label: 'Set env var', detail: 'PINTEREST_ACCESS_TOKEN=<your_token>' },
    ],
    contentTypes: ['pin', 'idea_pin', 'video_pin', 'rich_pin', 'board_section'],
  },
  {
    key: 'reddit',
    name: 'Reddit',
    emoji: '🤖',
    priority: 'red',
    businessUse: 'Community engagement, product feedback, niche audience reach',
    contentStrength: 'High-trust community discussions; authentic brand positioning',
    automationPotential: 'medium',
    connectorType: 'postiz',
    requiredEnvVars: [],
    setupSteps: [
      { label: 'Create a Reddit account for your brand', url: 'https://www.reddit.com/register/', detail: 'Build karma first — 30+ days before posting in most subreddits' },
      { label: 'Create a Reddit app (for Postiz)', url: 'https://www.reddit.com/prefs/apps', detail: 'Select "script" type, set redirect URI to your Postiz callback URL' },
      { label: 'Copy Client ID and Secret', detail: 'From your app\'s "developed applications" panel' },
      { label: 'Connect to Postiz', detail: 'In Postiz, add Reddit provider and paste Client ID + Secret' },
    ],
    contentTypes: ['text_post', 'link_post', 'image_post', 'video_post', 'poll', 'crosspost'],
  },
  // ── Orange Priority ───────────────────────────────────────────────────────
  {
    key: 'snapchat',
    name: 'Snapchat',
    emoji: '👻',
    priority: 'orange',
    businessUse: 'Gen-Z brand awareness, AR lens experiences, paid Snap ads',
    contentStrength: 'Youngest demographic reach; Spotlight = viral organic potential',
    automationPotential: 'limited',
    connectorType: 'manual',
    requiredEnvVars: ['SNAPCHAT_ACCESS_TOKEN', 'SNAPCHAT_AD_ACCOUNT_ID'],
    oauthUrl: 'https://developers.snapchat.com/',
    setupSteps: [
      { label: 'Create a Snapchat Business account', url: 'https://business.snapchat.com/', detail: 'Required for ad management and API access' },
      { label: 'Apply for Snap Marketing API access', url: 'https://developers.snapchat.com/', detail: 'Organic posting has no public API — only ad management is available via API' },
      { label: 'Get Ad Account ID', detail: 'From Snap Ads Manager: https://ads.snapchat.com — copy the Ad Account ID from Settings' },
      { label: 'Generate access token via OAuth', url: 'https://developers.snapchat.com/api/docs/#authentication', detail: 'Use OAuth 2.0 flow; token expires after 1800 seconds' },
      { label: 'Post organically via Snapchat mobile app', detail: 'For Stories and Spotlight, use the Snapchat mobile app directly — no API equivalent exists' },
    ],
    contentTypes: ['story', 'spotlight', 'snap_ad', 'collection_ad'],
  },
  {
    key: 'twitch',
    name: 'Twitch',
    emoji: '🎮',
    priority: 'orange',
    businessUse: 'Live streaming community, gaming/tech audience, clip-based brand content',
    contentStrength: 'Highly engaged live audiences; clip virality across Twitter/TikTok',
    automationPotential: 'medium',
    connectorType: 'custom',
    requiredEnvVars: ['TWITCH_CLIENT_ID', 'TWITCH_ACCESS_TOKEN'],
    oauthUrl: 'https://dev.twitch.tv/console/apps',
    setupSteps: [
      { label: 'Create a Twitch application', url: 'https://dev.twitch.tv/console/apps', detail: 'Log in with your Twitch account, click "Register Your Application"' },
      { label: 'Set OAuth Redirect URLs', detail: 'Add your app callback URL; for local dev use http://localhost:3000/api/auth/callback/twitch' },
      { label: 'Copy Client ID', detail: 'From your app management page — shown immediately after creation' },
      { label: 'Generate Access Token', url: 'https://dev.twitch.tv/docs/authentication/', detail: 'Use OAuth Authorization Code Flow; requires user consent for channel:manage:broadcast scope' },
      { label: 'Set env vars', detail: 'TWITCH_CLIENT_ID=<client_id>\nTWITCH_ACCESS_TOKEN=<user_token>' },
    ],
    contentTypes: ['stream_title_update', 'clip_promotion', 'channel_points_reward', 'schedule_segment'],
  },
  {
    key: 'medium',
    name: 'Medium',
    emoji: '✍️',
    priority: 'orange',
    businessUse: 'Thought leadership articles, SEO-boosted long-form content, imported blog posts',
    contentStrength: 'Built-in audience discovery; ranks well in Google for long-tail queries',
    automationPotential: 'high',
    connectorType: 'custom',
    requiredEnvVars: ['MEDIUM_INTEGRATION_TOKEN'],
    oauthUrl: 'https://medium.com/me/settings',
    setupSteps: [
      { label: 'Go to Medium Settings', url: 'https://medium.com/me/settings', detail: 'Log in with your Medium account' },
      { label: 'Generate an Integration Token', detail: 'Under "Security and apps" > "Integration tokens" — create a new token and copy it' },
      { label: 'Set env var', detail: 'MEDIUM_INTEGRATION_TOKEN=<your_token>' },
      { label: 'Find your User ID (optional)', detail: 'Call GET https://api.medium.com/v1/me with your token — the id field is your user ID' },
    ],
    contentTypes: ['article', 'response', 'series'],
  },
  {
    key: 'substack',
    name: 'Substack',
    emoji: '📧',
    priority: 'orange',
    businessUse: 'Newsletter monetization, subscriber-first content, podcast distribution',
    contentStrength: 'Direct subscriber relationship; high open rates; paid tier conversion',
    automationPotential: 'limited',
    connectorType: 'manual',
    requiredEnvVars: [],
    setupSteps: [
      { label: 'Create a Substack publication', url: 'https://substack.com/new', detail: 'Free to start — 10% fee only on paid subscriptions' },
      { label: 'Configure your publication settings', detail: 'Set publication name, description, cover image, and posting schedule' },
      { label: 'Write and publish manually', url: 'https://substack.com/dashboard', detail: 'Substack has no public API — all publishing must be done through substack.com dashboard' },
      { label: 'Integrate with email automation (alternative)', detail: 'For automation, use Listmonk or Mailchimp to send newsletters that link to your Substack posts' },
    ],
    contentTypes: ['newsletter', 'thread', 'podcast_episode', 'note'],
  },
  {
    key: 'quora',
    name: 'Quora',
    emoji: '❓',
    priority: 'orange',
    businessUse: 'Authority building through expert Q&A, SEO long-tail traffic, thought leadership',
    contentStrength: 'Google SEO ranking for question-based queries; expert credibility signals',
    automationPotential: 'limited',
    connectorType: 'manual',
    requiredEnvVars: [],
    setupSteps: [
      { label: 'Create a Quora account', url: 'https://www.quora.com/profile/add', detail: 'Use your real name and a professional profile photo for credibility' },
      { label: 'Set up your credentials section', detail: 'Add relevant credentials for the topics you will answer — shown next to your name' },
      { label: 'Find high-traffic questions', url: 'https://www.quora.com/ads', detail: 'Use Quora Ads tool (free to browse) to find questions with high views' },
      { label: 'Write answers manually', url: 'https://www.quora.com/', detail: 'No automation API — write all answers through the Quora website' },
    ],
    contentTypes: ['answer', 'space_post', 'blog_post'],
  },
  {
    key: 'tumblr',
    name: 'Tumblr',
    emoji: '🌀',
    priority: 'orange',
    businessUse: 'Creative brand content, niche community engagement, Gen-Z/millennial reach',
    contentStrength: 'Reblog culture = organic viral amplification; strong niche communities',
    automationPotential: 'high',
    connectorType: 'postiz',
    requiredEnvVars: [],
    setupSteps: [
      { label: 'Create a Tumblr account', url: 'https://www.tumblr.com/register/', detail: 'Use a brand blog URL: yourbrand.tumblr.com or custom domain' },
      { label: 'Register a Tumblr App', url: 'https://www.tumblr.com/oauth/apps', detail: 'Create an app to get OAuth credentials' },
      { label: 'Connect to Postiz', detail: 'In Postiz, add Tumblr provider with Consumer Key + Consumer Secret from your app' },
    ],
    contentTypes: ['text_post', 'photo_post', 'video_post', 'audio_post', 'quote_post', 'link_post', 'chat_post'],
  },
  {
    key: 'mastodon',
    name: 'Mastodon',
    emoji: '🐘',
    priority: 'orange',
    businessUse: 'Open-source community, decentralized reach, tech and privacy-conscious audiences',
    contentStrength: 'Federated network reach; engaged niche communities; no algorithm suppression',
    automationPotential: 'high',
    connectorType: 'custom',
    requiredEnvVars: ['MASTODON_INSTANCE_URL', 'MASTODON_ACCESS_TOKEN'],
    setupSteps: [
      { label: 'Choose a Mastodon instance', url: 'https://joinmastodon.org/servers', detail: 'Pick an instance relevant to your niche (e.g. mastodon.social, fosstodon.org for tech)' },
      { label: 'Register an application', detail: 'Go to: https://[your.instance]/settings/applications/new — set permissions to read + write:statuses' },
      { label: 'Copy access token', detail: 'After creating the app, an access token is shown — copy it immediately' },
      { label: 'Set env vars', detail: 'MASTODON_INSTANCE_URL=https://mastodon.social\nMASTODON_ACCESS_TOKEN=<token>' },
      { label: 'Connected via first-wave-adapters', detail: 'This platform uses the existing first-wave adapter (FirstWaveDispatchJob)' },
    ],
    contentTypes: ['toot', 'boost', 'poll', 'thread'],
  },
  {
    key: 'bluesky',
    name: 'Bluesky',
    emoji: '🦋',
    priority: 'orange',
    businessUse: 'Open protocol community, early adopter tech audience, decentralized social presence',
    contentStrength: 'AT Protocol — portable identity; early mover advantage; growing rapidly',
    automationPotential: 'high',
    connectorType: 'custom',
    requiredEnvVars: ['BLUESKY_IDENTIFIER', 'BLUESKY_APP_PASSWORD'],
    setupSteps: [
      { label: 'Create a Bluesky account', url: 'https://bsky.app/', detail: 'Get your handle: yourname.bsky.social or use a custom domain' },
      { label: 'Generate an App Password', url: 'https://bsky.app/settings/app-passwords', detail: 'Settings > App Passwords > Add App Password — do not use your main password' },
      { label: 'Note your identifier', detail: 'This is your full handle, e.g. yourbrand.bsky.social' },
      { label: 'Set env vars', detail: 'BLUESKY_IDENTIFIER=yourbrand.bsky.social\nBLUESKY_APP_PASSWORD=<app_password>' },
      { label: 'Connected via first-wave-adapters', detail: 'This platform uses the existing first-wave adapter (FirstWaveDispatchJob)' },
    ],
    contentTypes: ['post', 'thread', 'quote_post'],
  },
  // ── Yellow Priority ───────────────────────────────────────────────────────
  {
    key: 'github',
    name: 'GitHub',
    emoji: '🐱',
    priority: 'yellow',
    businessUse: 'Developer community, open-source credibility, release announcements',
    contentStrength: 'Technical audience trust; releases rank in Google; dev brand building',
    automationPotential: 'high',
    connectorType: 'custom',
    requiredEnvVars: ['GITHUB_TOKEN', 'GITHUB_OWNER', 'GITHUB_REPO'],
    oauthUrl: 'https://github.com/settings/tokens',
    setupSteps: [
      { label: 'Generate a Personal Access Token (classic)', url: 'https://github.com/settings/tokens', detail: 'Enable scopes: repo (for releases), write:discussion (for discussions)' },
      { label: 'Note your repo owner and name', detail: 'From your repo URL: github.com/OWNER/REPO' },
      { label: 'Set env vars', detail: 'GITHUB_TOKEN=ghp_xxxx\nGITHUB_OWNER=your-org\nGITHUB_REPO=your-repo' },
    ],
    contentTypes: ['release', 'discussion', 'gist', 'readme_update', 'wiki_page', 'issue_announcement'],
  },
  {
    key: 'gitlab',
    name: 'GitLab',
    emoji: '🦊',
    priority: 'yellow',
    businessUse: 'DevOps community, release documentation, technical brand presence',
    contentStrength: 'Strong DevOps/enterprise developer community; CI/CD integrations',
    automationPotential: 'high',
    connectorType: 'custom',
    requiredEnvVars: ['GITLAB_TOKEN', 'GITLAB_PROJECT_ID'],
    oauthUrl: 'https://gitlab.com/-/profile/personal_access_tokens',
    setupSteps: [
      { label: 'Generate a Personal Access Token', url: 'https://gitlab.com/-/profile/personal_access_tokens', detail: 'Enable scopes: api, read_repository, write_repository' },
      { label: 'Find your Project ID', detail: 'Go to your project > Settings > General — Project ID is shown at the top' },
      { label: 'Set env vars', detail: 'GITLAB_TOKEN=glpat-xxxx\nGITLAB_PROJECT_ID=12345678' },
    ],
    contentTypes: ['release', 'snippet', 'wiki_page', 'merge_request_announcement'],
  },
  {
    key: 'google_business',
    name: 'Google Business Profile',
    emoji: '🗺️',
    priority: 'yellow',
    businessUse: 'Local SEO, Google Maps presence, local customer acquisition',
    contentStrength: 'Direct Google Search + Maps integration; local pack ranking signals',
    automationPotential: 'high',
    connectorType: 'custom',
    requiredEnvVars: ['GOOGLE_BUSINESS_ACCOUNT_ID', 'GOOGLE_BUSINESS_ACCESS_TOKEN'],
    oauthUrl: 'https://console.cloud.google.com/apis/library/mybusiness.googleapis.com',
    setupSteps: [
      { label: 'Enable the My Business API', url: 'https://console.cloud.google.com/apis/library/mybusiness.googleapis.com', detail: 'Create a Google Cloud project and enable the Google My Business API' },
      { label: 'Create OAuth 2.0 credentials', url: 'https://console.cloud.google.com/apis/credentials', detail: 'Web application type; add your redirect URI' },
      { label: 'Get your Account ID', detail: 'Call GET https://mybusiness.googleapis.com/v4/accounts — find the account name (accounts/NNNN)' },
      { label: 'Get your Location ID', detail: 'Call GET https://mybusiness.googleapis.com/v4/accounts/NNNN/locations — use the location name for externalAccountId' },
      { label: 'Set env vars', detail: 'GOOGLE_BUSINESS_ACCOUNT_ID=accounts/NNNN\nGOOGLE_BUSINESS_ACCESS_TOKEN=<oauth_token>' },
    ],
    contentTypes: ['standard_post', 'event_post', 'offer_post', 'product_post', 'covid_update'],
  },
  {
    key: 'yelp',
    name: 'Yelp',
    emoji: '⭐',
    priority: 'yellow',
    businessUse: 'Local business reviews, reputation management, review response',
    contentStrength: 'High consumer trust; review responses improve listing conversion',
    automationPotential: 'limited',
    connectorType: 'manual',
    requiredEnvVars: [],
    setupSteps: [
      { label: 'Claim your Yelp Business Page', url: 'https://biz.yelp.com/', detail: 'Required before responding to reviews' },
      { label: 'Note: Yelp Fusion API is read-only for reviews', detail: 'You can only read reviews via API, not post or respond to them programmatically' },
      { label: 'Respond to reviews manually', url: 'https://biz.yelp.com/', detail: 'Log into Yelp for Business to respond to reviews directly' },
    ],
    contentTypes: ['business_response', 'owner_post', 'offer'],
  },
  {
    key: 'tripadvisor',
    name: 'TripAdvisor',
    emoji: '🦉',
    priority: 'yellow',
    businessUse: 'Travel/hospitality review management, tourism audience, booking intent',
    contentStrength: 'High booking intent; management responses increase traveller confidence',
    automationPotential: 'limited',
    connectorType: 'manual',
    requiredEnvVars: [],
    setupSteps: [
      { label: 'Claim your TripAdvisor listing', url: 'https://www.tripadvisor.com/Owners', detail: 'Required for management responses' },
      { label: 'Note: Review API is read-only', detail: 'TripAdvisor API allows reading reviews; management responses require the management portal' },
      { label: 'Respond through Management Center', url: 'https://www.tripadvisor.com/BusinessListingCenter', detail: 'Log in as business owner to manage responses' },
    ],
    contentTypes: ['management_response', 'experience_update'],
  },
  {
    key: 'trustpilot',
    name: 'Trustpilot',
    emoji: '⭐',
    priority: 'yellow',
    businessUse: 'Business reputation, review collection automation, customer trust signals',
    contentStrength: 'High consumer trust signal; review widgets boost conversion rates',
    automationPotential: 'high',
    connectorType: 'custom',
    requiredEnvVars: ['TRUSTPILOT_API_KEY', 'TRUSTPILOT_API_SECRET', 'TRUSTPILOT_BUSINESS_UNIT_ID'],
    oauthUrl: 'https://developers.trustpilot.com/',
    setupSteps: [
      { label: 'Register as a Trustpilot business', url: 'https://businessapp.b2b.trustpilot.com/', detail: 'You need an active Trustpilot business subscription' },
      { label: 'Create an API application', url: 'https://developers.trustpilot.com/', detail: 'Log in and register an application; copy the API Key and Secret' },
      { label: 'Find your Business Unit ID', detail: 'Call GET https://api.trustpilot.com/v1/business-units/find?name=yourdomain.com — copy the id field' },
      { label: 'Set env vars', detail: 'TRUSTPILOT_API_KEY=<key>\nTRUSTPILOT_API_SECRET=<secret>\nTRUSTPILOT_BUSINESS_UNIT_ID=<unit_id>' },
    ],
    contentTypes: ['review_invitation', 'review_response', 'service_review'],
  },
  {
    key: 'vimeo',
    name: 'Vimeo',
    emoji: '🎬',
    priority: 'yellow',
    businessUse: 'Professional video hosting, client deliverables, ad-free embedding',
    contentStrength: 'High-quality player; no competing ads; privacy controls for client review',
    automationPotential: 'high',
    connectorType: 'custom',
    requiredEnvVars: ['VIMEO_ACCESS_TOKEN'],
    oauthUrl: 'https://developer.vimeo.com/apps',
    setupSteps: [
      { label: 'Create a Vimeo Developer App', url: 'https://developer.vimeo.com/apps', detail: 'Requires a Vimeo account (free tier sufficient for token generation)' },
      { label: 'Set app permissions', detail: 'Enable: public, private, create, edit, delete, interact, upload scopes' },
      { label: 'Generate a Personal Access Token', detail: 'Under Authentication > Personal Access Tokens in your app — choose Authenticated (you)' },
      { label: 'Set env var', detail: 'VIMEO_ACCESS_TOKEN=<your_token>' },
    ],
    contentTypes: ['video_upload', 'showcase', 'project'],
  },
  {
    key: 'dailymotion',
    name: 'Dailymotion',
    emoji: '📺',
    priority: 'yellow',
    businessUse: 'European video audience, alternative video hosting, news and entertainment content',
    contentStrength: 'Strong European reach; alternative to YouTube for markets with restrictions',
    automationPotential: 'high',
    connectorType: 'custom',
    requiredEnvVars: ['DAILYMOTION_CLIENT_ID', 'DAILYMOTION_CLIENT_SECRET', 'DAILYMOTION_ACCESS_TOKEN'],
    setupSteps: [
      { label: 'Create a Dailymotion partner account', url: 'https://www.dailymotion.com/partner', detail: 'Required for API access beyond basic playback' },
      { label: 'Register an API client', url: 'https://www.dailymotion.com/settings/developer', detail: 'Get Client ID and Client Secret from developer settings' },
      { label: 'Generate an access token', url: 'https://developers.dailymotion.com/api/#authentication', detail: 'OAuth 2.0 flow; request scope: manage_videos, manage_player' },
      { label: 'Set env vars', detail: 'DAILYMOTION_CLIENT_ID=<id>\nDAILYMOTION_CLIENT_SECRET=<secret>\nDAILYMOTION_ACCESS_TOKEN=<token>' },
    ],
    contentTypes: ['video_upload', 'live_stream'],
  },
  {
    key: 'spotify',
    name: 'Spotify (Podcasts)',
    emoji: '🎙️',
    priority: 'yellow',
    businessUse: 'Podcast distribution, brand audio content, Spotify audience reach',
    contentStrength: 'Largest podcast platform globally; podcast SEO in Spotify search',
    automationPotential: 'limited',
    connectorType: 'manual',
    requiredEnvVars: [],
    setupSteps: [
      { label: 'Create a podcast with an RSS feed', detail: 'Use Buzzsprout, Anchor, or your own RSS server to host your podcast feed' },
      { label: 'Submit to Spotify for Podcasters', url: 'https://podcasters.spotify.com/', detail: 'Add your RSS feed URL — approval usually takes 24-48h' },
      { label: 'Manage episodes via RSS', detail: 'Publish episodes to your RSS feed — Spotify automatically picks them up within hours' },
      { label: 'Note: No Spotify Podcasting publish API', detail: 'Spotify does not provide an API for programmatic episode publishing — RSS is the only pathway' },
    ],
    contentTypes: ['podcast_episode', 'show_update'],
  },
  {
    key: 'apple_podcasts',
    name: 'Apple Podcasts',
    emoji: '🎧',
    priority: 'yellow',
    businessUse: 'Podcast distribution to iPhone users, Apple ecosystem audience',
    contentStrength: 'iPhone users represent highest podcast listening time globally',
    automationPotential: 'limited',
    connectorType: 'manual',
    requiredEnvVars: [],
    setupSteps: [
      { label: 'Create a podcast RSS feed', detail: 'Must include iTunes-specific tags: <itunes:author>, <itunes:image>, <itunes:category>' },
      { label: 'Submit to Apple Podcasts Connect', url: 'https://podcastsconnect.apple.com/', detail: 'Log in with Apple ID and submit your RSS feed URL' },
      { label: 'Wait for review approval', detail: 'Apple review takes 24-72h for initial approval' },
      { label: 'Publish future episodes via RSS', detail: 'Add episodes to your RSS feed — Apple Podcasts polls your feed every 24h' },
    ],
    contentTypes: ['podcast_episode', 'show_notes'],
  },
  {
    key: 'soundcloud',
    name: 'SoundCloud',
    emoji: '🎵',
    priority: 'yellow',
    businessUse: 'Music/audio discovery, podcast alternative, waveform community engagement',
    contentStrength: 'Audio-first community with waveform comments; DJ/music creator network',
    automationPotential: 'limited',
    connectorType: 'custom',
    requiredEnvVars: ['SOUNDCLOUD_CLIENT_ID', 'SOUNDCLOUD_ACCESS_TOKEN'],
    setupSteps: [
      { label: 'Create a SoundCloud account', url: 'https://soundcloud.com/', detail: 'A SoundCloud Pro account is needed for API upload access' },
      { label: 'Register an API application', url: 'https://soundcloud.com/you/apps/new', detail: 'Note: SoundCloud API access is heavily restricted — you may need to request access' },
      { label: 'Request API access', url: 'https://soundcloud.com/developers', detail: 'SoundCloud is no longer issuing new API keys to external developers as of 2021. Existing apps may still work.' },
      { label: 'Upload via SoundCloud app or web', detail: 'For new projects, upload tracks directly via soundcloud.com or the mobile app' },
    ],
    contentTypes: ['track_upload', 'playlist', 'repost'],
  },
  {
    key: 'patreon',
    name: 'Patreon',
    emoji: '🎨',
    priority: 'yellow',
    businessUse: 'Creator monetization, exclusive content, patron community building',
    contentStrength: 'Direct revenue from engaged fans; subscription + patron exclusivity',
    automationPotential: 'high',
    connectorType: 'custom',
    requiredEnvVars: ['PATREON_ACCESS_TOKEN', 'PATREON_CAMPAIGN_ID'],
    oauthUrl: 'https://www.patreon.com/portal/registration/register-clients',
    setupSteps: [
      { label: 'Create a Patreon creator page', url: 'https://www.patreon.com/create', detail: 'Set up tiers, pricing, and benefits before API access' },
      { label: 'Register an OAuth client', url: 'https://www.patreon.com/portal/registration/register-clients', detail: 'Get Client ID, Client Secret, and set redirect URIs' },
      { label: 'Complete OAuth flow to get Creator Access Token', url: 'https://docs.patreon.com/#oauth', detail: 'Authorization URL: https://www.patreon.com/oauth2/authorize' },
      { label: 'Find your Campaign ID', detail: 'Call GET https://www.patreon.com/api/oauth2/v2/campaigns with your token — copy the campaign id' },
      { label: 'Set env vars', detail: 'PATREON_ACCESS_TOKEN=<creator_token>\nPATREON_CAMPAIGN_ID=<campaign_id>' },
    ],
    contentTypes: ['creator_post', 'patron_only_post', 'audio_post', 'video_post', 'poll'],
  },
  {
    key: 'stack_overflow',
    name: 'Stack Overflow',
    emoji: '💻',
    priority: 'yellow',
    businessUse: 'Developer brand building, technical credibility, job board presence',
    contentStrength: 'Highest-trust developer community; answers rank in Google permanently',
    automationPotential: 'limited',
    connectorType: 'manual',
    requiredEnvVars: [],
    setupSteps: [
      { label: 'Create a Stack Overflow account', url: 'https://stackoverflow.com/users/signup', detail: 'Use a professional email; build reputation through genuine Q&A' },
      { label: 'Build 200+ reputation before posting extensively', detail: 'Low-reputation accounts have reduced posting privileges — answer first, then ask' },
      { label: 'Answer questions in your domain genuinely', detail: 'Stack Overflow detects and removes marketing content — only post technical value' },
      { label: 'For Teams (internal knowledge base)', url: 'https://stackoverflow.com/teams', detail: 'Stack Overflow for Teams is a separate paid product for internal docs' },
    ],
    contentTypes: ['question', 'answer', 'documentation_article'],
  },
];

// ─── Helper components ────────────────────────────────────────────────────────

const PRIORITY_CONFIG: Record<Priority, { label: string; color: string; dot: string }> = {
  red:    { label: 'High Priority',        color: 'bg-red-100 text-red-800 border border-red-300',    dot: 'bg-red-500' },
  orange: { label: 'Medium-High Priority', color: 'bg-orange-100 text-orange-800 border border-orange-300', dot: 'bg-orange-500' },
  yellow: { label: 'Medium Priority',      color: 'bg-yellow-100 text-yellow-800 border border-yellow-300', dot: 'bg-yellow-500' },
};

const AUTOMATION_CONFIG: Record<AutomationPotential, { label: string; color: string }> = {
  high:    { label: 'High Automation',    color: 'bg-green-100 text-green-800' },
  medium:  { label: 'Medium Automation',  color: 'bg-blue-100 text-blue-800' },
  limited: { label: 'Limited / Manual',   color: 'bg-gray-100 text-gray-700' },
};

const CONNECTOR_CONFIG: Record<ConnectorType, { label: string; color: string }> = {
  postiz:  { label: 'Postiz Connector', color: 'bg-purple-100 text-purple-800' },
  custom:  { label: 'Custom Connector', color: 'bg-indigo-100 text-indigo-800' },
  manual:  { label: 'Manual Only',      color: 'bg-gray-100 text-gray-600' },
};

function Badge({ text, color }: { text: string; color: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${color}`}>
      {text}
    </span>
  );
}

function PlatformCard({ guide }: { guide: PlatformGuide }) {
  const [open, setOpen] = useState(false);
  const pCfg = PRIORITY_CONFIG[guide.priority];
  const aCfg = AUTOMATION_CONFIG[guide.automationPotential];
  const cCfg = CONNECTOR_CONFIG[guide.connectorType];

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
      {/* Header */}
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 p-4 text-left"
      >
        <span className="text-2xl">{guide.emoji}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-gray-900">{guide.name}</h3>
            <Badge text={pCfg.label} color={pCfg.color} />
            <Badge text={aCfg.label} color={aCfg.color} />
            <Badge text={cCfg.label} color={cCfg.color} />
          </div>
          <p className="text-sm text-gray-500 mt-0.5 truncate">{guide.businessUse}</p>
        </div>
        {/* Status indicator */}
        <div className="flex-shrink-0 text-right">
          {guide.requiredEnvVars.length === 0 ? (
            <span className="text-xs px-2 py-1 bg-gray-100 text-gray-500 rounded-full">Manual Only</span>
          ) : guide.connectorType === 'postiz' ? (
            <span className="text-xs px-2 py-1 bg-purple-50 text-purple-600 rounded-full">Via Postiz</span>
          ) : (
            <span className="text-xs px-2 py-1 bg-yellow-50 text-yellow-700 rounded-full border border-yellow-200">Credentials Required</span>
          )}
        </div>
        <svg className={`w-5 h-5 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Expanded content */}
      {open && (
        <div className="border-t border-gray-100 p-4 space-y-4">
          {/* Business info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Business Use</h4>
              <p className="text-sm text-gray-700">{guide.businessUse}</p>
            </div>
            <div>
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Content Strength</h4>
              <p className="text-sm text-gray-700">{guide.contentStrength}</p>
            </div>
          </div>

          {/* Content types */}
          <div>
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Supported Content Types</h4>
            <div className="flex flex-wrap gap-1.5">
              {guide.contentTypes.map((ct) => (
                <span key={ct} className="px-2 py-0.5 bg-gray-100 rounded text-xs text-gray-600 font-mono">
                  {ct}
                </span>
              ))}
            </div>
          </div>

          {/* Required env vars */}
          {guide.requiredEnvVars.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Required Environment Variables</h4>
              <div className="space-y-1">
                {guide.requiredEnvVars.map((v) => (
                  <code key={v} className="block text-xs bg-gray-900 text-green-400 px-3 py-1 rounded font-mono">
                    {v}=&lt;configure_this&gt;
                  </code>
                ))}
              </div>
            </div>
          )}

          {/* Setup steps */}
          <div>
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Setup Steps</h4>
            <ol className="space-y-2">
              {guide.setupSteps.map((step, i) => (
                <li key={i} className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center font-medium">
                    {i + 1}
                  </span>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-800">{step.label}</span>
                      {step.url && (
                        <a href={step.url} target="_blank" rel="noopener noreferrer"
                           className="text-xs text-blue-600 hover:text-blue-800 underline">
                          Open →
                        </a>
                      )}
                    </div>
                    {step.detail && (
                      <p className="text-xs text-gray-500 mt-0.5 whitespace-pre-line">{step.detail}</p>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </div>

          {/* OAuth URL shortcut */}
          {guide.oauthUrl && (
            <a href={guide.oauthUrl} target="_blank" rel="noopener noreferrer"
               className="inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 font-medium">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              Open Developer Console
            </a>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function PlatformSetupGuidePage() {
  const [activeTab, setActiveTab] = useState<'all' | Priority>('all');
  const [search, setSearch] = useState('');

  const filtered = PLATFORMS.filter((p) => {
    if (activeTab !== 'all' && p.priority !== activeTab) return false;
    if (search) {
      const q = search.toLowerCase();
      return p.name.toLowerCase().includes(q)
        || p.key.toLowerCase().includes(q)
        || p.businessUse.toLowerCase().includes(q)
        || p.contentTypes.some((ct) => ct.includes(q));
    }
    return true;
  });

  const counts = {
    all: PLATFORMS.length,
    red: PLATFORMS.filter((p) => p.priority === 'red').length,
    orange: PLATFORMS.filter((p) => p.priority === 'orange').length,
    yellow: PLATFORMS.filter((p) => p.priority === 'yellow').length,
  };

  const TABS: Array<{ id: 'all' | Priority; label: string; count: number }> = [
    { id: 'all',    label: 'All Platforms',      count: counts.all },
    { id: 'red',    label: 'High Priority',      count: counts.red },
    { id: 'orange', label: 'Medium-High',        count: counts.orange },
    { id: 'yellow', label: 'Medium Priority',    count: counts.yellow },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Page header */}
      <div className="bg-white border-b border-gray-200 px-6 py-5">
        <div className="max-w-5xl mx-auto">
          <h1 className="text-2xl font-bold text-gray-900">Platform Setup Guide</h1>
          <p className="text-sm text-gray-500 mt-1">
            Step-by-step setup instructions, required credentials, and content types for all 28 social/content platforms.
          </p>

          {/* Summary stats */}
          <div className="flex gap-4 mt-4">
            <div className="flex items-center gap-1.5 text-sm text-gray-600">
              <span className="w-2 h-2 rounded-full bg-green-500" />
              {PLATFORMS.filter((p) => p.connectorType === 'postiz').length} via Postiz
            </div>
            <div className="flex items-center gap-1.5 text-sm text-gray-600">
              <span className="w-2 h-2 rounded-full bg-indigo-500" />
              {PLATFORMS.filter((p) => p.connectorType === 'custom').length} custom connectors
            </div>
            <div className="flex items-center gap-1.5 text-sm text-gray-600">
              <span className="w-2 h-2 rounded-full bg-gray-400" />
              {PLATFORMS.filter((p) => p.connectorType === 'manual').length} manual only
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-6">
        {/* Search + tabs */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <input
            type="text"
            placeholder="Search platforms, content types..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex gap-2 mb-6 flex-wrap">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-600 border border-gray-300 hover:bg-gray-50'
              }`}
            >
              {tab.label} ({tab.count})
            </button>
          ))}
        </div>

        {/* Platform cards */}
        <div className="space-y-3">
          {filtered.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              No platforms match your search.
            </div>
          ) : (
            filtered.map((guide) => (
              <PlatformCard key={guide.key} guide={guide} />
            ))
          )}
        </div>

        <p className="text-center text-xs text-gray-400 mt-8">
          {filtered.length} platform{filtered.length !== 1 ? 's' : ''} shown
          {search ? ` for "${search}"` : ''} — click any card to expand setup steps
        </p>
      </div>
    </div>
  );
}
