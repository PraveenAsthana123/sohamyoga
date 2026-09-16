import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<Response> {
  const auth = await requireAdmin(req);
  if (auth) return auth;

  const { searchParams } = new URL(req.url);
  const issued = searchParams.get('issued') === 'true';

  const pool = getPool();
  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      `SELECT d.*, CONCAT(dn.first_name, ' ', dn.last_name) as donor_name,
        dn.email as donor_email, dn.address, dn.city, dn.province, dn.postal_code,
        c.name as campaign_name
       FROM np_donation d
       LEFT JOIN np_donor dn ON dn.id = d.donor_id
       LEFT JOIN np_campaign c ON c.id = d.campaign_id
       WHERE d.tax_receipt_required = true
         AND d.tax_receipt_issued = $1
       ORDER BY d.donation_date DESC`,
      [issued]
    );
    return NextResponse.json({ receipts: rows, count: rows.length });
  } finally {
    client.release();
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const auth = await requireAdmin(req);
  if (auth) return auth;

  // Batch issue tax receipts for a date range
  const body = await req.json();
  const { date_from, date_to } = body;

  if (!date_from || !date_to) {
    return NextResponse.json({ error: 'date_from and date_to required' }, { status: 400 });
  }

  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const today = new Date().toISOString().split('T')[0];

    // Find donations needing receipts in range
    const { rows: pending } = await client.query(
      `SELECT id FROM np_donation
       WHERE tax_receipt_required = true
         AND tax_receipt_issued = false
         AND donation_date BETWEEN $1 AND $2`,
      [date_from, date_to]
    );

    let issued = 0;
    for (const d of pending) {
      const receiptNum = `TR-${new Date().getFullYear()}-${String(d.id).padStart(6, '0')}`;
      await client.query(
        `UPDATE np_donation SET
          tax_receipt_issued = true,
          tax_receipt_date = $1,
          tax_receipt_number = COALESCE(tax_receipt_number, $2)
         WHERE id = $3`,
        [today, receiptNum, d.id]
      );
      issued++;
    }

    await client.query('COMMIT');
    return NextResponse.json({ issued, date_from, date_to });
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}
