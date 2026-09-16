// platform-adapters.ts — Extended platform adapters for custom_connector platforms.
// Mirrors the pattern of first-wave-adapters.ts: readiness check + publish function.
// All adapters are credential-gated — missing credentials return status='manual_required'
// rather than throwing, so callers can display a helpful setup message.

export type ExtendedPlatform =
  | 'whatsapp_business' | 'pinterest' | 'github' | 'gitlab'
  | 'google_business' | 'trustpilot' | 'vimeo' | 'soundcloud'
  | 'patreon' | 'dailymotion' | 'snapchat' | 'twitch' | 'medium'
  | 'substack' | 'spotify' | 'tripadvisor' | 'yelp';

export type RuntimeSecret = Record<string, string>;

export type PublishInput = {
  text: string;
  title?: string;
  mediaUrls?: string[];
  linkUrl?: string;
  tags?: string[];
  externalAccountId: string;
  idempotencyKey: string;
  platformSpecific?: Record<string, unknown>;
};

export type PublishResult = {
  externalId?: string;
  externalUrl?: string;
  status: 'published' | 'queued' | 'manual_required';
  message?: string;
};

// ─── Required credential keys per platform ────────────────────────────────────

const REQUIRED_KEYS: Record<ExtendedPlatform, string[]> = {
  whatsapp_business: ['WHATSAPP_PHONE_NUMBER_ID', 'WHATSAPP_ACCESS_TOKEN'],
  pinterest:         ['PINTEREST_ACCESS_TOKEN'],
  github:            ['GITHUB_TOKEN', 'GITHUB_OWNER', 'GITHUB_REPO'],
  gitlab:            ['GITLAB_TOKEN', 'GITLAB_PROJECT_ID'],
  google_business:   ['GOOGLE_BUSINESS_ACCOUNT_ID', 'GOOGLE_BUSINESS_ACCESS_TOKEN'],
  trustpilot:        ['TRUSTPILOT_API_KEY', 'TRUSTPILOT_API_SECRET', 'TRUSTPILOT_BUSINESS_UNIT_ID'],
  vimeo:             ['VIMEO_ACCESS_TOKEN'],
  soundcloud:        ['SOUNDCLOUD_CLIENT_ID', 'SOUNDCLOUD_ACCESS_TOKEN'],
  patreon:           ['PATREON_ACCESS_TOKEN', 'PATREON_CAMPAIGN_ID'],
  dailymotion:       ['DAILYMOTION_CLIENT_ID', 'DAILYMOTION_CLIENT_SECRET', 'DAILYMOTION_ACCESS_TOKEN'],
  snapchat:          ['SNAPCHAT_ACCESS_TOKEN', 'SNAPCHAT_AD_ACCOUNT_ID'],
  twitch:            ['TWITCH_CLIENT_ID', 'TWITCH_ACCESS_TOKEN'],
  medium:            ['MEDIUM_INTEGRATION_TOKEN'],
  // Manual-only platforms — no credentials required (but they return manual_required always)
  substack:          [],
  spotify:           [],
  tripadvisor:       [],
  yelp:              [],
};

// ─── Readiness check ──────────────────────────────────────────────────────────

export function extendedAdapterReadiness(
  platform: ExtendedPlatform,
  secret: RuntimeSecret,
): { ready: boolean; missing: string[] } {
  const required = REQUIRED_KEYS[platform] ?? [];
  const missing = required.filter((k) => !secret[k]?.trim());
  return { ready: missing.length === 0, missing };
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

async function fetchJson(
  url: string | URL,
  init: RequestInit,
  request: typeof fetch = fetch,
): Promise<Record<string, unknown>> {
  const res = await request(url as string, init);
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const msg = (body.message ?? body.error ?? body.detail ?? res.statusText) as string;
    throw new Error(`[${res.status}] ${msg}`);
  }
  return body;
}

function credentialMissing(platform: string, keys: string[]): PublishResult {
  return {
    status: 'manual_required',
    message: `Configure ${keys.join(', ')} in environment to enable ${platform} publishing.`,
  };
}

// ─── Individual platform publish implementations ───────────────────────────────

