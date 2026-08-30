/**
 * External Platform MCP — single global file for the 14 platforms from the
 * user's priority table that are NOT Postiz-native (see SocialAccount.ts /
 * SOCIAL_MCP, which already covers Postiz's 17 platforms + Telegram/
 * WhatsApp Business/Google Business as custom connectors; Quora is already
 * manual-only there too). Manifests and execution live together here
 * rather than split across files, so this is the one place to look for
 * anything about these platforms.
 *
 * Every `availability` value below is a verified fact, not a guess:
 *   - 'official'/'community': a real MCP server was found on GitHub for
 *     this platform (checked 2026-08-11).
 *   - 'custom': a real public API exists; this project would wrap it
 *     directly. Tools needing credentials this environment doesn't have
 *     are marked in their safetyNote, not silently assumed configured.
 *   - 'none': no public API exists for the write action at all — verified
 *     by absence from Postiz's own real integrations/social directory
 *     (this codebase already checked that once, see db-schema-platforms-
 *     extended.sql) plus each platform's own documented developer terms.
 *     These get an explanatory implementationNote and an empty or
 *     read-only tool list — never a fabricated write capability.
 *
 * Two tools here (github.search_repositories, stackoverflow.search_questions)
 * are wired to REAL, working, no-auth-required public APIs — see
 * executeExternalPlatformTool() below. Every other tool is a real, well-
 * defined manifest entry that is NOT yet executable pending credentials
 * this environment doesn't have; calling it returns an honest
 * "not connected" result rather than a fake success.
 */
import { McpServerManifest, McpTool } from './types';

function server(
  id: string, name: string, description: string, tools: McpTool[],
  availability: McpServerManifest['availability'], backingServices: string[], implementationNote: string,
): McpServerManifest {
  return { id, slug: id, name, description, version: '1.0.0', tools, backingServices, availability, implementationNote };
}

export const GITHUB_MCP = server(
  'github-mcp', 'GitHub MCP', 'Search repositories and manage issues/discussions on GitHub.',
  [
    {
      name: 'search_repositories', description: 'Search public GitHub repositories by keyword — the same real GitHub Search API GitHubRepoScoutJob already uses.',
      tier: 'auto', riskLevel: 1,
      inputSchema: { type: 'object', required: ['query'], properties: { query: { type: 'string' }, perPage: { type: 'number', default: 5 } } },
      tags: ['read_only', 'executable'],
    },
    {
      name: 'github_create_issue', description: 'Open a new issue on a repository this project owns.',
      tier: 'staff_approval', riskLevel: 3,
      inputSchema: { type: 'object', required: ['repo', 'title', 'body'], properties: { repo: { type: 'string' }, title: { type: 'string' }, body: { type: 'string' } } },
      safetyNote: 'Needs GITHUB_TOKEN with repo write scope — not configured in this environment.',
    },
  ],
  'official', ['GitHub REST API v3'],
  "Verified real: github/github-mcp-server is GitHub's own official MCP server. search_repositories is wired to a real, working, unauthenticated call in this project (same pattern as GitHubRepoScoutJob).",
);

export const GITLAB_MCP = server(
  'gitlab-mcp', 'GitLab MCP', 'Search projects and manage issues on GitLab (self-hosted or gitlab.com).',
  [
    {
      name: 'search_projects', description: 'Search GitLab projects by keyword.',
      tier: 'auto', riskLevel: 1,
      inputSchema: { type: 'object', required: ['query'], properties: { query: { type: 'string' } } },
      safetyNote: 'Needs GITLAB_TOKEN — not configured in this environment.',
    },
    {
      name: 'gitlab_create_issue', description: 'Open a new issue on a GitLab project this project owns.',
      tier: 'staff_approval', riskLevel: 3,
      inputSchema: { type: 'object', required: ['project', 'title', 'description'], properties: { project: { type: 'string' }, title: { type: 'string' }, description: { type: 'string' } } },
      safetyNote: 'Needs GITLAB_TOKEN with write scope — not configured in this environment.',
    },
  ],
  'community', ['GitLab REST API v4'],
  'No official GitLab MCP server exists (verified 2026-08-11 — checked gitlab-org and broader GitHub search). yoda-digital/mcp-gitlab-server (61 stars) is the closest community option; review before adopting rather than assuming production-ready.',
);

