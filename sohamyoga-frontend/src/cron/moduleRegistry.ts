// Shared module registry for advisory/review cron jobs (FeatureGapAdvisorJob,
// ModuleBoundaryQualityJob, and any future §166 "advise"/"test" style job).
// One place to add a module so every reviewer job picks it up.

import { readFileSync } from 'fs';
import path from 'path';
import type { Pool } from 'pg';

export const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
export const MAX_CHARS_PER_FILE = 4000;

export interface ModuleDef { key: string; label: string; files: string[] }

export const MODULES: ModuleDef[] = [
  { key: 'marketing-automation', label: 'Marketing Automation Command Centre', files: [
    'src/app/admin/marketing-command/page.tsx',
    'src/app/api/marketing/automation/route.ts',
    'src/cron/jobs/MarketingAutomationJob.ts',
  ] },
  { key: 'social-portal', label: 'Social Media Portal', files: [
    'src/app/admin/social/page.tsx',
  ] },
  { key: 'booking', label: 'Booking', files: ['src/app/admin/booking/page.tsx'] },
  { key: 'wellness', label: 'Wellness', files: ['src/app/admin/wellness/page.tsx'] },
  { key: 'crm', label: 'CRM', files: ['src/app/admin/crm/page.tsx'] },
  { key: 'ecommerce', label: 'E-commerce', files: ['src/app/admin/ecommerce/page.tsx'] },
  { key: 'referral', label: 'Referral', files: ['src/app/admin/referral/page.tsx'] },
  { key: 'analytics', label: 'Analytics', files: ['src/app/admin/analytics/page.tsx'] },
];

export function readModuleSource(mod: ModuleDef): string {
  return mod.files.map(rel => {
    try {
      const content = readFileSync(path.join(REPO_ROOT, rel), 'utf8');
      return `--- ${rel} ---\n${content.slice(0, MAX_CHARS_PER_FILE)}`;
    } catch {
      return `--- ${rel} --- (unreadable, skipped)`;
    }
  }).join('\n\n');
}

export function extractJson<T>(text: string): T {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1] || text;
  const start = fenced.indexOf('{');
  const end = fenced.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('Ollama returned no JSON object');
  return JSON.parse(fenced.slice(start, end + 1)) as T;
}

/** Picks whichever module has gone longest without a row in `table` (by module_key/created_at). */
export async function pickLeastReviewedModule(db: Pool, table: string): Promise<ModuleDef> {
  const reviewed = await db.query<{ module_key: string; last: string }>(
    `SELECT module_key, MAX(created_at) AS last FROM ${table} GROUP BY module_key`,
  );
  const lastByKey = new Map(reviewed.rows.map(r => [r.module_key, new Date(r.last).getTime()]));
  const [first, ...rest] = MODULES;
  return rest.reduce((oldest, mod) => {
    const oldestTime = lastByKey.get(oldest.key) ?? -Infinity;
    const modTime = lastByKey.get(mod.key) ?? -Infinity;
    return modTime < oldestTime ? mod : oldest;
  }, first);
}