async function publishWhatsApp(input: PublishInput, s: RuntimeSecret, req: typeof fetch): Promise<PublishResult> {
  const phoneNumberId = s['WHATSAPP_PHONE_NUMBER_ID'];
  const token = s['WHATSAPP_ACCESS_TOKEN'];
  const hasMedia = (input.mediaUrls?.length ?? 0) > 0;

  const messageBody: Record<string, unknown> = hasMedia
    ? {
        messaging_product: 'whatsapp',
        to: input.externalAccountId,
        type: 'image',
        image: { link: input.mediaUrls![0] },
      }
    : {
        messaging_product: 'whatsapp',
        to: input.externalAccountId,
        type: 'text',
        text: { body: input.text },
      };

  const body = await fetchJson(
    `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(messageBody),
    },
    req,
  );

  const messages = body.messages as Array<{ id: string }> | undefined;
  return { status: 'published', externalId: messages?.[0]?.id };
}

async function publishPinterest(input: PublishInput, s: RuntimeSecret, req: typeof fetch): Promise<PublishResult> {
  if ((input.mediaUrls?.length ?? 0) === 0) {
    return { status: 'manual_required', message: 'Pinterest pins require at least one image URL (mediaUrls).' };
  }

  const body = await fetchJson(
    'https://api.pinterest.com/v5/pins',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${s['PINTEREST_ACCESS_TOKEN']}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        board_id: input.externalAccountId,
        title: input.title,
        description: input.text,
        media_source: { source_type: 'image_url', url: input.mediaUrls![0] },
        ...(input.linkUrl ? { link: input.linkUrl } : {}),
      }),
    },
    req,
  );

  const pin = body as { id?: string; link?: string };
  return { status: 'published', externalId: pin.id };
}

async function publishGitHub(input: PublishInput, s: RuntimeSecret, req: typeof fetch): Promise<PublishResult> {
  const owner = s['GITHUB_OWNER'];
  const repo = s['GITHUB_REPO'];
  const tag = (input.platformSpecific?.tag as string | undefined) ?? 'v0.0.1';

  const body = await fetchJson(
    `https://api.github.com/repos/${owner}/${repo}/releases`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${s['GITHUB_TOKEN']}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        tag_name: tag,
        name: input.title ?? tag,
        body: input.text,
        draft: false,
      }),
    },
    req,
  );

  const release = body as { id?: number; html_url?: string };
  return { status: 'published', externalId: String(release.id ?? ''), externalUrl: release.html_url };
}

async function publishGitLab(input: PublishInput, s: RuntimeSecret, req: typeof fetch): Promise<PublishResult> {
  const projectId = s['GITLAB_PROJECT_ID'];
  const tag = (input.platformSpecific?.tag as string | undefined) ?? 'v0.0.1';

  const body = await fetchJson(
    `https://gitlab.com/api/v4/projects/${encodeURIComponent(projectId)}/releases`,
    {
      method: 'POST',
      headers: {
        'PRIVATE-TOKEN': s['GITLAB_TOKEN'],
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: input.title ?? tag,
        tag_name: tag,
        description: input.text,
      }),
    },
    req,
  );

  const links = (body._links as Record<string, string> | undefined);
  return { status: 'published', externalUrl: links?.self };
}

async function publishGoogleBusiness(input: PublishInput, s: RuntimeSecret, req: typeof fetch): Promise<PublishResult> {
  const accountId = s['GOOGLE_BUSINESS_ACCOUNT_ID'];
  const token = s['GOOGLE_BUSINESS_ACCESS_TOKEN'];

  const postBody: Record<string, unknown> = {
    languageCode: 'en-US',
    summary: input.text,
  };
  if (input.linkUrl) {
    postBody.callToAction = { actionType: 'LEARN_MORE', url: input.linkUrl };
  }
  if ((input.mediaUrls?.length ?? 0) > 0) {
    postBody.media = input.mediaUrls!.map((u) => ({ mediaFormat: 'PHOTO', sourceUrl: u }));
  }

  const body = await fetchJson(
    `https://mybusiness.googleapis.com/v4/accounts/${accountId}/locations/${input.externalAccountId}/localPosts`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(postBody),
    },
    req,
  );

  const post = body as { name?: string };
  return { status: 'published', externalId: post.name };
}

