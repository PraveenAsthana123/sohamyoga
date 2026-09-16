import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const id = parseInt(params.id, 10);
  if (isNaN(id)) return Response.json({ error: 'Invalid ID.' }, { status: 400 });

  const b = await req.json().catch(() => ({}));

  const pool = getPool();
  const client = await pool.connect();
  try {
    // Get quote
    const quoteRes = await client.query('SELECT * FROM insurance_quote WHERE id = $1', [id]);
    if (!quoteRes.rowCount) return Response.json({ error: 'Quote not found.' }, { status: 404 });
    const q = quoteRes.rows[0];

    // Mark quote accepted
    await client.query(`UPDATE insurance_quote SET status = 'accepted' WHERE id = $1`, [id]);

    // Create policy
    const annual = b.annual_premium ?? q.quoted_premium;
    const monthly = annual ? Number(annual) / 12 : null;

    const policyRes = await client.query(`
      INSERT INTO insurance_policy
        (client_id, policy_type, insurer, coverage_amount, annual_premium, monthly_premium,
         deductible, effective_date, expiry_date, status, coverage_details, notes)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'applied',$10,$11)
      RETURNING *
    `, [
      q.client_id, q.policy_type, q.insurer, q.coverage_amount, annual, monthly,
      q.deductible, b.effective_date || null, b.expiry_date || null,
      JSON.stringify(q.quote_details || {}), `Converted from quote #${id}`,
    ]);

    return Response.json({ policy: policyRes.rows[0] }, { status: 201 });
  } finally {
    client.release();
  }
}