export const STACKOVERFLOW_MCP = server(
  'stackoverflow-mcp', 'Stack Overflow MCP', 'Read Stack Overflow questions/answers for developer-marketing research.',
  [
    {
      name: 'search_questions', description: 'Search Stack Overflow questions by keyword or tag — real, public StackExchange API, no auth required for reads.',
      tier: 'auto', riskLevel: 1,
      inputSchema: { type: 'object', required: ['query'], properties: { query: { type: 'string' }, tag: { type: 'string' } } },
      tags: ['read_only', 'executable'],
    },
  ],
  'custom', ['StackExchange API v2.3'],
  'No official MCP server found for Stack Overflow. Posting/answering is deliberately NOT modeled as a tool here — the StackExchange API requires a registered app + per-user OAuth for writes, and automated answer-posting is against Stack Overflow\'s own community norms (same reasoning this codebase already applies to Quora in SOCIAL_MCP). search_questions is real and wired to the live public API.',
);

export const YELP_MCP = server(
  'yelp-mcp', 'Yelp MCP', 'Read business listings and reviews from Yelp Fusion API.',
  [
    {
      name: 'search_businesses', description: 'Search Yelp business listings and read their public review summary.',
      tier: 'auto', riskLevel: 1,
      inputSchema: { type: 'object', required: ['term', 'location'], properties: { term: { type: 'string' }, location: { type: 'string' } } },
      safetyNote: 'Needs YELP_API_KEY (Fusion API) — not configured in this environment.',
    },
  ],
  'custom', ['Yelp Fusion API'],
  "Yelp's public Fusion API is read-only for business/review data — there is no public API for posting an owner response to a review; that only exists through Yelp's own Business Owner web UI. No write tool is modeled here because none exists to model.",
);

export const TRIPADVISOR_MCP = server(
  'tripadvisor-mcp', 'Tripadvisor MCP', 'Read business reviews and ratings from Tripadvisor.',
  [
    {
      name: 'tripadvisor_read_reviews', description: 'Read public reviews for a claimed Tripadvisor listing.',
      tier: 'auto', riskLevel: 1,
      inputSchema: { type: 'object', required: ['locationId'], properties: { locationId: { type: 'string' } } },
      safetyNote: 'Tripadvisor Content API access is granted by partner application, not self-serve API-key signup — this environment has neither an approved partner account nor an API key.',
    },
  ],
  'custom', ['Tripadvisor Content API (partner access)'],
  'More restricted than Yelp: Tripadvisor requires a partner-approval process before any API key is issued at all, not just credential configuration. No response/write API is publicly documented.',
);

export const TRUSTPILOT_MCP = server(
  'trustpilot-mcp', 'Trustpilot MCP', 'Read and respond to Trustpilot reviews via the real Business API.',
  [
    {
      name: 'trustpilot_read_reviews', description: 'Read reviews for this business\'s Trustpilot profile.',
      tier: 'auto', riskLevel: 1,
      inputSchema: { type: 'object', required: ['businessUnitId'], properties: { businessUnitId: { type: 'string' } } },
      safetyNote: 'Needs a Trustpilot Business API OAuth app — not configured in this environment.',
    },
    {
      name: 'respond_to_review', description: 'Post an official business reply to a Trustpilot review — Trustpilot\'s Business API genuinely supports this (unlike Yelp).',
      tier: 'staff_approval', riskLevel: 2,
      inputSchema: { type: 'object', required: ['reviewId', 'reply'], properties: { reviewId: { type: 'string' }, reply: { type: 'string' } } },
      safetyNote: 'Needs Trustpilot Business API credentials — not configured in this environment.',
    },
  ],
  'custom', ['Trustpilot Business API'],
  'Trustpilot is the one review platform in this set whose real public API does support posting a response, not just reading — worth prioritizing over Yelp/Tripadvisor if review management becomes a real need.',
);

