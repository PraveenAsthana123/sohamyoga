import { NextRequest } from 'next/server';
import { getAdminPrincipal } from '@/lib/admin-auth';
import { databaseConfigured, query } from '@/lib/postgres';

export const dynamic = 'force-dynamic';

async function access(req: NextRequest) {
  const auth = await getAdminPrincipal(req);
  if (auth.denied) return auth;
  if (!databaseConfigured()) return { denied: Response.json({ error: 'Database unavailable.' }, { status: 503 }) };
  return auth;
}

export async function GET(req: NextRequest) {
  const auth = await access(req);
  if (auth.denied) return auth.denied;

  const campaigns = await query(`SELECT * FROM affiliate_campaign ORDER BY created_at DESC`);
  return Response.json({ campaigns: campaigns.rows });
}

export async function POST(req: NextRequest) {
  const auth = await access(req);
  if (auth.denied) return auth.denied;

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') return Response.json({ error: 'Invalid request.' }, { status: 400 });

  if (body.action === 'delete') {
    if (!body.id) return Response.json({ error: 'Campaign ID required.' }, { status: 400 });
    await query(`DELETE FROM affiliate_campaign WHERE id = $1`, [body.id]);
    return Response.json({ ok: true });
  }

  if (body.action === 'update') {
    const { id, name, description, bonus_rate_bps, start_date, end_date, min_sale_amount, status } = body;
    if (!id) return Response.json({ error: 'Campaign ID required.' }, { status: 400 });
    const result = await query(
      `UPDATE affiliate_campaign SET name=$2, description=$3, bonus_rate_bps=$4, start_date=$5, end_date=$6, min_sale_amount=$7, status=$8 WHERE id=$1 RETURNING *`,
      [id, name, description || null, bonus_rate_bps || 0, start_date || null, end_date || null, min_sale_amount || 0, status || 'draft']
    );
    return result.rowCount ? Response.json({ ok: true, campaign: result.rows[0] }) : Response.json({ error: 'Not found.' }, { status: 404 });
  }

  // create
  const { name, description, bonus_rate_bps, start_date, end_date, min_sale_amount, status } = body;
  if (!name) return Response.json({ error: 'Campaign name required.' }, { status: 400 });

  const result = await query(
    `INSERT INTO affiliate_campaign (name, description, bonus_rate_bps, start_date, end_date, min_sale_amount, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [name, description || null, bonus_rate_bps || 0, start_date || null, end_date || null, min_sale_amount || 0, status || 'draft']
  );
  return Response.json({ ok: true, campaign: result.rows[0] }, { status: 201 });
}
