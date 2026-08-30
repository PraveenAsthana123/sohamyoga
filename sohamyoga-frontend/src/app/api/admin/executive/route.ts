import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { getAdminPrincipal } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function probe(url: string): Promise<boolean> {
  try {
    const r = await fetch(url, { redirect: 'manual', cache: 'no-store', signal: AbortSignal.timeout(2500) });
    return r.status > 0 && r.status < 500;
  } catch { return false; }
}

// GET /api/admin/executive — every KPI is a real query against real tables. Where no
// real data source exists in this codebase yet (uptime SLA tracking, error-rate
// telemetry, renewal-event logging), the field is omitted or explicitly labeled
// "not tracked" rather than filled with an invented number.
export async function GET(req: NextRequest) {
  const { denied } = await getAdminPrincipal(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const [
    revenuePeriods, mrrRow, topPlans, topProducts,
    activeMembersRow, subStatusCounts, tierBreakdown,
    opsToday, attendance30d, waitlistToday, checkinsToday, todaysSchedule,
    teacherCounts, expiringCerts, topTeacherRevenue,
    leadsWeek, conv90d, referralsMonth, campaignPerf,
    services,
  ] = await Promise.all([
    query<{ today: string; week: string; month: string; quarter: string; ytd: string }>(
      `SELECT
        COALESCE(SUM(total) FILTER (WHERE payment_status='paid' AND created_at >= CURRENT_DATE), 0) AS today,
        COALESCE(SUM(total) FILTER (WHERE payment_status='paid' AND created_at >= now() - interval '7 days'), 0) AS week,
        COALESCE(SUM(total) FILTER (WHERE payment_status='paid' AND created_at >= date_trunc('month', now())), 0) AS month,
        COALESCE(SUM(total) FILTER (WHERE payment_status='paid' AND created_at >= date_trunc('quarter', now())), 0) AS quarter,
        COALESCE(SUM(total) FILTER (WHERE payment_status='paid' AND created_at >= date_trunc('year', now())), 0) AS ytd
       FROM sales_order`,
    ),
    query<{ mrr: string }>(
      `SELECT COALESCE(SUM(billing_amount) FILTER (WHERE billing_cycle = 'monthly'), 0)
              + COALESCE(SUM(billing_amount) FILTER (WHERE billing_cycle = 'annual'), 0) / 12.0 AS mrr
       FROM subscription_master WHERE status = 'active'`,
    ),
    query<{ plan_name: string; revenue: string }>(
      `SELECT plan_name, SUM(billing_amount) AS revenue FROM subscription_master
       WHERE status = 'active' GROUP BY plan_name ORDER BY revenue DESC LIMIT 6`,
    ),
    query<{ name: string; revenue: string }>(
      `SELECT oi.product_name AS name, SUM(oi.total_amount) AS revenue FROM order_item oi
       JOIN sales_order so ON so.id = oi.order_id AND so.payment_status = 'paid'
       GROUP BY oi.product_name ORDER BY revenue DESC LIMIT 6`,
    ),
    query<{ count: string }>(`SELECT COUNT(*) AS count FROM student WHERE status = 'active'`),
    query<{ status: string; count: string }>(`SELECT status, COUNT(*) AS count FROM subscription_master GROUP BY status`),
    query<{ plan_type: string; count: string }>(
      `SELECT plan_type, COUNT(*) AS count FROM subscription_master WHERE status = 'active' GROUP BY plan_type ORDER BY count DESC`,
    ),
    query<{ count: string }>(`SELECT COUNT(*) AS count FROM class_session WHERE session_date = CURRENT_DATE`),
    query<{ checked_in: string; no_show: string; confirmed: string }>(
      `SELECT COUNT(*) FILTER (WHERE b.status = 'checked_in') AS checked_in,
              COUNT(*) FILTER (WHERE b.status = 'no_show') AS no_show,
              COUNT(*) FILTER (WHERE b.status = 'confirmed') AS confirmed
       FROM booking b JOIN class_session cs ON cs.id = b.class_session_id
       WHERE cs.session_date >= CURRENT_DATE - interval '30 days'`,
    ),
    query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM waitlist_entry w JOIN class_session cs ON cs.id = w.class_session_id
       WHERE cs.session_date = CURRENT_DATE AND w.status = 'waiting'`,
    ),
    query<{ count: string }>(`SELECT COUNT(*) AS count FROM booking WHERE status = 'checked_in' AND checked_in_at::date = CURRENT_DATE`),
    query<{ class_name: string; teacher_name: string; start_time: string; capacity: number; status: string; booked: string }>(
      `SELECT cs.class_name, cs.teacher_name, cs.start_time, cs.capacity, cs.status,
              (SELECT COUNT(*) FROM booking b WHERE b.class_session_id = cs.id AND b.status IN ('confirmed','checked_in')) AS booked
       FROM class_session cs WHERE cs.session_date = CURRENT_DATE ORDER BY cs.start_time`,
    ),
    query<{ active: string; total: string }>(
      `SELECT COUNT(*) FILTER (WHERE status = 'active') AS active, COUNT(*) AS total FROM teacher_profile`,
    ),
    query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM teacher_certification
       WHERE status = 'verified' AND expires_at IS NOT NULL AND expires_at BETWEEN CURRENT_DATE AND CURRENT_DATE + interval '30 days'`,
    ),
    query<{ name: string; revenue: string }>(
      `SELECT tp.first_name || ' ' || tp.last_name AS name, SUM(oi.total_amount) AS revenue
       FROM order_item oi
       JOIN sales_order so ON so.id = oi.order_id AND so.payment_status = 'paid'
       JOIN teacher_profile tp ON oi.teacher_id ~ '^[0-9a-f-]{36}$' AND tp.id = oi.teacher_id::uuid
       GROUP BY tp.id, tp.first_name, tp.last_name ORDER BY revenue DESC LIMIT 5`,
    ),
    query<{ count: string }>(`SELECT COUNT(*) AS count FROM campaign_lead WHERE created_at >= now() - interval '7 days'`),
    query<{ total: string; converted: string }>(
      `SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE funnel_stage = 'converted') AS converted
       FROM campaign_lead WHERE created_at >= now() - interval '90 days'`,
    ),
    query<{ count: string }>(`SELECT COUNT(*) AS count FROM referral_registration WHERE registered_at >= date_trunc('month', now())`),
    query<{ title: string; impressions: string; clicks: string; leads: string; revenue: string }>(
      `SELECT cb.name AS title, SUM(ca.impressions) AS impressions, SUM(ca.clicks) AS clicks,
              SUM(ca.leads_captured) AS leads, SUM(ca.revenue_cad) AS revenue
       FROM campaign_analytics ca JOIN campaign_brief cb ON cb.id = ca.brief_id
       WHERE ca.analytics_date >= CURRENT_DATE - interval '30 days'
       GROUP BY cb.id, cb.name ORDER BY revenue DESC LIMIT 6`,
    ),
    Promise.all([
      probe(process.env.MAUTIC_URL || 'http://127.0.0.1:18090'),
      probe(process.env.POSTIZ_CLIENT_URL || 'http://127.0.0.1:15080'),
      probe(process.env.OLLAMA_URL || 'http://127.0.0.1:11434/api/tags'),
      probe(process.env.ACTIVEPIECES_HEALTH_URL || 'http://127.0.0.1:18181/api/v1/health'),
    ]),
  ]);

  const rev = revenuePeriods.rows[0];
  const subStatus = Object.fromEntries(subStatusCounts.rows.map(r => [r.status, Number(r.count)]));
  const topRevenueSources = [
    ...topPlans.rows.map(p => ({ name: `${p.plan_name} (membership)`, revenue: Number(p.revenue) })),
    ...topProducts.rows.map(p => ({ name: p.name, revenue: Number(p.revenue) })),
  ].sort((a, b) => b.revenue - a.revenue).slice(0, 6);

  const attendanceTotal = Number(attendance30d.rows[0]?.checked_in ?? 0) + Number(attendance30d.rows[0]?.no_show ?? 0) + Number(attendance30d.rows[0]?.confirmed ?? 0);
  const attendanceRatePct = attendanceTotal ? Math.round((Number(attendance30d.rows[0].checked_in) / attendanceTotal) * 1000) / 10 : null;

  const teachers = teacherCounts.rows[0];
  const convTotal = Number(conv90d.rows[0]?.total ?? 0);
  const convDone = Number(conv90d.rows[0]?.converted ?? 0);

  return Response.json({
    generatedAt: new Date().toISOString(),
    overview: {
      monthRevenue: Number(rev.month), mrr: Math.round(Number(mrrRow.rows[0]?.mrr ?? 0) * 100) / 100,
      activeMembers: Number(activeMembersRow.rows[0]?.count ?? 0),
      classesToday: Number(opsToday.rows[0]?.count ?? 0),
      newLeadsWeek: Number(leadsWeek.rows[0]?.count ?? 0),
      activeTeachers: Number(teachers?.active ?? 0),
      totalTeachers: Number(teachers?.total ?? 0),
      trialSubscriptions: subStatus.trial ?? 0,
      pausedOrFrozenSubscriptions: (subStatus.paused ?? 0) + (subStatus.frozen ?? 0),
    },
    revenue: {
      today: Number(rev.today), week: Number(rev.week), month: Number(rev.month),
      quarter: Number(rev.quarter), ytd: Number(rev.ytd), mrr: Math.round(Number(mrrRow.rows[0]?.mrr ?? 0) * 100) / 100,
      topSources: topRevenueSources,
    },
    memberships: {
      activeMembers: Number(activeMembersRow.rows[0]?.count ?? 0),
      activeSubscriptions: subStatus.active ?? 0,
      trialActive: subStatus.trial ?? 0,
      pausedSubscriptions: subStatus.paused ?? 0,
      frozenSubscriptions: subStatus.frozen ?? 0,
      cancelledSubscriptions: subStatus.cancelled ?? 0,
      tierBreakdown: tierBreakdown.rows.map(t => ({ tier: t.plan_type, count: Number(t.count) })),
    },
    operations: {
      classesToday: Number(opsToday.rows[0]?.count ?? 0),
      attendanceRatePct30d: attendanceRatePct,
      waitlistToday: Number(waitlistToday.rows[0]?.count ?? 0),
      checkinsToday: Number(checkinsToday.rows[0]?.count ?? 0),
      schedule: todaysSchedule.rows.map(s => ({
        className: s.class_name, teacher: s.teacher_name, startTime: s.start_time, capacity: s.capacity,
        booked: Number(s.booked), status: s.status,
      })),
    },
    teachers: {
      activeTeachers: Number(teachers?.active ?? 0), totalTeachers: Number(teachers?.total ?? 0),
      certificationsExpiringSoon: Number(expiringCerts.rows[0]?.count ?? 0),
      topByRevenue: topTeacherRevenue.rows.map(t => ({ name: t.name, revenue: Number(t.revenue) })),
      note: 'Utilization and average rating are not tracked anywhere in this codebase yet — omitted rather than fabricated.',
    },
    marketing: {
      newLeadsWeek: Number(leadsWeek.rows[0]?.count ?? 0),
      conversionRatePct90d: convTotal ? Math.round((convDone / convTotal) * 1000) / 10 : 0,
      referralSignupsThisMonth: Number(referralsMonth.rows[0]?.count ?? 0),
      campaignPerformance: campaignPerf.rows.map(c => ({
        title: c.title, impressions: Number(c.impressions), clicks: Number(c.clicks),
        leads: Number(c.leads), revenue: Number(c.revenue),
      })),
      note: 'Email open/click rates come from Mautic and are not yet ingested into this database — not shown rather than invented.',
    },
    system: {
      services: { mautic: services[0], postiz: services[1], ollama: services[2], activepieces: services[3], postgres: true },
      note: 'Live reachability probes only. This project has no uptime-SLA, error-rate, or failed-job telemetry pipeline wired up yet, so those figures are intentionally omitted rather than invented.',
    },
  });
}