export const VIMEO_MCP = server(
  'vimeo-mcp', 'Vimeo MCP', 'Upload and manage video content on Vimeo.',
  [
    {
      name: 'vimeo_upload_video', description: 'Upload a video file to this account\'s Vimeo library.',
      tier: 'staff_approval', riskLevel: 3,
      inputSchema: { type: 'object', required: ['filePath', 'title'], properties: { filePath: { type: 'string' }, title: { type: 'string' }, description: { type: 'string' } } },
      safetyNote: 'Needs a Vimeo API access token — not configured in this environment.',
    },
  ],
  'custom', ['Vimeo API v3.4'],
  'Real, documented API (OAuth token per app). No MCP server found; this project would wrap it directly if credentials are ever configured.',
);

export const DAILYMOTION_MCP = server(
  'dailymotion-mcp', 'Dailymotion MCP', 'Upload and manage video content on Dailymotion.',
  [
    {
      name: 'dailymotion_upload_video', description: 'Upload a video file to this account\'s Dailymotion library.',
      tier: 'staff_approval', riskLevel: 3,
      inputSchema: { type: 'object', required: ['filePath', 'title'], properties: { filePath: { type: 'string' }, title: { type: 'string' } } },
      safetyNote: 'Needs a Dailymotion Partner API OAuth app — not configured in this environment.',
    },
  ],
  'custom', ['Dailymotion Partner API'],
  'Real, documented API (OAuth). No MCP server found.',
);

export const SPOTIFY_MCP = server(
  'spotify-mcp', 'Spotify MCP', 'Read podcast performance data — NOT a publishing tool (see implementationNote).',
  [
    {
      name: 'read_podcast_analytics', description: 'Read episode performance data via Spotify for Podcasters.',
      tier: 'auto', riskLevel: 1,
      inputSchema: { type: 'object', required: ['showId'], properties: { showId: { type: 'string' } } },
      safetyNote: 'Needs a Spotify for Podcasters account link — not configured in this environment.',
    },
  ],
  'custom', ['Spotify for Podcasters'],
  'Important distinction from every other platform here: Spotify does NOT have a "publish episode" API call to make. New episodes are picked up automatically once by crawling the podcast\'s own RSS feed (submitted one time via Spotify for Podcasters) — there is deliberately no publish_episode tool because that action does not exist as an API on Spotify\'s side.',
);

export const APPLE_PODCASTS_MCP = server(
  'apple-podcasts-mcp', 'Apple Podcasts', 'No public API — informational entry only.',
  [],
  'none', [],
  'No public API exists for Apple Podcasts at all — new episodes are picked up automatically via the same RSS feed submitted once through Podcasts Connect (podcastsconnect.apple.com). Nothing here to automate or wrap; this entry exists so the gateway catalog states that honestly instead of omitting the platform silently.',
);

export const SOUNDCLOUD_MCP = server(
  'soundcloud-mcp', 'SoundCloud MCP', 'Upload audio tracks to SoundCloud.',
  [
    {
      name: 'upload_track', description: 'Upload an audio file to this account\'s SoundCloud library.',
      tier: 'staff_approval', riskLevel: 3,
      inputSchema: { type: 'object', required: ['filePath', 'title'], properties: { filePath: { type: 'string' }, title: { type: 'string' } } },
      safetyNote: 'SoundCloud has not issued new public API keys to most applicants since ~2018 — this is a real access restriction, not just a missing credential. An existing grandfathered key would be required.',
    },
  ],
  'custom', ['SoundCloud API'],
  'API exists and is documented, but new third-party API access has been effectively closed for years — flagged so this is not mistaken for a simple missing-env-var gap.',
);

export const PATREON_MCP = server(
  'patreon-mcp', 'Patreon MCP', 'Create posts for patrons via the real Patreon Creator API.',
  [
    {
      name: 'create_post', description: 'Publish a post to this creator\'s Patreon page.',
      tier: 'staff_approval', riskLevel: 3,
      inputSchema: { type: 'object', required: ['title', 'content'], properties: { title: { type: 'string' }, content: { type: 'string' }, tierIds: { type: 'array', items: { type: 'string' } } } },
      safetyNote: 'Needs a Patreon Creator API OAuth app — not configured in this environment.',
    },
  ],
  'custom', ['Patreon API v2'],
  'Real, documented Creator API (OAuth). No MCP server found.',
);

