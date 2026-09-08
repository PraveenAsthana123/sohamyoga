// Self-healing layer on top of Operations & Failure Tracking. Deliberately
// narrow: only retries job types with a real, callable execution path.
// video_render has one (VideoRenderer.ts). youtube_publish/social_publish
// do NOT — no Postiz client exists anywhere in this app — so this worker
// honestly re-labels those as blocked on a missing integration instead of
// either (a) leaving them silently "queued" forever with nothing to drain
// the queue, or (b) faking a publish call that doesn't exist.
import { query } from '../../lib/postgres';
import { renderVideoAsset } from './VideoRenderer';

const MAX_ATTEMPTS = 3;

interface RetryResult {
  jobId: string;
  jobType: string;
  outcome: 'retried_succeeded' | 'retried_failed' | 'exhausted' | 'relabeled_blocked';
}

async function retryVideoRenderJobs(): Promise<RetryResult[]> {
  // Atomic claim: the UPDATE's WHERE clause re-checks status='failed' at the
  // moment of the write, not the moment of an earlier SELECT — a concurrent
  // overlapping run (e.g. a slow render still in flight when the next
  // */15min tick fires) that tries to claim the same row finds 0 matching
  // rows the second time, instead of both runs re-rendering into the same
  // deterministic ${assetId}.mp4 path. Found via adversarial review: the
  // previous SELECT-then-loop-UPDATE had exactly the race window this
  // codebase's own memory says has caused real cron-overlap bugs before.
  const claimed = await query<{ id: string; asset_id: string; workspace_id: string; campaign_id: string | null; attempts: number }>(
    `WITH claimable AS (
       SELECT id FROM marketing_production_job
       WHERE job_type = 'video_render' AND status = 'failed' AND attempts < $1
         AND updated_at > now() - interval '24 hours'
       FOR UPDATE SKIP LOCKED
     )
     UPDATE marketing_production_job j
     SET status = 'running', attempts = attempts + 1, started_at = now()
     FROM claimable c
     WHERE j.id = c.id
     RETURNING j.id, j.asset_id, j.workspace_id, j.campaign_id, j.attempts`,
    [MAX_ATTEMPTS],
  );

  const results: RetryResult[] = [];
  for (const job of claimed.rows) {
    const asset = await query<{ title: string; content: string }>(`SELECT title, content FROM marketing_asset WHERE id = $1`, [job.asset_id]);
    if (!asset.rowCount) continue; // asset deleted between claim and render — nothing to retry
    await query(`UPDATE marketing_asset SET status='generating', updated_at=now() WHERE id=$1`, [job.asset_id]);
    const result = await renderVideoAsset({
      assetId: job.asset_id, workspaceId: job.workspace_id, campaignId: job.campaign_id,
      title: asset.rows[0].title, script: asset.rows[0].content, jobId: job.id,
    });
    await query(
      `INSERT INTO marketing_event_log(workspace_id,campaign_id,event_name,entity_type,entity_id,actor,outcome,details) VALUES($1,$2,'self_heal.retry','job',$3,'system',$4,$5)`,
      // job.attempts already reflects the post-increment value (RETURNING
      // ran after the UPDATE's attempts=attempts+1), not the pre-claim count.
      [job.workspace_id, job.campaign_id, job.id, result.status === 'succeeded' ? 'success' : 'failure', JSON.stringify({ attempt: job.attempts, jobType: 'video_render' })],
    );
    results.push({ jobId: job.id, jobType: 'video_render', outcome: result.status === 'succeeded' ? 'retried_succeeded' : 'retried_failed' });
  }

  const exhausted = await query<{ id: string }>(
    `SELECT id FROM marketing_production_job WHERE job_type = 'video_render' AND status = 'failed' AND attempts >= $1 AND blocker IS NULL`,
    [MAX_ATTEMPTS],
  );
  for (const job of exhausted.rows) {
    await query(`UPDATE marketing_production_job SET blocker = $2 WHERE id = $1`, [job.id, `Exhausted ${MAX_ATTEMPTS} automatic retries — needs human review, not auto-retried further.`]);
    results.push({ jobId: job.id, jobType: 'video_render', outcome: 'exhausted' });
  }
  return results;
}

async function relabelStuckPublishJobs(): Promise<RetryResult[]> {
  const stuck = await query<{ id: string; job_type: string }>(
    `SELECT id, job_type FROM marketing_production_job WHERE job_type IN ('youtube_publish','social_publish') AND status = 'queued'`,
  );
  const results: RetryResult[] = [];
  for (const job of stuck.rows) {
    await query(
      `UPDATE marketing_production_job SET status='blocked', blocker='No publish integration exists in this app yet — this job cannot self-heal, it needs a real Postiz/YouTube client built first.', updated_at=now() WHERE id=$1`,
      [job.id],
    );
    results.push({ jobId: job.id, jobType: job.job_type, outcome: 'relabeled_blocked' });
  }
  return results;
}

export async function run(): Promise<{ retried: number; exhausted: number; relabeled: number }> {
  const [videoResults, publishResults] = await Promise.all([retryVideoRenderJobs(), relabelStuckPublishJobs()]);
  const all = [...videoResults, ...publishResults];
  return {
    retried: all.filter(r => r.outcome === 'retried_succeeded' || r.outcome === 'retried_failed').length,
    exhausted: all.filter(r => r.outcome === 'exhausted').length,
    relabeled: all.filter(r => r.outcome === 'relabeled_blocked').length,
  };
}
