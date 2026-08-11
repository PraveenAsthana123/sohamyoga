#!/usr/bin/env tsx
/**
 * Cron Runner — starts all 27 autonomous background jobs.
 *
 * Uses: node-cron (npm i node-cron @types/node-cron)
 * Run:  npx tsx src/cron/runner.ts
 * Or:   docker-compose -f downloads/docker/cron/docker-compose.cron.yml up
 *
 * ALL AI jobs route to local Ollama — zero cloud tokens consumed at runtime.
 *
 * CRON_SCHEDULE_SUMMARY is logged at startup.
 */

import cron from 'node-cron';
import { CRON_JOBS, CRON_SCHEDULE_SUMMARY } from './CronRegistry';
import { ollama } from './OllamaClient';
import { JOB_MODULES } from './jobModules';

async function runJob(name: string, moduleName: string): Promise<void> {
  const start = Date.now();
  try {
    const mod = await JOB_MODULES[moduleName]?.();
    if (!mod) { console.error(`[cron] unknown job module: ${moduleName}`); return; }
    await mod.run();
    console.log(`[cron] ✓ ${name} (${Date.now() - start}ms)`);
  } catch (err) {
    console.error(`[cron] ✗ ${name} failed:`, err);
  }
}

async function main() {
  console.log(CRON_SCHEDULE_SUMMARY);

  // Verify Ollama is reachable before starting AI jobs
  const ollamaUp = await ollama.isHealthy();
  if (!ollamaUp) {
    console.warn('[cron] WARNING: Ollama not reachable at', process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434');
    console.warn('[cron] AI jobs will fail gracefully until Ollama is running');
  } else {
    console.log('[cron] Ollama: healthy ✓');
  }

  let registered = 0;

  for (const job of CRON_JOBS) {
    if (!job.enabled) {
      console.log(`[cron] SKIP ${job.name} (disabled)`);
      continue;
    }

    if (!cron.validate(job.schedule)) {
      console.error(`[cron] invalid schedule for ${job.name}: ${job.schedule}`);
      continue;
    }

    cron.schedule(job.schedule, async () => {
      await runJob(job.name, job.module);
    }, { timezone: 'UTC' });

    console.log(`[cron] registered  ${job.schedule.padEnd(15)} → ${job.name}`);
    registered++;
  }

  console.log(`\n[cron] ${registered} jobs active. Running. Press Ctrl+C to stop.\n`);
}

main().catch(err => {
  console.error('[cron] startup failed:', err);
  process.exit(1);
});
