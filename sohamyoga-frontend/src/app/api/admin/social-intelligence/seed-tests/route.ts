import { NextResponse } from 'next/server';
import { query } from '@/lib/postgres';
import { ensureSocialIntelligenceSchema } from '@/lib/social-intelligence-schema';

interface ScenarioDef {
  platform: string;
  content_type: string;
  scenario_name: string;
  polarity: string;
  test_level: string;
  precondition: string;
  steps: object[];
  expected_result: string;
  api_endpoint: string | null;
  http_method: string | null;
  test_payload: object;
  tags: string[];
}

const PLATFORM_CONTENT_TYPES: Record<string, string[]> = {
  youtube:            ['video_post', 'short', 'live', 'community_post'],
  facebook:           ['text_post', 'image_post', 'carousel', 'story', 'reel', 'poll'],
  instagram:          ['image_post', 'carousel', 'reel', 'story', 'shopping_post'],
  x_twitter:          ['tweet', 'thread', 'poll', 'image_tweet'],
  linkedin:           ['text_post', 'article', 'document_post', 'video_post', 'newsletter'],
  tiktok:             ['video_post', 'live', 'photo_post'],
  // Extended platforms — new 28-platform coverage
  whatsapp_business:  ['text_message', 'image_message', 'template_message'],
  pinterest:          ['pin', 'idea_pin', 'video_pin'],
  reddit:             ['text_post', 'link_post', 'image_post'],
  snapchat:           ['story', 'spotlight'],
  discord:            ['channel_message', 'embed', 'announcement'],
  twitch:             ['stream_title_update', 'clip_promotion'],
  medium:             ['article', 'response'],
  substack:           ['newsletter', 'thread'],
  github:             ['release', 'discussion'],
  gitlab:             ['release', 'snippet'],
  google_business:    ['standard_post', 'event_post', 'offer_post'],
  yelp:               ['business_response', 'owner_post'],
  tripadvisor:        ['management_response', 'experience_update'],
  trustpilot:         ['review_invitation', 'review_response'],
  vimeo:              ['video_upload', 'showcase'],
  dailymotion:        ['video_upload', 'live_stream'],
  spotify:            ['podcast_episode', 'show_update'],
  apple_podcasts:     ['podcast_episode', 'show_notes'],
  soundcloud:         ['track_upload', 'playlist'],
  patreon:            ['creator_post', 'patron_only_post'],
  mastodon:           ['toot', 'poll'],
  bluesky:            ['post', 'thread'],
  tumblr:             ['text_post', 'photo_post', 'quote_post'],
  quora:              ['answer', 'space_post'],
  stack_overflow:     ['question', 'answer'],
};