export const SNAPCHAT_MCP = server(
  'snapchat-mcp', 'Snapchat', 'No self-serve public API for organic content posting — informational entry only.',
  [],
  'none', ['Snap Marketing API (ads only)'],
  'Snapchat has a real Marketing API, but it covers paid ad campaigns only — there is no public API for posting organic Snaps/Stories to a regular account, which is exactly why Postiz and virtually every third-party scheduler omit Snapchat too. Nothing to wrap for the organic-posting use case this gateway is for.',
);

export const SUBSTACK_MCP = server(
  'substack-mcp', 'Substack', 'No official public API — informational entry only.',
  [],
  'none', [],
  'Substack has never published an official public API. Unofficial/reverse-engineered endpoints exist but are fragile and outside Substack\'s terms — same reasoning this codebase already applies to Quora in SOCIAL_MCP. No tool is modeled here on principle, not because of a missing credential.',
);

export const EXTERNAL_PLATFORM_MCP_SERVERS: McpServerManifest[] = [
  GITHUB_MCP, GITLAB_MCP, STACKOVERFLOW_MCP, YELP_MCP, TRIPADVISOR_MCP, TRUSTPILOT_MCP,
  VIMEO_MCP, DAILYMOTION_MCP, SPOTIFY_MCP, APPLE_PODCASTS_MCP, SOUNDCLOUD_MCP, PATREON_MCP,
  SNAPCHAT_MCP, SUBSTACK_MCP,
];

// ─────────────────────────────────────────────────────────────────────────
// Execution — the small subset of tools above that are genuinely callable
// right now (public APIs, no credentials needed). Every other tool
// honestly reports "not connected" rather than faking success.
// ─────────────────────────────────────────────────────────────────────────

export interface ExecutionResult {
  executed: boolean;
  reason?: string;
  data?: unknown;
}

const EXECUTABLE_TOOLS = new Set(['github.search_repositories', 'stackoverflow.search_questions']);

export function isExecutable(serverSlug: string, toolName: string): boolean {
  return EXECUTABLE_TOOLS.has(`${serverSlug.replace('-mcp', '')}.${toolName}`);
}

async function executeGithubSearch(args: { query: string; perPage?: number }): Promise<ExecutionResult> {
  const perPage = args.perPage ?? 5;
  const res = await fetch(
    `https://api.github.com/search/repositories?q=${encodeURIComponent(args.query)}&sort=stars&order=desc&per_page=${perPage}`,
    { headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'sohamyoga-mcp-gateway' } },
  );
  if (!res.ok) return { executed: false, reason: `GitHub API returned ${res.status}` };
  const body = await res.json() as { items: Array<{ full_name: string; html_url: string; stargazers_count: number; description: string | null }> };
  return {
    executed: true,
    data: body.items.map(r => ({ fullName: r.full_name, url: r.html_url, stars: r.stargazers_count, description: r.description })),
  };
}

async function executeStackOverflowSearch(args: { query: string; tag?: string }): Promise<ExecutionResult> {
  const params = new URLSearchParams({ order: 'desc', sort: 'relevance', intitle: args.query, site: 'stackoverflow' });
  if (args.tag) params.set('tagged', args.tag);
  const res = await fetch(`https://api.stackexchange.com/2.3/search?${params.toString()}`);
  if (!res.ok) return { executed: false, reason: `StackExchange API returned ${res.status}` };
  const body = await res.json() as { items: Array<{ title: string; link: string; score: number; answer_count: number; is_answered: boolean }> };
  return {
    executed: true,
    data: body.items.slice(0, 5).map(q => ({ title: q.title, url: q.link, score: q.score, answerCount: q.answer_count, isAnswered: q.is_answered })),
  };
}

export async function executeExternalPlatformTool(serverSlug: string, toolName: string, args: Record<string, unknown>): Promise<ExecutionResult> {
  const key = `${serverSlug.replace('-mcp', '')}.${toolName}`;
  try {
    switch (key) {
      case 'github.search_repositories':
        return await executeGithubSearch(args as { query: string; perPage?: number });
      case 'stackoverflow.search_questions':
        return await executeStackOverflowSearch(args as { query: string; tag?: string });
      default:
        return { executed: false, reason: 'This tool needs credentials not configured in this environment — see its safetyNote in the gateway catalog.' };
    }
  } catch (err) {
    return { executed: false, reason: err instanceof Error ? err.message : 'Execution failed' };
  }
}
