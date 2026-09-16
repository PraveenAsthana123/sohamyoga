import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<Response> {
  const auth = await requireAdmin(req);
  if (auth) return auth;

  const { searchParams } = new URL(req.url);
  const campaign_id = searchParams.get('campaign_id');
  const fund = searchParams.get('fund');
  const date_from = searchParams.get('date_from');
  const date_to = searchParams.get('date_to');
  const tax_pending = searchParams.get('tax_pending');

  const pool = getPool();
  const client = await pool.connect();
  try {
    const conditions: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (campaign_id) { conditions.push(`d.campaign_id = $${idx++}`); values.push(campaign_id); }
    if (fund) { conditions.push(`d.fund = $${idx++}`); values.push(fund); }
    if (date_from) { conditions.push(`d.donation_date >= $${idx++}`); values.push(date_from); }
    if (date_to) { conditions.push(`d.donation_date <= $${idx++}`); values.push(date_to); }
    if (tax_pending === 'true') {
      conditions.push(`d.tax_receipt_required = true AND d.tax_receipt_issued = false`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const { rows } = await client.query(
      `SELECT d.*, CONCAT(dn.first_name, ' ', dn.last_name) as donor_name, dn.email as donor_email,
        c.name as campaign_name
       FROM np_donation d
       LEFT JOIN np_donor dn ON dn.id = d.donor_id
       LEFT JOIN np_campaign c ON c.id = d.campaign_id
       ${where}
       ORDER BY d.donation_date DESC, d.created_at DESC`,
      values
    );
    return NextResponse.json({ donations: rows });
  } finally {
    client.release();
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const auth = await requireAdmin(req);
  if (auth) return auth;

  const body = await req.json();
  const {
    donor_id, amount, donation_date, campaign_id, fund = 'general', payment_method,
    in_kind_description, in_kind_fair_value, recurring = false, recurring_frequency,
    anonymous = false, notes,
  } = body;

  if (!donor_id || !amount) {
    return NextResponse.json({ error: 'donor_id and amount required' }, { status: 400 });
  }

  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Get donor tax_receipt_required flag
    const { rows: donorRows } = await client.query(
      'SELECT tax_receipt_required, first_donation_date FROM np_donor WHERE id = $1', [donor_id]
    );
    if (!donorRows.length) { await client.query('ROLLBACK'); return NextResponse.json({ error: 'Donor not found' }, { status: 404 }); }

    const donationDateVal = donation_date || new Date().toISOString().split('T')[0];

    const { rows } = await client.query(
      `INSERT INTO np_donation (donor_id, amount, donation_date, campaign_id, fund, payment_method,
        in_kind_description, in_kind_fair_value, recurring, recurring_frequency, anonymous, notes,
        tax_receipt_required)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
      [donor_id, amount, donationDateVal, campaign_id || null, fund, payment_method,
        in_kind_description, in_kind_fair_value, recurring, recurring_frequency || null, anonymous, notes,
        donorRows[0].tax_receipt_required]
    );

    // Update donor total and dates
    const firstDonation = donorRows[0].first_donation_date;
    await client.query(
      `UPDATE np_donor SET
        total_donated = total_donated + $1,
        last_donation_date = $2,
        first_donation_date = COALESCE(first_donation_date, $2)
       WHERE id = $3`,
      [amount, donationDateVal, donor_id]
    );

    // Update campaign if provided
    if (campaign_id) {
      await client.query(
        `UPDATE np_campaign SET
          total_raised = total_raised + $1,
          donor_count = donor_count + 1
         WHERE id = $2`,
        [amount, campaign_id]
      );
    }

    await client.query('COMMIT');
    return NextResponse.json({ donation: rows[0] }, { status: 201 });
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}
