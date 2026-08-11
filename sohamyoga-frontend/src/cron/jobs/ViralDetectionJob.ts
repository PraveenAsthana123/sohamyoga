// ViralDetectionJob — Daily 07:00 UTC, Facebook-first (Phase C of the
// growth-loop architecture). Computes real share/like/comment velocity per
// post from social_post_analytics snapshots (>=2 required), compares each
// post's share velocity against its own account's trailing baseline
// (mean/stddev over other posts from the last 30 days, requires >=3
// comparison posts before a baseline is trusted), and flags a post viral
// only when it is a real statistical outlier (z-score >= 2) against real
// data — never a fixed "1000 likes = viral" magic number, which would be
// meaningless across accounts of very different sizes.
//
// Advisory only: Ollama writes one sentence for the single most viral post
// each run, reasoning strictly from the given numeric deltas. This job
// never boosts, auto-replies to, or otherwise acts on a post — per the
// spec's own guardrail against letting an autonomous agent interact
// unsupervised with a real audience.
//
// Started Facebook-first (Phase C); Phase E generalized this to every
// platform social_account actually supports (migration 020's
// ref_social_platform), with zero new business logic — the same velocity/
// baseline/z-score computation just loops over more platform values.

import { Pool } from 'pg';
import { ollama } from '../OllamaClient';

const db = new Pool({ connectionString: process.env.DATABASE_URL });

const BASELINE_MIN_SAMPLE = 3;
const VIRAL_Z_SCORE_THRESHOLD = 2;

function extractText(raw: string): string {
  return raw.trim().replace(/^```(?:text)?\s*/i, '').replace(/```\s*$/i, '').trim();
}

interface Snapshot { fetched_at: string; likes: number; comments: number; shares: number }

function velocityPerHour(prev: Snapshot, latest: Snapshot, field: 'likes' | 'comments' | 'shares'): { velocity: number; hours: number } {
  const hours = (new Date(latest.fetched_at).getTime() - new Date(prev.fetched_at).getTime()) / 3_600_000;
  if (hours <= 0) return { velocity: 0, hours: 0 };
  return { velocity: (latest[field] - prev[field]) / hours, hours };
}

