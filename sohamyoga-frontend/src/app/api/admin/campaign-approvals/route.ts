import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool, databaseConfigured } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function ensureTable(): Promise<void> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS campaign_approvals (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        campaign_name TEXT NOT NULL,
        client_name TEXT NOT NULL,
        client_email TEXT,
        campaign_type TEXT,
        budget_cad NUMERIC(10,2),
        start_date DATE,
        end_date DATE,
        description TEXT,
        assets_url TEXT,
        status TEXT DEFAULT 'pending',
        submitted_by TEXT,
        reviewed_by TEXT,
        review_notes TEXT,
        submitted_at TIMESTAMPTZ DEFAULT NOW(),
        reviewed_at TIMESTAMPTZ
      )
    `);
    const { rows } = await client.query(`SELECT COUNT(*) AS n FROM campaign_approvals`);
    if (parseInt(rows[0].n, 10) === 0) {
      await client.query(`
        INSERT INTO campaign_approvals
          (campaign_name, client_name, client_email, campaign_type, budget_cad, start_date, end_date, description, assets_url, status, submitted_by, reviewed_by, review_notes, submitted_at, reviewed_at)
        VALUES
          ('Fall Retail Social Push', 'Maple Leaf Retail Co.', 'sandra@mapleleafretail.ca', 'social', 5000.00, '2026-10-01', '2026-10-31', 'Multi-platform social campaign for Thanksgiving promotions. Includes IG Reels, Facebook carousels and Pinterest pins.', 'https://drive.google.com/drive/folders/abc123', 'pending', 'jane@agency.ca', NULL, NULL, NOW() - INTERVAL ''3 days'', NULL),
          ('Q3 LinkedIn Thought Leadership', 'Northern Health Solutions', 'afarooq@nhsolutions.ca', 'content', 2800.00, '2026-09-15', '2026-12-15', 'Monthly thought-leadership articles and LinkedIn posts for Dr. Farooq.', 'https://drive.google.com/drive/folders/def456', 'client_reviewing', 'mark@agency.ca', NULL, NULL, NOW() - INTERVAL ''7 days'', NULL),
          ('Paid Search — Brand Keywords', 'Finvest Capital Group', 'rliu@finvestcapital.ca', 'paid_ads', 8000.00, '2026-10-01', '2026-12-31', 'Google Ads brand keyword defense and competitor conquesting.', 'https://drive.google.com/drive/folders/ghi789', 'approved', 'jane@agency.ca', 'rliu@finvestcapital.ca', 'Approved with minor copy changes. Increase ad schedule to Mon-Fri 8am-8pm.', NOW() - INTERVAL ''14 days'', NOW() - INTERVAL ''10 days''),
          ('Email Nurture Sequence', 'BlueSky Tech Inc.', 'jparker@blueskytech.ca', 'email', 1500.00, '2026-09-20', '2026-11-20', '6-part email drip for trial-to-paid conversion. Includes onboarding tips, case studies, and upgrade CTA.', 'https://drive.google.com/drive/folders/jkl012', 'revision_requested', 'sarah@agency.ca', 'jparker@blueskytech.ca', 'Email 3 and 4 need revised tone — too salesy. Also update pricing to reflect new tiers.', NOW() - INTERVAL ''5 days'', NOW() - INTERVAL ''2 days'')
      `);
    }
  } finally {
    client.release();
  }
}

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'Database unavailable.' }, { status: 503 });
  try {
    await ensureTable();
    const pool = getPool();
    const client = await pool.connect();
    try {
      const url = new URL(req.url);
      const status = url.searchParams.get('status');
      let queryText = `SELECT * FROM campaign_approvals`;
      const values: unknown[] = [];
      if (status) {
        queryText += ` WHERE status = $1`;
        values.push(status);
      }
      queryText += ` ORDER BY submitted_at DESC`;
      const { rows } = await client.query(queryText, values);
      return Response.json({ approvals: rows });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('campaign-approvals GET error:', err);
    return Response.json({ error: 'Failed to fetch campaign approvals.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'Database unavailable.' }, { status: 503 });
  try {
    await ensureTable();
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') return Response.json({ error: 'Invalid request body.' }, { status: 400 });
    const {
      campaign_name, client_name, client_email, campaign_type, budget_cad,
      start_date, end_date, description, assets_url, submitted_by,
    } = body;
    if (!campaign_name?.trim() || !client_name?.trim()) {
      return Response.json({ error: 'campaign_name and client_name are required.' }, { status: 400 });
    }
    const pool = getPool();
    const client = await pool.connect();
    try {
      const { rows } = await client.query(
        `INSERT INTO campaign_approvals
           (campaign_name, client_name, client_email, campaign_type, budget_cad,
            start_date, end_date, description, assets_url, status, submitted_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'pending',$10)
         RETURNING *`,
        [
          campaign_name.trim(), client_name.trim(), client_email || null,
          campaign_type || null, budget_cad || null, start_date || null,
          end_date || null, description || null, assets_url || null,
          submitted_by || null,
        ]
      );
      return Response.json({ approval: rows[0] }, { status: 201 });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('campaign-approvals POST error:', err);
    return Response.json({ error: 'Failed to create campaign approval.' }, { status: 500 });
  }
}
