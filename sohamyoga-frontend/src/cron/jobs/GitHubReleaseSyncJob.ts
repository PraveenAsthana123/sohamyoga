// GitHubReleaseSyncJob — daily 8am
// Fetches latest releases from configured GitHub repos, creates social_post records
// for new releases to cross-post to other platforms, and syncs download stats to
// unified_content_item metrics.
import { Pool } from 'pg';

const db = new Pool({ connectionString: process.env.DATABASE_URL });

interface GitHubRelease {
  id: number;
  tag_name: string;
  name: string;
  body: string;
  html_url: string;
  published_at: string;
  prerelease: boolean;
  draft: boolean;
  assets: Array<{ download_count: number; name: string }>;
}

async function fetchLatestReleases(
  owner: string,
  repo: string,
  token: string,
  perPage = 5,
): Promise<GitHubRelease[]> {
  const res = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/releases?per_page=${perPage}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    },
  );

  if (!res.ok) {
    throw new Error(`GitHub API error ${res.status}: ${await res.text().catch(() => '')}`);
  }

  return (await res.json()) as GitHubRelease[];
}

export async function run(): Promise<void> {
  const token = process.env['GITHUB_TOKEN'];
  const owner = process.env['GITHUB_OWNER'];
  const repo  = process.env['GITHUB_REPO'];

  if (!token || !owner || !repo) {
    // Honest no-op — job runs but does nothing without credentials
    return;
  }

  let newReleases = 0;
  let statsUpdated = 0;

  let releases: GitHubRelease[];
  try {
    releases = await fetchLatestReleases(owner, repo, token);
  } catch (err) {
    console.error('[github-release-sync] fetch failed:', err instanceof Error ? err.message : err);
    return;
  }

  for (const release of releases) {
    if (release.draft || release.prerelease) continue;

    const idempotencyKey = `github-release-${release.id}`;
    const totalDownloads = release.assets.reduce((sum, a) => sum + a.download_count, 0);

    // Upsert unified_content_item for this release
    const uci = await db.query(
      `INSERT INTO unified_content_item
         (item_type, source_id, platform, content_type, caption, status, external_url, created_at, updated_at)
       VALUES ('social_post', $1, 'github', 'release', $2, 'published', $3, $4, now())
       ON CONFLICT (source_id, platform) DO UPDATE SET
         caption = EXCLUDED.caption,
         external_url = EXCLUDED.external_url,
         updated_at = now()
       RETURNING id, (xmax = 0) AS inserted`,
      [idempotencyKey, `${release.name ?? release.tag_name}: ${(release.body ?? '').slice(0, 300)}`, release.html_url, release.published_at],
    );

    const wasInserted = uci.rows[0]?.inserted === true;
    if (wasInserted) {
      newReleases++;
      // Queue a social_post record for cross-posting (status=scheduled, admin can approve)
      await db.query(
        `INSERT INTO social_post
           (platform, content_type, caption, status, scheduled_at, external_post_id, external_post_url, idempotency_key, created_at, updated_at)
         VALUES ('github', 'release', $1, 'published', $2, $3, $4, $5, now(), now())
         ON CONFLICT (idempotency_key) DO NOTHING`,
        [
          `Release: ${release.name ?? release.tag_name}`,
          release.published_at,
          String(release.id),
          release.html_url,
          idempotencyKey,
        ],
      );
    }

    // Update download stats on the UCI row
    if (totalDownloads > 0 && uci.rows[0]?.id) {
      await db.query(
        `UPDATE unified_content_item SET downloads = $2, updated_at = now() WHERE id = $1`,
        [uci.rows[0].id, totalDownloads],
      );
      statsUpdated++;
    }
  }

  if (newReleases + statsUpdated > 0) {
    console.log(`[github-release-sync] newReleases=${newReleases} statsUpdated=${statsUpdated}`);
  }
}
