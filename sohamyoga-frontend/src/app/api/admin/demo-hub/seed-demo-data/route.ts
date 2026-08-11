import { NextRequest } from 'next/server';
import { databaseConfigured, transaction } from '@/lib/postgres';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Seeds a small, clearly-tagged set of real underlying records so the
 * Reports tab's jobs (Voice of Customer, Campaign Health Audit, Churn
 * Prediction) have real data to compute over instead of showing permanent
 * empty states in a fresh environment. This does NOT insert fabricated
 * report output — it inserts genuine source rows (leads, a campaign, an
 * enrollment) and lets the real cron jobs (triggered separately via
 * "Run Now") compute real findings/digests/predictions from them, the same
 * way production data would. Idempotent: every insert is guarded so
 * re-running this is a no-op once the demo rows exist.
 */
const DEMO_TENANT_ID = '16fb3a23-5370-4572-bc93-2076534a4e99';
const DEMO_STUDENT_ID = 'd0000000-0000-4000-8000-000000000001';
const DEMO_COURSE_ID = 'd0000000-0000-4000-8000-0000000000c1';
const DEMO_LEAD_EMAIL_DOMAIN = 'demo.sohamyoga.internal';

const DEMO_LEAD_MESSAGES = [
  { subject: 'Loved the morning flow class', message: 'The 7am Hatha class with Priya is incredible — I feel so much calmer starting my day this way. Please keep offering it!', temperature: 'hot' },
  { subject: 'Booking flow is confusing', message: 'I tried to book a class three times and the confirmation email never arrived. Had to call the studio to check if it actually worked.', temperature: 'warm' },
  { subject: 'More evening slots please', message: 'Everything after 6pm is always full within a day. Would love to see more evening Vinyasa classes added to the schedule.', temperature: 'warm' },
  { subject: 'Pricing question', message: 'Is there a discount for students? The membership price is a bit steep for me right now but I really want to keep coming.', temperature: 'cold' },
  { subject: 'Great experience overall', message: 'Been a member for two months now. The teachers are attentive and the studio is always clean. Only wish parking was easier.', temperature: 'hot' },
];

export async function POST(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const summary = await transaction(async client => {
    let leadCount = 0;
    const existingLeads = await client.query(`SELECT COUNT(*)::int AS n FROM campaign_lead WHERE email LIKE $1`, [`%@${DEMO_LEAD_EMAIL_DOMAIN}`]);
    if (Number(existingLeads.rows[0].n) === 0) {
      for (let i = 0; i < DEMO_LEAD_MESSAGES.length; i++) {
        const m = DEMO_LEAD_MESSAGES[i];
        await client.query(
          `INSERT INTO campaign_lead (tenant_id, first_name, last_name, email, subject, message, funnel_stage, lead_temperature, source_platform, created_at)
           VALUES ($1, 'Demo', $2, $3, $4, $5, 'new', $6, 'website', now() - ($7 || ' days')::interval)`,
          [DEMO_TENANT_ID, `Lead ${i + 1}`, `demo-lead-${i + 1}@${DEMO_LEAD_EMAIL_DOMAIN}`, m.subject, m.message, m.temperature, i + 1],
        );
        leadCount++;
      }
    }

    const existingEnrollment = await client.query(
      `SELECT 1 FROM enrollment WHERE student_id = $1 AND course_id = $2`,
      [DEMO_STUDENT_ID, DEMO_COURSE_ID],
    );
    let enrollmentCreated = false;
    if (!existingEnrollment.rowCount) {
      await client.query(
        `INSERT INTO enrollment (tenant_id, student_id, course_id, status, start_date, enrolled_at)
         VALUES ($1, $2, $3, 'active', CURRENT_DATE - INTERVAL '60 days', now() - INTERVAL '60 days')`,
        [DEMO_TENANT_ID, DEMO_STUDENT_ID, DEMO_COURSE_ID],
      );
      enrollmentCreated = true;
    }

    const existingCampaign = await client.query(
      `SELECT 1 FROM ad_campaign WHERE name = 'Demo Showcase Campaign (no ad groups)'`,
    );
    let campaignCreated = false;
    if (!existingCampaign.rowCount) {
      await client.query(
        `INSERT INTO ad_campaign (name, campaign_type, status, daily_budget_cents, total_budget_cents, bidding_strategy, start_date, created_by)
         VALUES ('Demo Showcase Campaign (no ad groups)', 'search', 'active', 2000, 60000, 'manual_cpc', CURRENT_DATE - INTERVAL '10 days', 'demo-hub-seed')`,
      );
      campaignCreated = true;
    }

    return { leadCount, enrollmentCreated, campaignCreated };
  });

  return Response.json({
    seeded: summary,
    nextSteps: 'Run "voice-of-customer", "churn-prediction" and "campaign-health-audit" from the Use Case Catalog to compute real reports over this data.',
  });
}
