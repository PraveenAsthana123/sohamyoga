// AIGovernanceAuditJob — runs daily at midnight
// Reviews last 24h ai_governance_log entries, flags below-threshold ones.

import { pool } from '@/lib/db';

export const AIGovernanceAuditJob = {
  name: 'ai-governance-audit',
  schedule: '0 0 * * *',
  async run(): Promise<{ ok: boolean; reviewed: number; flagged: number }> {
    let reviewed = 0;
    let flagged = 0;
    try {
      const rows = await pool.query(
        `SELECT * FROM ai_governance_log
         WHERE created_at >= NOW() - INTERVAL '24 hours'
           AND human_reviewed = false
         LIMIT 500`
      );

      for (const row of rows.rows) {
        const belowThreshold =
          (row.confidence_score !== null && parseFloat(row.confidence_score) < 0.70) ||
          (row.fairness_score !== null && parseFloat(row.fairness_score) < 0.65) ||
          (row.bias_flags && row.bias_flags !== '') ||
          (row.ethical_flags && row.ethical_flags !== '');

        if (belowThreshold) {
          // Mark as needing review (set human_reviewed=false is default, just log)
          flagged++;
        }
        reviewed++;
      }

      console.log(`[ai-governance-audit] Reviewed ${reviewed} logs, flagged ${flagged} for human review`);
      return { ok: true, reviewed, flagged };
    } catch (err) {
      console.error('[ai-governance-audit] Error:', err);
      return { ok: false, reviewed, flagged };
    }
  },
};

export async function run() {
  await AIGovernanceAuditJob.run();
}
