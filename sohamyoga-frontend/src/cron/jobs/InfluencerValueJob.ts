// InfluencerValueJob — Weekly Thursday 09:00 UTC (Phase D of the
// growth-loop architecture). Scores known influencers (influencer_profile
// rows already identified or added by staff) from real referral
// attribution only: referral_count and revenue_attributed come from the
// real referral_master rows tied to that influencer's issued referral_code
// (migration-052 referral domain). An influencer with no code issued yet
// gets value_status='insufficient_data' rather than a fabricated score —
// this job never invents reach or engagement numbers for an influencer it
// has no real tracked activity for. Content-engagement scoring via
// social_post_analytics is deliberately NOT included in v1 — no schema
// link exists yet between influencer_profile and social_account/
// social_post (see db-schema-influencer.sql header).
//
// Ollama writes one advisory sentence for the single highest-scoring real
// (non-insufficient-data) influencer each run — it explains an
// already-computed score, it never invents the numbers.

import { Pool } from 'pg';
import { ollama } from '../OllamaClient';

const db = new Pool({ connectionString: process.env.DATABASE_URL });

function extractText(raw: string): string {
  return raw.trim().replace(/^```(?:text)?\s*/i, '').replace(/```\s*$/i, '').trim();
}

// Documented, bounded formula — max 100 points:
//   Referrals (0-50): 5 points per successful referral (verified+), capped at 10
//   Revenue   (0-50): 5 points per $100 of attributed order revenue, capped at $1000
function valueScore(referralCount: number, revenue: number): number {
  const referralPoints = Math.min(referralCount, 10) * 5;
  const revenuePoints = Math.min(Math.floor(revenue / 100), 10) * 5;
  return referralPoints + revenuePoints;
}

export async function run(): Promise<void> {
  const tenant = await db.query<{ id: string }>(`SELECT id FROM tenant LIMIT 1`);
  if (!tenant.rowCount) { console.log('[influencer-value] no tenant configured, skipping'); return; }
  const tenantId = tenant.rows[0].id;

  const influencers = await db.query<{ id: string; handle: string; referral_code_id: string | null }>(
    `SELECT id, handle, referral_code_id FROM influencer_profile WHERE status != 'inactive'`,
  );

  if (!influencers.rowCount) { console.log('[influencer-value] no influencer profiles yet, skipping'); return; }

  let topScored: { influencerId: string; handle: string; score: number; referralCount: number; revenue: number } | null = null;

  for (const inf of influencers.rows) {
    if (!inf.referral_code_id) {
      await db.query(
        `INSERT INTO influencer_value_score (tenant_id, influencer_id, referral_count, revenue_attributed, value_score, value_status)
         VALUES ($1,$2,0,0,0,'insufficient_data')
         ON CONFLICT (influencer_id) DO UPDATE SET referral_count=0, revenue_attributed=0, value_score=0, value_status='insufficient_data', computed_at=now()`,
        [tenantId, inf.id],
      );
      continue;
    }

    const stats = await db.query<{ referral_count: string; revenue: string | null }>(
      `SELECT COUNT(*)::text AS referral_count, SUM(order_amount) AS revenue
       FROM referral_master
       WHERE referral_code_id = $1 AND status IN ('verified','membership_purchased','reward_pending','reward_approved','reward_paid')`,
      [inf.referral_code_id],
    );
    const referralCount = Number(stats.rows[0].referral_count);
    const revenue = stats.rows[0].revenue ? Number(stats.rows[0].revenue) : 0;
    const score = valueScore(referralCount, revenue);

    await db.query(
      `INSERT INTO influencer_value_score (tenant_id, influencer_id, referral_count, revenue_attributed, value_score, value_status)
       VALUES ($1,$2,$3,$4,$5,'scored')
       ON CONFLICT (influencer_id) DO UPDATE SET
         referral_count=$3, revenue_attributed=$4, value_score=$5, value_status='scored', computed_at=now()`,
      [tenantId, inf.id, referralCount, revenue, score],
    );

    if (!topScored || score > topScored.score) {
      topScored = { influencerId: inf.id, handle: inf.handle, score, referralCount, revenue };
    }
  }

  console.log(`[influencer-value] scored ${influencers.rowCount} influencer profiles`);

  if (topScored && topScored.score > 0) {
    try {
      const prompt = `Influencer @${topScored.handle}: ${topScored.referralCount} successful referrals, $${topScored.revenue.toFixed(2)} attributed revenue, composite value score ${topScored.score}/100.`;
      const raw = await ollama.generate(prompt, {
        tier: 'fast',
        system: 'You are an influencer-marketing analyst for a yoga studio. Given one real, already-computed influencer value score with its referral count and attributed revenue, write 1 sentence noting their real impact and one concrete next step (e.g. renew collaboration, increase compensation tier). Only reason from the numbers given — do not invent follower counts, engagement rates, or content quality claims not implied by the data.',
        maxTokens: 150, timeoutMs: 45_000,
      });
      const note = extractText(raw);
      await db.query(`UPDATE influencer_value_score SET ai_note = $1 WHERE influencer_id = $2`, [note, topScored.influencerId]);
    } catch (err) {
      console.error('[influencer-value] note failed:', err);
    }
  }
  // Do NOT db.end() here — runner.ts caches this module across every
  // scheduled invocation in the long-lived cron container.
}
