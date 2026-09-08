// FirstWaveDispatchJob — Every 5 minutes
// Publishes approved telegram/discord/mastodon/bluesky variants using the
// real, tested first-wave-adapters.ts client code, which existed but was
// never called anywhere in production (only in its own test file) --
// found live during the 2026-09-01 business-side admin-panel audit. This
// job is the missing wiring, mirroring PostizSocialAutoPublishJob's exact
// claim/publish/update pattern for the platforms Postiz doesn't cover.
//
// Honestly gated: adapterReadiness() checks the connected social_account's
// own credentials JSONB column (bot_token/webhook_url/etc.) -- with no
// account connected (0 rows exist in social_account today for any
// platform), this job finds nothing to do and logs that honestly, exactly
// like VoiceCallDispatchJob does when no PSTN client is configured.
import { Pool, type PoolClient } from 'pg';
import { publishFirstWave, adapterReadiness, type FirstWavePlatform } from '../../domain/social/first-wave-adapters';

const db = new Pool({ connectionString: process.env.DATABASE_URL });

export const FIRST_WAVE_PLATFORMS = ['telegram', 'discord', 'mastodon', 'bluesky'] as const;

interface Candidate {
  draft_id: string; tenant_id: string; workspace_id: string; adapted_text: string;
  account_id: string; platform_account_id: string; credentials: Record<string, string>;
  scheduled_at: string; platform: FirstWavePlatform;
}

async function claim(client: PoolClient): Promise<Candidate | null> {
  const selected = await client.query<Candidate>(`
    SELECT d.id draft_id, d.tenant_id, d.workspace_id, COALESCE(NULLIF(v.adapted_text,''), d.master_text) adapted_text,
           a.id account_id, a.platform_account_id, a.credentials, COALESCE(v.scheduled_at, d.default_schedule_at) scheduled_at, v.platform
    FROM social_content_draft d JOIN social_platform_variant v ON v.draft_id = d.id AND v.platform = ANY($1) AND v.status = 'pending'
    JOIN social_account a ON a.id = v.account_id AND a.platform = v.platform AND a.status = 'connected'
    WHERE d.status = 'approved' AND d.reviewed_by IS NOT NULL AND d.reviewed_at IS NOT NULL
      AND COALESCE(v.scheduled_at, d.default_schedule_at) <= now()
    ORDER BY COALESCE(v.scheduled_at, d.default_schedule_at), d.created_at
    FOR UPDATE OF d, v SKIP LOCKED LIMIT 1
  `, [FIRST_WAVE_PLATFORMS]);
  if (!selected.rowCount) return null;
  await client.query(`UPDATE social_content_draft SET status = 'publishing', updated_at = now() WHERE id = $1`, [selected.rows[0].draft_id]);
  return selected.rows[0];
}

export async function run(): Promise<void> {
  let published = 0, blocked = 0;
  for (let n = 0; n < 10; n++) {
    const client = await db.connect();
    let c: Candidate | null = null;
    try {
      await client.query('BEGIN');
      c = await claim(client);
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
    if (!c) break;

    const readiness = adapterReadiness(c.platform, c.credentials);
    const key = `${c.platform}:${c.draft_id}:${c.account_id}`;

    if (!readiness.ready) {
      // Honest gate, exactly like VoiceCallDispatchJob's "no PSTN client"
      // path -- never a fabricated success.
      await db.query(`UPDATE social_content_draft SET status = 'approved', updated_at = now() WHERE id = $1`, [c.draft_id]);
      await db.query(
        `UPDATE social_platform_variant SET error_message = $3 WHERE draft_id = $1 AND platform = $2`,
        [c.draft_id, c.platform, `Missing ${c.platform} runtime configuration: ${readiness.missing.join(', ')}`],
      );
      blocked++;
      continue;
    }

    try {
      const result = await publishFirstWave(c.platform, { text: c.adapted_text, externalAccountId: c.platform_account_id, idempotencyKey: key }, c.credentials);
      const success = await db.connect();
      try {
        await success.query('BEGIN');
        await success.query(
          `INSERT INTO social_post (tenant_id, workspace_id, draft_id, platform, account_id, idempotency_key, scheduled_at, published_at, status, external_post_id, external_post_url)
           VALUES ($1,$2,$3,$4,$5,$6,$7,now(),'published',$8,$9) ON CONFLICT (idempotency_key) DO NOTHING`,
          [c.tenant_id, c.workspace_id, c.draft_id, c.platform, c.account_id, key, c.scheduled_at, result.externalId ?? null, result.externalUrl ?? null],
        );
        await success.query(
          `UPDATE social_platform_variant SET status = 'published', platform_post_id = COALESCE($3, platform_post_id), published_at = now(), error_message = NULL WHERE draft_id = $1 AND platform = $2`,
          [c.draft_id, c.platform, result.externalId ?? null],
        );
        await success.query(
          `UPDATE social_content_draft d SET status = CASE WHEN EXISTS (SELECT 1 FROM social_platform_variant v WHERE v.draft_id = d.id AND v.status IN ('pending','scheduled')) THEN 'approved' ELSE 'published' END, updated_at = now() WHERE d.id = $1`,
          [c.draft_id],
        );
        await success.query('COMMIT');
        published++;
      } catch (e) {
        await success.query('ROLLBACK');
        throw e;
      } finally {
        success.release();
      }
    } catch (e) {
      await db.query(`UPDATE social_content_draft SET status = 'approved', updated_at = now() WHERE id = $1`, [c.draft_id]);
      await db.query(
        `UPDATE social_platform_variant SET error_message = $3, retry_count = LEAST(retry_count + 1, 3) WHERE draft_id = $1 AND platform = $2`,
        [c.draft_id, c.platform, e instanceof Error ? e.message.slice(0, 500) : 'Unknown first-wave publish error'],
      );
      console.error(`[first-wave-dispatch] platform=${c.platform} draft=${c.draft_id} failed`, e);
      break;
    }
  }
  if (published + blocked > 0) console.log(`[first-wave-dispatch] published=${published} blocked=${blocked}`);
  // Do NOT db.end() here -- runner.ts caches this module across every
  // scheduled invocation in the long-lived cron container.
}
