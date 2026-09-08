import { query } from '@/lib/postgres';

export interface PriceIndexEntry {
  serviceName: string;
  ourPrice: number | null;
  competitorAveragePrice: number;
  competitorCount: number;
  indexValue: number | null; // ourPrice / competitorAverage * 100; null if we have no matching plan
}

/** Real "Price Index" -- our price vs the average of real, admin-entered
 * competitor_price_point rows for the SAME service name (case-insensitive
 * exact match against our real pricing_plan_master/pricing_plan_price).
 * Services with no matching plan on our side are reported honestly with
 * indexValue: null rather than guessing a comparison. No fabricated
 * "market average" -- only real recorded competitor prices are averaged. */
export async function computePriceIndex(): Promise<PriceIndexEntry[]> {
  const competitorAverages = await query<{ service_name: string; avg_price: string; n: string }>(
    `SELECT service_name, avg(price)::text AS avg_price, count(*)::text AS n
     FROM competitor_price_point GROUP BY service_name`
  );

  // billing_cycle='monthly' pinned deliberately -- a plan can have multiple
  // real price rows (monthly/annual/etc.) and comparing against a mixed
  // basis would silently pick whichever row the join happened to return
  // last, producing a misleading index.
  const ourPrices = await query<{ name: string; amount: string }>(
    `SELECT pm.name, pp.amount::text
     FROM pricing_plan_master pm
     JOIN pricing_plan_price pp ON pp.plan_id = pm.id AND pp.is_promotional = false AND pp.billing_cycle = 'monthly'
     WHERE pm.status = 'active'`
  );
  const ourPriceMap = new Map(ourPrices.rows.map((r) => [r.name.trim().toLowerCase(), Number(r.amount)]));

  return competitorAverages.rows.map((r) => {
    const ourPrice = ourPriceMap.get(r.service_name.trim().toLowerCase()) ?? null;
    const competitorAveragePrice = Math.round(Number(r.avg_price) * 100) / 100;
    return {
      serviceName: r.service_name,
      ourPrice,
      competitorAveragePrice,
      competitorCount: Number(r.n),
      indexValue: ourPrice !== null && competitorAveragePrice > 0 ? Math.round((ourPrice / competitorAveragePrice) * 10000) / 100 : null,
    };
  });
}
