// FeatureGapAdvisorJob — Weekly Friday 08:00 UTC
// §166 "advise" step of the Ollama global policy: reads a module's own source,
// and asks Ollama (strong tier) what single highest-leverage feature is missing
// to reach top-1% for that topic. Stored as a draft advisory — never auto-applied.

import { Pool } from 'pg';
import { ollama } from '../OllamaClient';
import { extractJson, pickLeastReviewedModule, readModuleSource } from '../moduleRegistry';

const db = new Pool({ connectionString: process.env.DATABASE_URL });

const SYSTEM = `You are a product architect reviewing one feature module's actual source code.
Identify the SINGLE highest-leverage advanced capability missing that would move this module
closer to top-1% quality for its topic (consider: automation depth, monitoring/observability,
error handling, test coverage, human-approval gates, and completeness vs. what the code already
implements — do not suggest something that already exists in the code shown).
Return exactly one JSON object with keys:
  gap_title (<=12 words), gap_why (2-3 sentences, cite what IS and ISN'T in the code),
  effort_tier ("S", "M", or "L").
No markdown, no prose outside the JSON object.`;

interface Gap { gap_title: string; gap_why: string; effort_tier: string }

export async function run(): Promise<void> {
  const mod = await pickLeastReviewedModule(db, 'feature_gap_report');
  const source = readModuleSource(mod);

  const report = await ollama.generate(
    `Module: ${mod.label}\n\n${source}`,
    { tier: 'strong', system: SYSTEM, maxTokens: 400, timeoutMs: 120_000 },
  );

  let gap: Gap;
  try {
    gap = extractJson<Gap>(report);
  } catch (error) {
    console.error(`[feature-gap-advisor] module=${mod.key} parse failed:`, error);
    await db.end();
    return;
  }
  const effortTier = ['S', 'M', 'L'].includes(gap.effort_tier) ? gap.effort_tier : 'M';

  await db.query(
    `INSERT INTO feature_gap_report
     (module_key, module_label, gap_title, gap_why, effort_tier, evidence_files, report_text, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,'draft')`,
    [mod.key, mod.label, gap.gap_title, gap.gap_why, effortTier, mod.files, report],
  );

  const admin = await db.query<{ tenant_id: string; id: string }>(
    `SELECT tenant_id, id FROM student WHERE role='admin' AND status='active' LIMIT 1`,
  );
  if (admin.rows[0]) {
    await db.query(
      `INSERT INTO notification_queue
         (tenant_id, recipient_id, channel, template_slug, payload, idempotency_key)
       VALUES ($1,$2,'in_app','feature_gap_advisory',$3,$4)
       ON CONFLICT (idempotency_key) DO NOTHING`,
      [admin.rows[0].tenant_id, admin.rows[0].id,
        JSON.stringify({ module_key: mod.key, module_label: mod.label, gap_title: gap.gap_title, effort_tier: effortTier }),
        `feature_gap_${mod.key}_` + new Date().toISOString().slice(0, 10)],
    );
  }

  console.log(`[feature-gap-advisor] module=${mod.key} gap="${gap.gap_title}" effort=${effortTier}`);
  await db.end();
}
