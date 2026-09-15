// Unified Lead Generation / Channel Attribution — backlog item #11.
// Identity resolution across channels already existed (LeadDedup.ts,
// real email-based dedup within campaign_lead, confirmed before
// building this) and conversion linkage already existed
// (campaign_lead.customer_id, set on real conversion). The real
// remaining gap: a channel-level attribution rollup -- which real
// source_platform actually converts. Pure aggregation over real data,
// no new schema needed.

import { Pool } from 'pg';

const db = new Pool({ connectionString: process.env.DATABASE_URL });

export interface ChannelAttributionRow { channel: string; totalLeads: number; converted: number; conversionRate: number | null; duplicates: number }

// Pure, unit-tested: real conversion rate, null (not 0) with zero real leads.
export function computeConversionRate(totalLeads: number, converted: number): number | null {
  if (totalLeads === 0) return null;
  return Math.round((converted / totalLeads) * 1000) / 10;
}

export async function getChannelAttribution(tenantId: string): Promise<ChannelAttributionRow[]> {
  const r = await db.query<{ source_platform: string; total: string; converted: string; duplicates: string }>(
    `SELECT COALESCE(source_platform, 'unknown') AS source_platform,
            count(*)::text AS total,
            count(*) FILTER (WHERE funnel_stage = 'converted')::text AS converted,
            count(*) FILTER (WHERE duplicate_of_lead_id IS NOT NULL)::text AS duplicates
     FROM campaign_lead WHERE tenant_id = $1 GROUP BY source_platform ORDER BY count(*) DESC`,
    [tenantId],
  );
  return r.rows.map((row) => ({
    channel: row.source_platform, totalLeads: Number(row.total), converted: Number(row.converted),
    conversionRate: computeConversionRate(Number(row.total), Number(row.converted)), duplicates: Number(row.duplicates),
  }));
}