export async function run(): Promise<void> {
  const tenant = await db.query<{ id: string }>(`SELECT id FROM tenant LIMIT 1`);
  if (!tenant.rowCount) { console.log('[viral-detection] no tenant configured, skipping'); return; }
  const tenantId = tenant.rows[0].id;

  let mostViral: { postId: string; shareVelocity: number; likeVelocity: number; commentVelocity: number; zScore: number } | null = null;
  let postsAnalyzed = 0;

  // Discover platforms from real connected accounts rather than a
  // hardcoded list — the job naturally covers every platform as soon as an
  // account is actually connected via Postiz OAuth, with zero code changes.
  const connectedPlatforms = await db.query<{ platform: string }>(
    `SELECT DISTINCT platform FROM social_account WHERE status = 'connected'`,
  );

  for (const { platform } of connectedPlatforms.rows) {
    const posts = await db.query<{ id: string; account_id: string }>(
      `SELECT id, account_id FROM social_post WHERE platform = $1 AND status = 'published'`,
      [platform],
    );

    // Per-account share-velocity history, used to baseline every post on
    // that same account against its own real performance. Keyed by postId
    // (not by the velocity value itself) so that excluding "this post" from
    // its own baseline doesn't also exclude other posts that happen to
    // share the same velocity number.
    const accountVelocities = new Map<string, Array<{ postId: string; velocity: number }>>();
    const postVelocity = new Map<string, { share: number; like: number; comment: number; hours: number; accountId: string }>();

    for (const post of posts.rows) {
      const snaps = await db.query<Snapshot>(
        `SELECT fetched_at, likes, comments, shares FROM social_post_analytics
         WHERE post_id = $1 ORDER BY fetched_at ASC`,
        [post.id],
      );
      const snapCount = snaps.rowCount ?? 0;
      if (snapCount < 2) continue;
      const prev = snaps.rows[snapCount - 2];
      const latest = snaps.rows[snapCount - 1];
      const share = velocityPerHour(prev, latest, 'shares');
      const like = velocityPerHour(prev, latest, 'likes');
      const comment = velocityPerHour(prev, latest, 'comments');
      if (share.hours <= 0) continue;

      postVelocity.set(post.id, { share: share.velocity, like: like.velocity, comment: comment.velocity, hours: share.hours, accountId: post.account_id });
      const arr = accountVelocities.get(post.account_id) ?? [];
      arr.push({ postId: post.id, velocity: share.velocity });
      accountVelocities.set(post.account_id, arr);
    }

    for (const [postId, v] of Array.from(postVelocity.entries())) {
      postsAnalyzed++;
      const otherVelocities = (accountVelocities.get(v.accountId) ?? [])
        .filter(x => x.postId !== postId)
        .map(x => x.velocity);
      const sampleSize = otherVelocities.length;
      let mean: number | null = null; let stddev: number | null = null; let zScore: number | null = null;

      if (sampleSize >= BASELINE_MIN_SAMPLE) {
        mean = otherVelocities.reduce((a, b) => a + b, 0) / sampleSize;
        const variance = otherVelocities.reduce((a, b) => a + (b - mean!) ** 2, 0) / sampleSize;
        stddev = Math.sqrt(variance);
        zScore = stddev > 0 ? (v.share - mean) / stddev : 0;
      }

      const isViral = zScore !== null && zScore >= VIRAL_Z_SCORE_THRESHOLD;
      const viralScore = Math.min(100, Math.max(0, Math.round(50 + (zScore ?? 0) * 15)));

      await db.query(
        `INSERT INTO viral_signal (tenant_id, post_id, platform, window_hours, share_velocity, like_velocity, comment_velocity, baseline_mean, baseline_stddev, baseline_sample_size, z_score, viral_score, is_viral, computed_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,now())
         ON CONFLICT (post_id) DO UPDATE SET
           window_hours=$4, share_velocity=$5, like_velocity=$6, comment_velocity=$7, baseline_mean=$8,
           baseline_stddev=$9, baseline_sample_size=$10, z_score=$11, viral_score=$12, is_viral=$13, computed_at=now()`,
        [tenantId, postId, platform, v.hours, v.share, v.like, v.comment, mean, stddev, sampleSize, zScore, viralScore, isViral],
      );

      if (isViral && (!mostViral || zScore! > mostViral.zScore)) {
        mostViral = { postId, shareVelocity: v.share, likeVelocity: v.like, commentVelocity: v.comment, zScore: zScore! };
      }
    }
  }

  console.log(`[viral-detection] analyzed ${postsAnalyzed} posts with >=2 analytics snapshots`);

  if (mostViral) {
    try {
      const prompt = `A social post's share velocity is ${mostViral.shareVelocity.toFixed(2)}/hour, ${mostViral.zScore.toFixed(1)} standard deviations above this account's own recent baseline. Like velocity: ${mostViral.likeVelocity.toFixed(2)}/hour. Comment velocity: ${mostViral.commentVelocity.toFixed(2)}/hour.`;
      const raw = await ollama.generate(prompt, {
        tier: 'fast',
        system: 'You are a social media analyst for a yoga studio. Given one real, already-computed share-velocity outlier and its supporting like/comment velocity, write 1 sentence noting it is trending and one concrete next step (e.g. boost budget consideration, cross-post). Only reason from the numbers given — do not invent a reason (e.g. do not claim a specific topic or influencer caused it) not implied by the data.',
        maxTokens: 150, timeoutMs: 45_000,
      });
      const note = extractText(raw);
      await db.query(`UPDATE viral_signal SET ai_note = $1 WHERE post_id = $2`, [note, mostViral.postId]);
    } catch (err) {
      console.error('[viral-detection] note failed:', err);
    }
  }
  // Do NOT db.end() here — runner.ts caches this module across every
  // scheduled invocation in the long-lived cron container.
}
