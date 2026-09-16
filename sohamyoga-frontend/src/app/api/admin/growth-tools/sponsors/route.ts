import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function ensureSchema(pool: ReturnType<typeof getPool>) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS event_sponsors (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      event_id UUID,
      event_name TEXT,
      company_name TEXT NOT NULL,
      contact_name TEXT,
      contact_email TEXT,
      contact_phone TEXT,
      sponsorship_tier TEXT DEFAULT 'bronze',
      sponsorship_amount_cad NUMERIC(10,2),
      benefits_json JSONB DEFAULT '[]',
      status TEXT DEFAULT 'prospect',
      pitch_date DATE,
      decision_date DATE,
      notes TEXT,
      logo_url TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
  const { rowCount } = await pool.query(`SELECT 1 FROM event_sponsors LIMIT 1`);
  if (!rowCount) {
    await pool.query(`
      INSERT INTO event_sponsors
        (event_name, company_name, contact_name, contact_email, contact_phone,
         sponsorship_tier, sponsorship_amount_cad, benefits_json, status, pitch_date, decision_date, notes)
      VALUES
        ('Soham Yoga Annual Festival 2026', 'Lululemon Athletica', 'Sarah Park', 'spark@lululemon.com', '+16045550100',
         'title', 12000.00,
         '[{"benefit":"Naming rights on all materials","delivered":true},{"benefit":"Speaking slot (20 min)","delivered":false},{"benefit":"Logo on stage backdrop","delivered":false}]',
         'confirmed', '2026-08-01', '2026-08-15', 'Partner since 2024. Very engaged.'),
        ('Soham Yoga Annual Festival 2026', 'GoodLife Fitness', 'Tom Weller', 'tweller@goodlife.com', '+14165550201',
         'platinum', 5000.00,
         '[{"benefit":"Logo on all printed materials","delivered":true},{"benefit":"VIP table (6 seats)","delivered":false},{"benefit":"Social media mention x3","delivered":false}]',
         'invoiced', '2026-08-10', '2026-08-22', 'Invoice sent 2026-09-01'),
        ('Soham Yoga Annual Festival 2026', 'MindBodyOnline', 'Jessica Chung', 'jchung@mindbody.io', '+18005550301',
         'platinum', 5000.00,
         '[{"benefit":"Logo on materials","delivered":false},{"benefit":"VIP table","delivered":false},{"benefit":"App integration mention","delivered":false}]',
         'negotiating', '2026-09-05', NULL, 'Wants digital-only package, negotiating scope.'),
        ('Soham Yoga Annual Festival 2026', 'Nature''s Path Organics', 'David Lee', 'dlee@naturespath.com', '+16045550402',
         'gold', 2500.00,
         '[{"benefit":"Logo on materials","delivered":false},{"benefit":"Product sampling booth","delivered":false},{"benefit":"Social mention","delivered":false}]',
         'pitched', '2026-09-10', NULL, 'Pitch deck sent, awaiting decision.'),
        ('Soham Yoga Annual Festival 2026', 'Genuine Health', 'Maria Santos', 'msantos@genuinehealth.com', '+14165550503',
         'gold', 2500.00,
         '[{"benefit":"Logo on materials","delivered":false},{"benefit":"2 event tickets","delivered":false}]',
         'confirmed', '2026-08-20', '2026-09-01', 'Signed. Payment due Oct 1.'),
        ('Soham Yoga Annual Festival 2026', 'Manduka', 'Chris Nakamura', 'cnakamura@manduka.com', '+13105550604',
         'silver', 1000.00,
         '[{"benefit":"Logo on website","delivered":false},{"benefit":"1 event ticket","delivered":false}]',
         'prospect', NULL, NULL, 'Intro call scheduled for next week.'),
        ('Community Wellness Day', 'Harmony Health Foods', 'Lisa Brown', 'lbrown@harmonyhealth.ca', '+14165550705',
         'bronze', 500.00,
         '[{"benefit":"Name on sponsor list","delivered":true}]',
         'paid', '2026-07-15', '2026-07-20', 'Paid in full. Great partner.'),
        ('Community Wellness Day', 'Breathe Aromatherapy', NULL, 'info@breathearomatherapy.ca', NULL,
         'in_kind', NULL,
         '[{"benefit":"Product donation (retail value ~$400)","delivered":true},{"benefit":"Name on sponsor list","delivered":true}]',
         'completed', '2026-07-01', '2026-07-05', 'Donated 40 essential oil kits.');
    `);
  }
}

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const pool = getPool();
  await ensureSchema(pool);
  const { rows: sponsors } = await pool.query(`SELECT * FROM event_sponsors ORDER BY created_at DESC`);
  const { rows: tierStats } = await pool.query(`
    SELECT sponsorship_tier, COUNT(*) AS count,
           COALESCE(SUM(sponsorship_amount_cad),0) AS total_cad
    FROM event_sponsors
    WHERE status IN ('confirmed','invoiced','paid','completed')
    GROUP BY sponsorship_tier
    ORDER BY total_cad DESC
  `);
  const total = sponsors.length;
  const confirmed = sponsors.filter((s: { status: string }) => ['confirmed', 'invoiced', 'paid', 'completed'].includes(s.status)).length;
  const totalRevenue = sponsors
    .filter((s: { status: string }) => ['paid', 'completed'].includes(s.status))
    .reduce((sum: number, s: { sponsorship_amount_cad: string }) => sum + parseFloat(s.sponsorship_amount_cad || '0'), 0);
  const pipeline = sponsors
    .filter((s: { status: string }) => ['prospect', 'pitched', 'negotiating'].includes(s.status))
    .reduce((sum: number, s: { sponsorship_amount_cad: string }) => sum + parseFloat(s.sponsorship_amount_cad || '0'), 0);
  const avgDeal = confirmed > 0
    ? sponsors.filter((s: { status: string; sponsorship_amount_cad: string }) => ['confirmed', 'invoiced', 'paid', 'completed'].includes(s.status) && s.sponsorship_amount_cad)
        .reduce((sum: number, s: { sponsorship_amount_cad: string }, _: number, arr: { sponsorship_amount_cad: string }[]) =>
          sum + parseFloat(s.sponsorship_amount_cad) / arr.length, 0)
    : 0;
  return Response.json({ sponsors, tierStats, kpi: { total, confirmed, totalRevenue, pipeline, avgDeal } });
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const body = await req.json().catch(() => null);
  if (!body || !body.company_name) return Response.json({ error: 'company_name required' }, { status: 400 });
  const pool = getPool();
  await ensureSchema(pool);
  const { rows } = await pool.query(
    `INSERT INTO event_sponsors
      (event_name, company_name, contact_name, contact_email, contact_phone,
       sponsorship_tier, sponsorship_amount_cad, benefits_json, status, notes)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
    [
      body.event_name || null, body.company_name,
      body.contact_name || null, body.contact_email || null, body.contact_phone || null,
      body.sponsorship_tier || 'bronze',
      body.sponsorship_amount_cad || null,
      JSON.stringify(body.benefits_json || []),
      body.status || 'prospect',
      body.notes || null,
    ],
  );
  return Response.json({ sponsor: rows[0] }, { status: 201 });
}
