// LeadNurturingJob — Weekly Friday 06:00 UTC
// Scores campaign leads and triggers Mautic drip sequences for warm leads.
// Uses Ollama fast model for scoring. No PII sent externally.

import { Pool } from 'pg';
import { ollama } from '../OllamaClient';

const db          = new Pool({ connectionString: process.env.DATABASE_URL });
const MAUTIC_BASE = process.env.MAUTIC_BASE_URL  ?? 'http://localhost:8888';
const MAUTIC_USER = process.env.MAUTIC_USER       ?? '';
const MAUTIC_PASS = process.env.MAUTIC_PASSWORD   ?? '';

const SYSTEM = `You are a sales analyst. Score the lead engagement.
Return ONLY valid JSON:
{"score": 0-100, "temperature": "cold"|"warm"|"hot", "next_action": "string"}
Score 0=cold, 100=immediately ready to buy.`;

async function triggerMauticSegment(leadId: string, segment: string) {
  // Only sends segment action trigger — no PII in payload
  const auth = Buffer.from(`${MAUTIC_USER}:${MAUTIC_PASS}`).toString('base64');
  await fetch(`${MAUTIC_BASE}/api/contacts/${leadId}/segments/${segment}/add`, {
    method:  'POST',
    headers: { 'Authorization': `Basic ${auth}` },
    signal:  AbortSignal.timeout(5000),
  });
}

export async function run(): Promise<void> {
  const leads = await db.query<{
    id: string; tenant_id: string; mautic_contact_id: string | null;
    source_platform: string; funnel_stage: string;
    days_since_capture: number; has_booking: boolean;
  }>(`
    SELECT
      cl.id,
      cl.tenant_id,
      cl.mautic_contact_id,
      cl.source_platform,
      cl.funnel_stage,
      EXTRACT(DAY FROM NOW() - cl.created_at)::int AS days_since_capture,
      (cl.converted_at IS NOT NULL) AS has_booking
    FROM campaign_lead cl
    WHERE cl.funnel_stage NOT IN ('converted', 'disqualified')
      AND cl.created_at >= NOW() - INTERVAL '90 days'
    LIMIT 200
  `);

  let warm = 0, hot = 0;

  for (const lead of leads.rows) {
    try {
      const prompt = [
        `Source: ${lead.source_platform}`,
        `Stage: ${lead.funnel_stage}`,
        `Days since capture: ${lead.days_since_capture}`,
        `Booked a class: ${lead.has_booking}`,
      ].join('\n');

      const raw = await ollama.generate(prompt, { tier: 'fast', system: SYSTEM, maxTokens: 150 });
      let score: { score: number; temperature: string; next_action: string };
      try { score = JSON.parse(raw); } catch { continue; }

      // Update lead score locally
      await db.query(`
        UPDATE campaign_lead SET
          lead_score = $1,
          lead_temperature = $2,
          updated_at = NOW()
        WHERE id = $3
      `, [Math.max(0, Math.min(100, score.score)), score.temperature, lead.id]);

      // Trigger Mautic drip for warm/hot leads
      if (score.temperature === 'warm' && lead.mautic_contact_id) {
        await triggerMauticSegment(lead.mautic_contact_id, 'warm-yoga-leads');
        warm++;
      } else if (score.temperature === 'hot' && lead.mautic_contact_id) {
        await triggerMauticSegment(lead.mautic_contact_id, 'hot-yoga-leads');
        hot++;
      }
    } catch (err) {
      console.error(`[lead-nurturing] lead ${lead.id}:`, err);
    }
  }

  console.log(`[lead-nurturing] processed=${leads.rows.length} warm=${warm} hot=${hot}`);
  await db.end();
}
