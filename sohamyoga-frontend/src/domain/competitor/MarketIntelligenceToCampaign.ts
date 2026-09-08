import { query } from '@/lib/postgres';
import { PriceChangeResult } from './PriceChangeDetector';

/** Real "Market Intelligence -> Campaign" link: when a competitor price
 * change is detected (PriceChangeDetector.ts, already real), also draft a
 * real campaign_brief row (status='draft', never auto-approved/launched)
 * so the insight becomes an actionable starting point for staff, not just
 * a notification that gets read and forgotten. */
export async function draftCampaignFromPriceChange(
  tenantId: string,
  competitorName: string,
  serviceName: string,
  change: PriceChangeResult,
): Promise<string | null> {
  if (!change.changed || change.deltaPct === null) return null;

  const isPriceDrop = change.deltaPct < 0;
  const objective = isPriceDrop ? 'sale' : 'retention';
  const name = `${isPriceDrop ? 'Price-match response' : 'Value differentiation'}: ${competitorName} ${serviceName}`;
  const description = isPriceDrop
    ? `${competitorName} dropped ${serviceName} pricing by ${Math.abs(change.deltaPct)}% (was $${change.previousPrice}). Consider a limited-time offer to retain price-sensitive prospects.`
    : `${competitorName} raised ${serviceName} pricing by ${change.deltaPct}% (was $${change.previousPrice}). Opportunity to emphasize value/quality without matching the increase.`;

  const today = new Date();
  const startDate = today.toISOString().slice(0, 10);
  const endDate = new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const utmSlug = `competitor-intel-${competitorName}-${serviceName}`.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 100);

  const result = await query<{ id: string }>(
    `INSERT INTO campaign_brief
       (tenant_id, name, description, objective, offer_type, channels, budget_planned_cad, start_date, end_date, status, utm_campaign, created_by)
     VALUES ($1,$2,$3,$4,'competitor_response','{email}',0,$5,$6,'draft',$7,'market-intelligence-system')
     RETURNING id`,
    [tenantId, name, description, objective, startDate, endDate, utmSlug],
  );
  return result.rows[0].id;
}
