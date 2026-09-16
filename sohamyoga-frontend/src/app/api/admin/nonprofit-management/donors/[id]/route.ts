import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const auth = await requireAdmin(req);
  if (auth) return auth;

  const pool = getPool();
  const client = await pool.connect();
  try {
    const { rows: donors } = await client.query('SELECT * FROM np_donor WHERE id = $1', [params.id]);
    if (!donors.length) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const { rows: donations } = await client.query(
      `SELECT d.*, c.name as campaign_name FROM np_donation d
       LEFT JOIN np_campaign c ON c.id = d.campaign_id
       WHERE d.donor_id = $1 ORDER BY d.donation_date DESC`,
      [params.id]
    );

    return NextResponse.json({ donor: donors[0], donations });
  } finally {
    client.release();
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const auth = await requireAdmin(req);
  if (auth) return auth;

  const body = await req.json();
  const fields = ['first_name','last_name','email','phone','address','city','province','postal_code',
    'donor_type','giving_level','preferred_cause','communication_preference','tax_receipt_required',
    'employer','employer_matching','notes'];

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

  const pool = getPool();
  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      `UPDATE np_donor SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );
    if (!rows.length) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ donor: rows[0] });
  } finally {
    client.release();
  }
}