const REQUIRED_FIELDS: Record<string, Record<string, string[]>> = {
  youtube:            { video_post: ['title', 'description'], short: ['title'], live: ['title', 'scheduled_time'], community_post: ['caption'] },
  facebook:           { text_post: ['caption'], image_post: ['caption', 'media_urls'], carousel: ['caption'], story: ['media_urls'], reel: ['media_urls'], poll: ['caption', 'options'] },
  instagram:          { image_post: ['caption', 'media_urls'], carousel: ['caption', 'media_urls'], reel: ['media_urls'], story: ['media_urls'], shopping_post: ['media_urls', 'product_tags'] },
  x_twitter:          { tweet: ['caption'], thread: ['caption'], poll: ['caption', 'options'], image_tweet: ['caption', 'media_urls'] },
  linkedin:           { text_post: ['caption'], article: ['title', 'description'], document_post: ['media_urls'], video_post: ['media_urls'], newsletter: ['title', 'description'] },
  tiktok:             { video_post: ['media_urls'], live: ['title'], photo_post: ['media_urls'] },
  // Extended platforms
  whatsapp_business:  { text_message: ['phone_number', 'text'], image_message: ['phone_number', 'image_url'], template_message: ['template_name', 'language_code'] },
  pinterest:          { pin: ['image_url', 'board_id'], idea_pin: ['media_urls', 'board_id'], video_pin: ['video_url', 'board_id'] },
  reddit:             { text_post: ['subreddit', 'title'], link_post: ['url', 'title', 'subreddit'], image_post: ['media_urls', 'title', 'subreddit'] },
  snapchat:           { story: ['media_file'], spotlight: ['media_file'] },
  discord:            { channel_message: ['channel_id', 'server_id'], embed: ['channel_id'], announcement: ['server_id'] },
  twitch:             { stream_title_update: ['channel_id'], clip_promotion: ['clip_id'] },
  medium:             { article: ['title'], response: ['parent_post_url'] },
  substack:           { newsletter: ['subject', 'body'], thread: ['body'] },
  github:             { release: ['tag_name', 'title', 'body'], discussion: ['title', 'body', 'category_id'] },
  gitlab:             { release: ['tag_name', 'title', 'description'], snippet: ['title', 'content'] },
  google_business:    { standard_post: ['summary'], event_post: ['title', 'start_date', 'end_date'], offer_post: ['title'] },
  yelp:               { business_response: ['review_id', 'text'], owner_post: ['text'] },
  tripadvisor:        { management_response: ['review_id', 'text'], experience_update: ['text'] },
  trustpilot:         { review_invitation: ['consumer_email', 'consumer_name'], review_response: ['review_id', 'text'] },
  vimeo:              { video_upload: ['video_url', 'title'], showcase: ['title'] },
  dailymotion:        { video_upload: ['video_url', 'title', 'tags'], live_stream: ['title', 'stream_key'] },
  spotify:            { podcast_episode: ['audio_url', 'title', 'description'], show_update: ['description'] },
  apple_podcasts:     { podcast_episode: ['title', 'description', 'audio_url'], show_notes: ['notes'] },
  soundcloud:         { track_upload: ['audio_url', 'title'], playlist: ['title', 'track_ids'] },
  patreon:            { creator_post: ['title', 'content'], patron_only_post: ['title', 'content', 'min_tier_cents'] },
  mastodon:           { toot: [], poll: ['options'] },
  bluesky:            { post: [], thread: [] },
  tumblr:             { text_post: ['body'], photo_post: ['media_urls'], quote_post: ['quote', 'source'] },
  quora:              { answer: ['question_url', 'answer_text'], space_post: ['space_id', 'body'] },
  stack_overflow:     { question: ['title', 'body', 'tags'], answer: ['question_id', 'body'] },
};

const CHAR_LIMITS: Record<string, Record<string, number>> = {
  youtube:            { video_post: 5000, short: 100, live: 500, community_post: 5000 },
  facebook:           { text_post: 63206, image_post: 63206, carousel: 63206, story: 15, reel: 2200, poll: 500 },
  instagram:          { image_post: 2200, carousel: 2200, reel: 2200, story: 150, shopping_post: 2200 },
  x_twitter:          { tweet: 280, thread: 280, poll: 280, image_tweet: 280 },
  linkedin:           { text_post: 3000, article: 120000, document_post: 3000, video_post: 3000, newsletter: 120000 },
  tiktok:             { video_post: 2200, live: 500, photo_post: 2200 },
  // Extended platforms
  whatsapp_business:  { text_message: 4096, image_message: 1024, template_message: 1024 },
  pinterest:          { pin: 500, idea_pin: 250, video_pin: 500 },
  reddit:             { text_post: 40000, link_post: 300, image_post: 500 },
  snapchat:           { story: 250, spotlight: 250 },
  discord:            { channel_message: 2000, embed: 4096, announcement: 2000 },
  twitch:             { stream_title_update: 140, clip_promotion: 500 },
  medium:             { article: 100000, response: 5000 },
  substack:           { newsletter: 500000, thread: 500 },
  github:             { release: 50000, discussion: 65536 },
  gitlab:             { release: 50000, snippet: 1000000 },
  google_business:    { standard_post: 1500, event_post: 1500, offer_post: 1500 },
  yelp:               { business_response: 5000, owner_post: 5000 },
  tripadvisor:        { management_response: 2000, experience_update: 2000 },
  trustpilot:         { review_invitation: 2000, review_response: 3000 },
  vimeo:              { video_upload: 5000, showcase: 2000 },
  dailymotion:        { video_upload: 2000, live_stream: 2000 },
  spotify:            { podcast_episode: 4000, show_update: 500 },
  apple_podcasts:     { podcast_episode: 4000, show_notes: 2000 },
  soundcloud:         { track_upload: 5000, playlist: 2000 },
  patreon:            { creator_post: 50000, patron_only_post: 50000 },
  mastodon:           { toot: 500, poll: 500 },
  bluesky:            { post: 300, thread: 300 },
  tumblr:             { text_post: 500000, photo_post: 10000, quote_post: 1000 },
  quora:              { answer: 100000, space_post: 50000 },
  stack_overflow:     { question: 30000, answer: 30000 },
};

