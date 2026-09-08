import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Real cross-channel ROI rollup (module_registry: cross-channel-roi-dashboard,
// was partial -- "Per-campaign ROI is real; no single view rolls up spend/
// performance across paid ads + email + social + SEO as separate systems
// into one aggregate number").
//
// Honest limitation, stated up front rather than hidden: this combines TWO
// real but methodologically different sources that this codebase does not
// (and cannot, without a shared join key) fully reconcile:
//   1. platformReported  -- ad_analytics.spend_cents/revenue_cents, self-
//      reported per ad campaign (v_daily_roas' source table). Real, but
//      today 0 rows exist because no ad-platform API client is connected
//      (see module_registry: paid-ads, google-ads) -- so this is honestly
//      $0, not fabricated performance.
//   2. sessionAttributed -- tracking_event/tracking_session last-touch
//      attribution (the SAME real join /api/analytics/attribution/route.ts
//      uses), summing the one real revenue figure this codebase actually
//      captures (booking_completed's properties->>'price', in dollars) by
//      traffic_source. Email/social/SEO/direct have no per-session spend
//      figure anywhere in this codebase, so their cost is honestly 0 --
//      this is not "free marketing" being claimed, it is "no cost-tracking
//      system exists for these channels yet."
// These two are NOT deduplicated against each other (a session-attributed
// "paid_search" conversion and a platform-reported search campaign's
// revenue could theoretically double-count the same real booking) -- the
// response says so explicitly via `caveats` rather than silently blending
// them into one falsely-precise number.
export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const days = Math.min(Number(req.nextUrl.searchParams.get('days')) || 30, 90);

  const platformReported = await query<{ campaign_type: string; spend_cents: string; revenue_cents: string; campaigns: string }>(
    `SELECT c.campaign_type::text, COALESCE(SUM(n.spend_cents),0) AS spend_cents,
            COALESCE(SUM(n.revenue_cents),0) AS revenue_cents, COUNT(DISTINCT c.id) AS campaigns
     FROM ad_campaign c
     LEFT JOIN ad_analytics n ON n.campaign_id = c.id AND n.period_start >= (CURRENT_DATE - ($1||' days')::interval)
     GROUP BY c.campaign_type ORDER BY 1`,
    [days],
  );

  const sessionAttributed = await query<{ channel: string; revenue: string; conversions: string }>(
    `SELECT COALESCE(NULLIF(s.traffic_source::text,''), 'direct') AS channel,
            COALESCE(SUM((e.properties->>'price')::numeric) FILTER (WHERE e.event_type='booking_completed'), 0) AS revenue,
            COUNT(*) AS conversions
     FROM tracking_event e JOIN tracking_session s ON s.id = e.session_id
     WHERE e.event_type IN ('booking_completed','payment_completed','subscription_started')
       AND e.status = 'collected' AND e.created_at >= now() - ($1 || ' days')::interval
     GROUP BY 1 ORDER BY revenue DESC`,
    [days],
  );

  const platformRows = platformReported.rows.map(r => {
    const spend = Number(r.spend_cents), revenue = Number(r.revenue_cents);
    return {
      source: 'platform_reported' as const, channel: r.campaign_type, campaigns: Number(r.campaigns),
      spendCents: spend, revenueCents: revenue,
      roiPct: spend > 0 ? Math.round(((revenue - spend) / spend) * 1000) / 10 : null,
    };
  });
  const sessionRows = sessionAttributed.rows.map(r => ({
    source: 'session_attributed' as const, channel: r.channel, conversions: Number(r.conversions),
    spendCents: 0, revenueCents: Math.round(Number(r.revenue) * 100),
    roiPct: null as number | null, // no cost basis captured for these channels -- ROI% is undefined, not infinite/fabricated
  }));

  const totalSpendCents = platformRows.reduce((s, r) => s + r.spendCents, 0);
  const totalRevenueCents = platformRows.reduce((s, r) => s + r.revenueCents, 0) + sessionRows.reduce((s, r) => s + r.revenueCents, 0);

  return Response.json({
    windowDays: days,
    platformReported: platformRows,
    sessionAttributed: sessionRows,
    totals: {
      totalSpendCents, totalRevenueCents,
      blendedRoiPct: totalSpendCents > 0 ? Math.round(((totalRevenueCents - totalSpendCents) / totalSpendCents) * 1000) / 10 : null,
    },
    caveats: [
      'platformReported and sessionAttributed are two real, independently-measured sources -- NOT deduplicated against each other. A booking attributed to a paid channel in sessionAttributed could theoretically already be reflected in platformReported\'s revenue_cents for the same real conversion.',
      'sessionAttributed revenue only reflects booking_completed events (the one conversion type this codebase captures a real price for) -- payment_completed/subscription_started conversions are counted but contribute $0 here, honestly, not fabricated.',
      'Every non-ad channel (email/social/SEO/direct) shows spend=0 because no cost-tracking system exists for them in this codebase -- this reflects a real absence of data, not a claim of free marketing.',
    ],
  });
}
