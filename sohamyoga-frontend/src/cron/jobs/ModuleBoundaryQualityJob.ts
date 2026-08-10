// ModuleBoundaryQualityJob — Weekly Friday 08:30 UTC
// §166-adjacent review step: reads a module's own source and asks Ollama
// (strong tier) to define its operating boundary, concrete dos/don'ts, a
// quality score with rationale, and a benchmark note against known good
// patterns for that kind of feature. Stored as a draft review — never
// auto-applied, and never gates a deploy on its own.

import { Pool } from 'pg';
import { ollama } from '../OllamaClient';
import { extractJson, pickLeastReviewedModule, readModuleSource } from '../moduleRegistry';

const db = new Pool({ connectionString: process.env.DATABASE_URL });

const SYSTEM = `You are a staff engineer running a boundary-and-quality review on one feature
module's actual source code. Do not restate what the code does — assess it.
Return exactly one JSON object with keys:
  boundary (2-3 sentences: what this module IS responsible for and what it must NOT do —
    its scope edge, e.g. "drafts content but never publishes without human approval"),
  dos (array of 3-5 short imperative strings — concrete practices this module's code
    already follows correctly and must keep doing),
  donts (array of 3-5 short imperative strings — concrete anti-patterns this module's
    code risks or already exhibits, e.g. missing error handling, unbounded queries,
    unlogged failures, silent data loss),
  quality_score (integer 0-100, harsh grading — 100 is production-hardened, 50 is
    functional-but-fragile, below 30 means real gaps),
  quality_rationale (2-3 sentences justifying the score, citing specifics from the code),
  benchmark_note (1-2 sentences comparing this module's approach to a known good pattern
    for this kind of feature — name the pattern).
No markdown, no prose outside the JSON object.`;

interface Review {
  boundary: string;
  dos: string[];
  donts: string[];
  quality_score: number;
  quality_rationale: string;
  benchmark_note: string;
}

export async function run(): Promise<void> {
  const mod = await pickLeastReviewedModule(db, 'module_boundary_report');
  const source = readModuleSource(mod);

  const report = await ollama.generate(
    `Module: ${mod.label}\n\n${source}`,
    { tier: 'strong', system: SYSTEM, maxTokens: 700, timeoutMs: 120_000 },
  );

  let review: Review;
  try {
    review = extractJson<Review>(report);
  } catch (error) {
    console.error(`[module-boundary-quality] module=${mod.key} parse failed:`, error);
    await db.end();
    return;
  }
  const score = Number.isFinite(review.quality_score)
    ? Math.max(0, Math.min(100, Math.round(review.quality_score)))
    : 50;
  const dos = Array.isArray(review.dos) ? review.dos.slice(0, 8) : [];
  const donts = Array.isArray(review.donts) ? review.donts.slice(0, 8) : [];

  await db.query(
    `INSERT INTO module_boundary_report
     (module_key, module_label, boundary_text, dos, donts, quality_score, quality_rationale,
      benchmark_note, evidence_files, report_text, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'draft')`,
    [mod.key, mod.label, review.boundary, dos, donts, score, review.quality_rationale,
      review.benchmark_note, mod.files, report],
  );

  const admin = await db.query<{ tenant_id: string; id: string }>(
    `SELECT tenant_id, id FROM student WHERE role='admin' AND status='active' LIMIT 1`,
  );
  if (admin.rows[0]) {
    await db.query(
      `INSERT INTO notification_queue
         (tenant_id, recipient_id, channel, template_slug, payload, idempotency_key)
       VALUES ($1,$2,'in_app','module_boundary_review',$3,$4)
       ON CONFLICT (idempotency_key) DO NOTHING`,
      [admin.rows[0].tenant_id, admin.rows[0].id,
        JSON.stringify({ module_key: mod.key, module_label: mod.label, quality_score: score }),
        `module_boundary_${mod.key}_` + new Date().toISOString().slice(0, 10)],
    );
  }

  console.log(`[module-boundary-quality] module=${mod.key} score=${score} dos=${dos.length} donts=${donts.length}`);
  await db.end();
}