async function publishTrustpilot(input: PublishInput, s: RuntimeSecret, req: typeof fetch): Promise<PublishResult> {
  const businessUnitId = s['TRUSTPILOT_BUSINESS_UNIT_ID'];
  const invBody: Record<string, unknown> = {
    referenceId: input.idempotencyKey,
  };
  if (input.platformSpecific?.email) invBody.consumerEmail = input.platformSpecific.email;
  if (input.platformSpecific?.name) invBody.consumerName = input.platformSpecific.name;
  if (input.platformSpecific?.templateId) {
    invBody.serviceReviewInvitation = { templateId: input.platformSpecific.templateId };
  }

  // Use Basic auth: base64(apiKey:apiSecret)
  const creds = Buffer.from(`${s['TRUSTPILOT_API_KEY']}:${s['TRUSTPILOT_API_SECRET']}`).toString('base64');

  await fetchJson(
    `https://api.trustpilot.com/v1/private/business-units/${businessUnitId}/invitations`,
    {
      method: 'POST',
      headers: { Authorization: `Basic ${creds}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(invBody),
    },
    req,
  );

  return { status: 'queued', message: 'Trustpilot review invitation sent.' };
}

async function publishVimeo(input: PublishInput, s: RuntimeSecret, req: typeof fetch): Promise<PublishResult> {
  if ((input.mediaUrls?.length ?? 0) === 0) {
    return { status: 'manual_required', message: 'Vimeo video upload requires a mediaUrls[0] pull URL.' };
  }

  const body = await fetchJson(
    'https://api.vimeo.com/me/videos',
    {
      method: 'POST',
      headers: {
        Authorization: `bearer ${s['VIMEO_ACCESS_TOKEN']}`,
        'Content-Type': 'application/json',
        Accept: 'application/vnd.vimeo.*+json;version=3.4',
      },
      body: JSON.stringify({
        upload: { approach: 'pull', link: input.mediaUrls![0] },
        name: input.title ?? 'Untitled',
        description: input.text,
      }),
    },
    req,
  );

  const video = body as { link?: string; uri?: string };
  return { status: 'published', externalUrl: video.link, externalId: video.uri };
}

function publishSoundCloud(): PublishResult {
  return {
    status: 'manual_required',
    message: 'Use the SoundCloud app to upload your audio file, then link the track URL here. SoundCloud API does not support programmatic file upload without multipart binary streaming.',
  };
}

async function publishPatreon(input: PublishInput, s: RuntimeSecret, req: typeof fetch): Promise<PublishResult> {
  const campaignId = s['PATREON_CAMPAIGN_ID'];

  const body = await fetchJson(
    'https://www.patreon.com/api/oauth2/v2/posts',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${s['PATREON_ACCESS_TOKEN']}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        data: {
          type: 'post',
          attributes: {
            title: input.title ?? 'New Post',
            content: input.text,
            is_public: true,
            post_type: 'text_only',
          },
          relationships: {
            campaign: { data: { type: 'campaign', id: campaignId } },
          },
        },
      }),
    },
    req,
  );

  const post = body.data as { id?: string; attributes?: { url?: string } } | undefined;
  return { status: 'published', externalId: post?.id, externalUrl: post?.attributes?.url };
}

async function publishDailymotion(input: PublishInput, s: RuntimeSecret, req: typeof fetch): Promise<PublishResult> {
  if ((input.mediaUrls?.length ?? 0) === 0) {
    return { status: 'manual_required', message: 'Dailymotion requires a video URL (mediaUrls[0]) to import.' };
  }

  const params = new URLSearchParams({
    url: input.mediaUrls![0],
    title: input.title ?? input.text.slice(0, 255),
    description: input.text,
    ...(input.tags?.length ? { tags: input.tags.join(',') } : {}),
  });

  const body = await fetchJson(
    'https://api.dailymotion.com/videos',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${s['DAILYMOTION_ACCESS_TOKEN']}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    },
    req,
  );

  const video = body as { id?: string; url?: string };
  return { status: 'published', externalId: video.id, externalUrl: video.url };
}

function publishSnapchat(): PublishResult {
  return {
    status: 'manual_required',
    message: 'Snapchat organic posting requires the Snapchat app — there is no organic post API. Ad creatives can be managed via the Snap Marketing API at adsapi.snapchat.com.',
  };
}

async function publishMedium(input: PublishInput, s: RuntimeSecret, req: typeof fetch): Promise<PublishResult> {
  const token = s['MEDIUM_INTEGRATION_TOKEN'];

  // Resolve the user ID first
  const me = await fetchJson(
    'https://api.medium.com/v1/me',
    { headers: { Authorization: `Bearer ${token}` } },
    req,
  );
  const userId = ((me.data as Record<string, unknown>)?.id ?? input.externalAccountId) as string;

  const body = await fetchJson(
    `https://api.medium.com/v1/users/${userId}/posts`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: input.title ?? 'Untitled',
        contentFormat: 'markdown',
        content: input.text,
        tags: input.tags ?? [],
        publishStatus: 'public',
      }),
    },
    req,
  );

  const post = (body.data as Record<string, unknown> | undefined);
  return { status: 'published', externalId: post?.id as string | undefined, externalUrl: post?.url as string | undefined };
}

