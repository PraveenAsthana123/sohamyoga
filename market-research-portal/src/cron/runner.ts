#!/usr/bin/env tsx
/**
 * Cron Runner — schedules the 2 real cross-portal jobs (Pricing, Reviews)
 * on their real weekly cadence from job_registry. ResearchAiDraftJob is
 * NOT scheduled here — it's on-demand, triggered per (study, phase) by
 * the "Run Pipeline" flow (see src/domain/pipeline/runJob.ts), exactly as
 * job_registry.schedule documents for that row ("on-demand").
 *
 * Run: npx tsx src/cron/runner.ts
 */

import cron from 'node-cron';
import { getPool } from '../lib/postgres';
import { ollama } from './OllamaClient';
import { runJob } from '../domain/pipeline/runJob';

const SCHEDULED_MODULES = ['PricingCrossPortalJob', 'ReviewsCrossPortalJob', 'OperationsAlertSweepJob', 'SelfHealJob', 'VoiceCallDispatchJob'];

async function main() {
  console.log('[cron] market-research-portal cron runner starting');

  const ollamaUp = await ollama.isHealthy();
  console.log(ollamaUp ? '[cron] Ollama: healthy' : '[cron] WARNING: Ollama not reachable — ResearchAiDraftJob will fail gracefully until it is');

  const registry = await getPool().query(
    `SELECT name, schedule, module, enabled FROM job_registry WHERE module = ANY($1)`,
    [SCHEDULED_MODULES],
  );

  let registered = 0;
  for (const job of registry.rows) {
    if (!job.enabled) {
      console.log(`[cron] SKIP ${job.name} (disabled)`);
      continue;
    }
    if (!cron.validate(job.schedule)) {
      console.error(`[cron] invalid schedule for ${job.name}: ${job.schedule}`);
      continue;
    }
    cron.schedule(job.schedule, async () => {
      const start = Date.now();
      const result = await runJob(job.module, {});
      console.log(`[cron] ${result.status === 'succeeded' ? '✓' : '✗'} ${job.name} (${Date.now() - start}ms)`);
    }, { timezone: 'UTC' });
    console.log(`[cron] registered ${job.schedule.padEnd(20)} → ${job.name}`);
    registered++;
  }

  console.log(`\n[cron] ${registered} job(s) active. Running. Press Ctrl+C to stop.\n`);
}

main().catch(err => {
  console.error('[cron] startup failed:', err);
  process.exit(1);
});