function buildScenarios(platform: string, contentType: string): ScenarioDef[] {
  const requiredFields = REQUIRED_FIELDS[platform]?.[contentType] ?? ['caption'];
  const charLimit = CHAR_LIMITS[platform]?.[contentType] ?? 2200;
  const missingField = requiredFields[0] ?? 'caption';

  return [
    {
      platform, content_type: contentType,
      scenario_name: `TC-POSITIVE-01: Publish ${contentType} on ${platform} — happy path`,
      polarity: 'positive', test_level: 'e2e',
      precondition: `Social account connected for ${platform}`,
      steps: [
        { step: 1, action: 'Create draft', detail: `POST /api/admin/social-intelligence/variants with platform=${platform}, content_type=${contentType}` },
        { step: 2, action: 'Fill required fields', detail: `Provide: ${requiredFields.join(', ')}` },
        { step: 3, action: 'Schedule post', detail: 'POST /api/admin/social-intelligence/calendar with scheduled_at in future' },
        { step: 4, action: 'Verify in social_post table', detail: 'GET /api/admin/social-intelligence/variants?platform=' + platform },
      ],
      expected_result: 'Variant created with status=draft, calendar entry created with status=scheduled',
      api_endpoint: '/api/admin/social-intelligence/variants',
      http_method: 'POST',
      test_payload: { platform, content_type: contentType, caption: 'Test post content', status: 'draft' },
      tags: [platform, contentType, 'happy-path'],
    },
    {
      platform, content_type: contentType,
      scenario_name: `TC-POSITIVE-02: Generate ${contentType} on ${platform} with AI`,
      polarity: 'positive', test_level: 'agentic',
      precondition: 'Ollama llama3.2 running at localhost:11434',
      steps: [
        { step: 1, action: 'Call AI generate endpoint', detail: `POST /api/admin/social-intelligence/ai-generate with platform=${platform}, content_type=${contentType}, topic=morning yoga` },
        { step: 2, action: 'Verify caption not empty', detail: 'Assert response.caption.length > 0' },
        { step: 3, action: 'Verify char count within limit', detail: `Assert response.char_count <= ${charLimit}` },
        { step: 4, action: 'Verify hashtags array', detail: 'Assert response.hashtags is array with length >= 1' },
      ],
      expected_result: `Caption generated, char_count <= ${charLimit}, hashtags array present`,
      api_endpoint: '/api/admin/social-intelligence/ai-generate',
      http_method: 'POST',
      test_payload: { platform, content_type: contentType, topic: 'morning yoga', tone: 'inspirational', niche: 'yoga' },
      tags: [platform, contentType, 'agentic', 'ollama'],
    },
    {
      platform, content_type: contentType,
      scenario_name: `TC-NEGATIVE-01: Missing required field '${missingField}' on ${platform} ${contentType}`,
      polarity: 'negative', test_level: 'api',
      precondition: 'API accessible',
      steps: [
        { step: 1, action: 'POST variant without platform field', detail: 'POST /api/admin/social-intelligence/variants with body missing platform' },
        { step: 2, action: 'Assert 400 status', detail: 'Response status must be 400' },
        { step: 3, action: 'Assert error message', detail: 'Response body contains error field' },
      ],
      expected_result: '400 Bad Request with error message about missing required field',
      api_endpoint: '/api/admin/social-intelligence/variants',
      http_method: 'POST',
      test_payload: { content_type: contentType, caption: 'test' },
      tags: [platform, contentType, 'validation', 'negative'],
    },
    {
      platform, content_type: contentType,
      scenario_name: `TC-NEGATIVE-02: Caption over ${charLimit} chars on ${platform} ${contentType}`,
      polarity: 'negative', test_level: 'ui',
      precondition: 'Social Intelligence Hub loaded in browser',
      steps: [
        { step: 1, action: 'Open content composer', detail: 'Navigate to /admin/social-intelligence?tab=content-composer' },
        { step: 2, action: 'Select platform and content type', detail: `Select ${platform} and ${contentType}` },
        { step: 3, action: 'Paste oversized caption', detail: `Paste text of ${charLimit + 100} characters` },
        { step: 4, action: 'Observe char counter', detail: 'Char counter should show red, submit button disabled' },
      ],
      expected_result: 'Char counter turns red, submit blocked, user sees warning',
      api_endpoint: null,
      http_method: null,
      test_payload: {},
      tags: [platform, contentType, 'ui', 'validation'],
    },
    {
      platform, content_type: contentType,
      scenario_name: `TC-BOUNDARY-01: Caption exactly at ${charLimit} chars on ${platform} ${contentType}`,
      polarity: 'boundary', test_level: 'ui',
      precondition: 'Social Intelligence Hub loaded',
      steps: [
        { step: 1, action: 'Open content composer', detail: 'Navigate to /admin/social-intelligence?tab=content-composer' },
        { step: 2, action: 'Enter caption exactly at limit', detail: `Type exactly ${charLimit} characters` },
        { step: 3, action: 'Verify acceptance', detail: 'Submit should be enabled, no truncation warning' },
      ],
      expected_result: `Caption of exactly ${charLimit} chars accepted without truncation`,
      api_endpoint: null,
      http_method: null,
      test_payload: {},
      tags: [platform, contentType, 'boundary'],
    },
    {
      platform, content_type: contentType,
      scenario_name: `TC-BOUNDARY-02: Maximum media count for ${platform} ${contentType}`,
      polarity: 'boundary', test_level: 'e2e',
      precondition: 'Social Intelligence Hub accessible',
      steps: [
        { step: 1, action: 'Create variant with max media', detail: `POST /api/admin/social-intelligence/variants with max allowed media_urls array` },
        { step: 2, action: 'Verify acceptance', detail: 'Response 201 with all media_urls stored' },
        { step: 3, action: 'Attempt one more media', detail: 'UI should prevent adding beyond limit' },
      ],
      expected_result: 'Max media count accepted, adding beyond limit blocked',
      api_endpoint: '/api/admin/social-intelligence/variants',
      http_method: 'POST',
      test_payload: { platform, content_type: contentType, caption: 'test', media_urls: ['url1', 'url2', 'url3'] },
      tags: [platform, contentType, 'boundary', 'media'],
    },
    {
      platform, content_type: contentType,
      scenario_name: `TC-TENANT-01: Yoga studio scheduling ${contentType} on ${platform} with tenant config`,
      polarity: 'positive', test_level: 'e2e',
      precondition: 'Tenant config seeded for yoga_studio + ' + platform,
      steps: [
        { step: 1, action: 'Load tenant config', detail: `GET /api/admin/social-intelligence/tenant-config?tenant_type=yoga_studio&platform=${platform}` },
        { step: 2, action: 'Apply config to composer', detail: 'Pre-fill tone, hashtags, best posting time from tenant config' },
        { step: 3, action: 'Create variant with tenant settings', detail: 'POST variant using tenant-recommended settings' },
        { step: 4, action: 'Schedule at tenant best time', detail: 'Create calendar entry at recommended time' },
        { step: 5, action: 'Verify in calendar', detail: 'GET /api/admin/social-intelligence/calendar and confirm entry exists' },
      ],
      expected_result: 'Post created using yoga_studio tenant config, scheduled at recommended time',
      api_endpoint: '/api/admin/social-intelligence/tenant-config',
      http_method: 'GET',
      test_payload: { tenant_type: 'yoga_studio', platform },
      tags: [platform, contentType, 'tenant', 'yoga_studio'],
    },
  ];
}