async function publishTwitch(input: PublishInput, s: RuntimeSecret, req: typeof fetch): Promise<PublishResult> {
  await fetchJson(
    `https://api.twitch.tv/helix/channels?broadcaster_id=${encodeURIComponent(input.externalAccountId)}`,
    {
      method: 'PATCH',
      headers: {
        'Client-ID': s['TWITCH_CLIENT_ID'],
        Authorization: `Bearer ${s['TWITCH_ACCESS_TOKEN']}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        game_name: (input.platformSpecific?.game as string | undefined) ?? 'Just Chatting',
        title: input.text.slice(0, 140),
      }),
    },
    req,
  );

  return { status: 'published', message: 'Twitch channel title updated.' };
}

function publishSubstack(): PublishResult {
  return {
    status: 'manual_required',
    message: 'Substack has no public API. Post manually at substack.com or use email newsletter automation (Listmonk/Mailchimp) to distribute content.',
  };
}

function publishSpotify(): PublishResult {
  return {
    status: 'manual_required',
    message: 'Spotify Podcasts has no public publishing API. Submit your podcast RSS feed through Spotify for Podcasters at podcasters.spotify.com.',
  };
}

function publishTripadvisor(): PublishResult {
  return {
    status: 'manual_required',
    message: 'TripAdvisor API is read-only for reviews. Respond to reviews via your TripAdvisor Management Center at tripadvisor.com/owners.',
  };
}

function publishYelp(): PublishResult {
  return {
    status: 'manual_required',
    message: 'Yelp Fusion API is read-only. Respond to reviews via Yelp for Business at biz.yelp.com.',
  };
}

// ─── Main dispatch function ───────────────────────────────────────────────────

export async function publishExtendedPlatform(
  platform: ExtendedPlatform,
  input: PublishInput,
  secret: RuntimeSecret,
  request: typeof fetch = fetch,
): Promise<PublishResult> {
  // Credential gate
  const readiness = extendedAdapterReadiness(platform, secret);
  if (!readiness.ready) {
    return credentialMissing(platform, readiness.missing);
  }

  if (!input.text.trim() && platform !== 'twitch') {
    return { status: 'manual_required', message: 'Post text is required.' };
  }

  switch (platform) {
    case 'whatsapp_business': return publishWhatsApp(input, secret, request);
    case 'pinterest':         return publishPinterest(input, secret, request);
    case 'github':            return publishGitHub(input, secret, request);
    case 'gitlab':            return publishGitLab(input, secret, request);
    case 'google_business':   return publishGoogleBusiness(input, secret, request);
    case 'trustpilot':        return publishTrustpilot(input, secret, request);
    case 'vimeo':             return publishVimeo(input, secret, request);
    case 'soundcloud':        return publishSoundCloud();
    case 'patreon':           return publishPatreon(input, secret, request);
    case 'dailymotion':       return publishDailymotion(input, secret, request);
    case 'snapchat':          return publishSnapchat();
    case 'twitch':            return publishTwitch(input, secret, request);
    case 'medium':            return publishMedium(input, secret, request);
    case 'substack':          return publishSubstack();
    case 'spotify':           return publishSpotify();
    case 'tripadvisor':       return publishTripadvisor();
    case 'yelp':              return publishYelp();
  }
}
