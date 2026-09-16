import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function ensureTables(): Promise<void> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS np_donor (
        id SERIAL PRIMARY KEY, first_name TEXT NOT NULL, last_name TEXT NOT NULL,
        email TEXT NOT NULL, phone TEXT, address TEXT,
        city TEXT DEFAULT 'Calgary', province TEXT DEFAULT 'AB', postal_code TEXT,
        donor_type TEXT DEFAULT 'individual' CHECK (donor_type IN ('individual','corporate','foundation','government','anonymous')),
        giving_level TEXT DEFAULT 'friend' CHECK (giving_level IN ('friend','supporter','patron','champion','benefactor','legacy')),
        total_donated DECIMAL(12,2) DEFAULT 0, first_donation_date DATE, last_donation_date DATE,
        preferred_cause TEXT[], communication_preference TEXT DEFAULT 'email'
          CHECK (communication_preference IN ('email','mail','phone','none')),
        tax_receipt_required BOOLEAN DEFAULT true,
        employer TEXT, employer_matching BOOLEAN DEFAULT false,
        notes TEXT, created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS np_campaign (
        id SERIAL PRIMARY KEY, name TEXT NOT NULL, description TEXT,
        campaign_type TEXT DEFAULT 'annual_fund'
          CHECK (campaign_type IN ('annual_fund','capital','emergency','endowment','event','grant','matching','online','other')),
        goal_amount DECIMAL(12,2), start_date DATE, end_date DATE,
        status TEXT DEFAULT 'planning' CHECK (status IN ('planning','active','completed','paused')),
        total_raised DECIMAL(12,2) DEFAULT 0, donor_count INTEGER DEFAULT 0,
        campaign_code TEXT UNIQUE, created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS np_donation (
        id SERIAL PRIMARY KEY, donor_id INTEGER REFERENCES np_donor(id),
        amount DECIMAL(12,2) NOT NULL, donation_date DATE NOT NULL DEFAULT CURRENT_DATE,
        campaign_id INTEGER REFERENCES np_campaign(id),
        fund TEXT DEFAULT 'general'
          CHECK (fund IN ('general','restricted','capital','endowment','emergency')),
        payment_method TEXT CHECK (payment_method IN ('cheque','credit_card','etransfer','bank_transfer','paypal','cash','stock','in_kind')),
        in_kind_description TEXT, in_kind_fair_value DECIMAL(12,2),
        recurring BOOLEAN DEFAULT false, recurring_frequency TEXT
          CHECK (recurring_frequency IN ('weekly','monthly','quarterly','annual')),
        anonymous BOOLEAN DEFAULT false,
        tax_receipt_number TEXT, tax_receipt_issued BOOLEAN DEFAULT false, tax_receipt_date DATE,
        notes TEXT, created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS np_volunteer (
        id SERIAL PRIMARY KEY, first_name TEXT NOT NULL, last_name TEXT NOT NULL,
        email TEXT NOT NULL, phone TEXT,
        skills TEXT[], availability TEXT[], languages TEXT[] DEFAULT ARRAY['English'],
        police_check_date DATE, police_check_expiry DATE,
        total_hours DECIMAL(8,2) DEFAULT 0, status TEXT DEFAULT 'active'
          CHECK (status IN ('active','on_hold','inactive')),
        notes TEXT, created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
  } finally {
    client.release();
  }
}

export async function GET(req: NextRequest): Promise<Response> {
  const auth = await requireAdmin(req);
  if (auth) return auth;
  await ensureTables();

  const pool = getPool();
  const client = await pool.connect();
  try {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];

    const [donors, donationsMtd, activeCampaigns, volunteers, taxPending] = await Promise.all([
      client.query('SELECT COUNT(*) as total, SUM(total_donated) as total_all_time FROM np_donor'),
      client.query('SELECT COUNT(*) as count, SUM(amount) as total FROM np_donation WHERE donation_date >= $1', [monthStart]),
      client.query(`SELECT id, name, goal_amount, total_raised, donor_count, end_date,
        CASE WHEN goal_amount > 0 THEN ROUND(total_raised / goal_amount * 100, 1) ELSE 0 END as progress_pct
        FROM np_campaign WHERE status = 'active' ORDER BY end_date`),
      client.query(`SELECT COUNT(*) as active FROM np_volunteer WHERE status = 'active';`),
      client.query(`SELECT COUNT(*) as pending FROM np_donation
        WHERE tax_receipt_required IS TRUE AND tax_receipt_issued = false`),
    ]);

    return NextResponse.json({
      total_donors: Number(donors.rows[0].total),
      total_donated_all_time: Number(donors.rows[0].total_all_time ?? 0),
      donations_mtd_count: Number(donationsMtd.rows[0].count),
      donations_mtd_total: Number(donationsMtd.rows[0].total ?? 0),
      active_campaigns: activeCampaigns.rows,
      volunteers_active: Number(volunteers.rows[0].active),
      tax_receipts_pending: Number(taxPending.rows[0].pending),
    });
  } finally {
    client.release();
  }
}