// API-level test cases for endpoints themselves
function buildApiTests(): ScenarioDef[] {
  return [
    {
      platform: 'all', content_type: 'all',
      scenario_name: 'TC-API-01: GET /configs?platform=youtube returns 200 array',
      polarity: 'positive', test_level: 'api',
      precondition: 'Configs seeded via /api/admin/social-intelligence/seed-configs',
      steps: [
        { step: 1, action: 'GET /api/admin/social-intelligence/configs?platform=youtube' },
        { step: 2, action: 'Assert status 200' },
        { step: 3, action: 'Assert response.configs is array' },
      ],
      expected_result: '200 OK with configs array for youtube platform',
      api_endpoint: '/api/admin/social-intelligence/configs',
      http_method: 'GET',
      test_payload: { platform: 'youtube' },
      tags: ['api', 'configs'],
    },
    {
      platform: 'all', content_type: 'all',
      scenario_name: 'TC-API-02: POST /variants valid payload returns 201',
      polarity: 'positive', test_level: 'api',
      precondition: 'API accessible',
      steps: [
        { step: 1, action: 'POST /api/admin/social-intelligence/variants', detail: 'With valid platform + content_type' },
        { step: 2, action: 'Assert status 201' },
        { step: 3, action: 'Assert variant.id present' },
      ],
      expected_result: '201 Created with variant object including id',
      api_endpoint: '/api/admin/social-intelligence/variants',
      http_method: 'POST',
      test_payload: { platform: 'instagram', content_type: 'reel', caption: 'Test reel content' },
      tags: ['api', 'variants'],
    },
    {
      platform: 'all', content_type: 'all',
      scenario_name: 'TC-API-03: POST /variants missing platform returns 400',
      polarity: 'negative', test_level: 'api',
      precondition: 'API accessible',
      steps: [
        { step: 1, action: 'POST /api/admin/social-intelligence/variants without platform field' },
        { step: 2, action: 'Assert status 400' },
        { step: 3, action: 'Assert response.error is present' },
      ],
      expected_result: '400 Bad Request with error about missing platform',
      api_endpoint: '/api/admin/social-intelligence/variants',
      http_method: 'POST',
      test_payload: { content_type: 'reel', caption: 'no platform' },
      tags: ['api', 'variants', 'validation'],
    },
    {
      platform: 'all', content_type: 'all',
      scenario_name: 'TC-API-04: GET /calendar returns 200 with entries array',
      polarity: 'positive', test_level: 'api',
      precondition: 'API accessible',
      steps: [
        { step: 1, action: 'GET /api/admin/social-intelligence/calendar' },
        { step: 2, action: 'Assert status 200' },
        { step: 3, action: 'Assert response.entries is array' },
      ],
      expected_result: '200 OK with entries array',
      api_endpoint: '/api/admin/social-intelligence/calendar',
      http_method: 'GET',
      test_payload: {},
      tags: ['api', 'calendar'],
    },
  ];
}

export async function POST() {
  await ensureSocialIntelligenceSchema();

  let inserted = 0;
  let skipped = 0;

  // Generate scenarios for all platform × content_type combinations
  const allScenarios: ScenarioDef[] = [];
  for (const [platform, contentTypes] of Object.entries(PLATFORM_CONTENT_TYPES)) {
    for (const contentType of contentTypes) {
      allScenarios.push(...buildScenarios(platform, contentType));
    }
  }
  allScenarios.push(...buildApiTests());

  for (const s of allScenarios) {
    const result = await query(
      `INSERT INTO social_test_scenario
         (platform, content_type, scenario_name, polarity, test_level, precondition, steps, expected_result, api_endpoint, http_method, test_payload, tags)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       ON CONFLICT (scenario_name, platform, content_type) DO NOTHING`,
      [
        s.platform, s.content_type, s.scenario_name, s.polarity, s.test_level,
        s.precondition, JSON.stringify(s.steps), s.expected_result,
        s.api_endpoint, s.http_method, JSON.stringify(s.test_payload), s.tags,
      ],
    );
    if ((result.rowCount ?? 0) > 0) inserted++; else skipped++;
  }

  return NextResponse.json({ inserted, skipped, total: allScenarios.length });
}
