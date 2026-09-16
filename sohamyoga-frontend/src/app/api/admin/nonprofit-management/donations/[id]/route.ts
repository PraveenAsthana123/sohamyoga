import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const auth = await requireAdmin(req);
  if (auth) return auth;

  const body = await req.json();
  const pool = getPool();
  const client = await pool.connect();
  try {
    // Check if this is a tax receipt issuance
    if (body.issue_tax_receipt) {
      const today = new Date().toISOString().split('T')[0];
      // Generate receipt number if not already set
      const receiptNum = `TR-${new Date().getFullYear()}-${String(params.id).padStart(6, '0')}`;
      const { rows } = await client.query(
        `UPDATE np_donation SET
          tax_receipt_issued = true,
          tax_receipt_date = $1,
          tax_receipt_number = COALESCE(tax_receipt_number, $2)
         WHERE id = $3 RETURNING *`,
        [today, receiptNum, params.id]
      );
      if (!rows.length) return NextResponse.json({ error: 'Not found' }, { status: 404 });
      return NextResponse.json({ donation: rows[0] });
    }

    const fields = ['amount','donation_date','campaign_id','fund','payment_method',
      'in_kind_description','in_kind_fair_value','recurring','recurring_frequency',
      'anonymous','tax_receipt_number','notes'];

    const updates: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    for (const f of fields) {
      if (body[f] !== undefined) {
        updates.push(`${f} = $${idx++}`);
        values.push(body[f]);
      }
    }

    if (!updates.length) return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    values.push(params.id);

    const { rows } = await client.query(
      `UPDATE np_donation SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );
    if (!rows.length) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ donation: rows[0] });
  } finally {
    client.release();
  }
}
