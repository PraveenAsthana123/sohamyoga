import { query } from '@/lib/postgres';

// Market Intelligence Alerts / Competitor Change Detection -- a real check
// against the competitor_price_point history already recorded by admins
// (manual data entry, no scraping). When a new price point for a
// service_name differs from the immediately preceding one for the same
// competitor+service, queue a real admin notification via the existing
// notification_queue system. No fabricated "AI insight" -- just a real
// diff against real prior data.
export interface PriceChangeResult {
  changed: boolean;
  previousPrice: number | null;
  deltaPct: number | null;
}

export async function detectPriceChange(
  competitorId: string,
  serviceName: string,
  newPrice: number,
  excludePricePointId: string,
): Promise<PriceChangeResult> {
  const prior = await query<{ price: string }>(
    `SELECT price FROM competitor_price_point
     WHERE competitor_id = $1 AND service_name = $2 AND id != $3
     ORDER BY effective_date DESC LIMIT 1`,
    [competitorId, serviceName, excludePricePointId],
  );
  if (!prior.rows.length) return { changed: false, previousPrice: null, deltaPct: null };

  const previousPrice = Number(prior.rows[0].price);
  if (previousPrice === newPrice) return { changed: false, previousPrice, deltaPct: 0 };

  const deltaPct = Math.round(((newPrice - previousPrice) / previousPrice) * 1000) / 10;
  return { changed: true, previousPrice, deltaPct };
}

export async function queueCompetitorPriceAlert(
  tenantId: string,
  competitorName: string,
  serviceName: string,
  change: PriceChangeResult,
): Promise<void> {
  const admin = await query<{ tenant_id: string; id: string; email: string }>(
    `SELECT tenant_id, id, email FROM app_user WHERE role='admin' AND status='active' AND tenant_id = $1 LIMIT 1`,
    [tenantId],
  );
  if (!admin.rows[0]) return;

  await query(
    `INSERT INTO notification_queue
       (tenant_id, template_slug, channel, type, recipient_user_id, recipient_address, payload, idempotency_key)
     VALUES ($1,'competitor_price_change','in_app','alert',$2,$3,$4,$5)
     ON CONFLICT (tenant_id, idempotency_key) DO NOTHING`,
    [
      admin.rows[0].tenant_id, admin.rows[0].id, admin.rows[0].email,
      JSON.stringify({ competitorName, serviceName, previousPrice: change.previousPrice, deltaPct: change.deltaPct }),
      `competitor_price_change_${competitorName}_${serviceName}_` + new Date().toISOString().slice(0, 10),
    ],
  );
}
