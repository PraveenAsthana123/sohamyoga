import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const id = parseInt(params.id, 10);
  if (isNaN(id)) return Response.json({ error: 'Invalid ID.' }, { status: 400 });

  const pool = getPool();
  const client = await pool.connect();
  try {
    const [clientRow, policies, quotes, claims] = await Promise.all([
      client.query('SELECT * FROM insurance_client WHERE id = $1', [id]),
      client.query(`
        SELECT p.*, ic.name AS client_name
        FROM insurance_policy p
        JOIN insurance_client ic ON ic.id = p.client_id
        WHERE p.client_id = $1
        ORDER BY p.created_at DESC
      `, [id]),
      client.query('SELECT * FROM insurance_quote WHERE client_id = $1 ORDER BY created_at DESC', [id]),
      client.query(`
        SELECT cl.*, p.policy_type, p.insurer, p.policy_number
        FROM insurance_claim cl
        JOIN insurance_policy p ON p.id = cl.policy_id
        WHERE p.client_id = $1
        ORDER BY cl.created_at DESC
      `, [id]),
    ]);

    if (!clientRow.rowCount) return Response.json({ error: 'Client not found.' }, { status: 404 });

    return Response.json({
      client: clientRow.rows[0],
      policies: policies.rows,
      quotes: quotes.rows,
      claims: claims.rows,
    });
  } finally {
    client.release();
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const id = parseInt(params.id, 10);
  if (isNaN(id)) return Response.json({ error: 'Invalid ID.' }, { status: 400 });

  const b = await req.json().catch(() => null);
  if (!b) return Response.json({ error: 'Invalid request.' }, { status: 400 });

  const pool = getPool();
  const client = await pool.connect();
  try {
    const result = await client.query(`
      UPDATE insurance_client SET
        name = COALESCE($2, name),
        email = COALESCE($3, email),
        phone = COALESCE($4, phone),
        address = COALESCE($5, address),
        city = COALESCE($6, city),
        province = COALESCE($7, province),
        date_of_birth = COALESCE($8, date_of_birth),
        gender = COALESCE($9, gender),
        occupation = COALESCE($10, occupation),
        smoker = COALESCE($11, smoker),
        annual_income = COALESCE($12, annual_income),
        credit_tier = COALESCE($13, credit_tier),
        status = COALESCE($14, status),
        source = COALESCE($15, source),
        broker_notes = COALESCE($16, broker_notes)
      WHERE id = $1
      RETURNING *
    `, [id, b.name, b.email, b.phone, b.address, b.city, b.province,
        b.date_of_birth, b.gender, b.occupation, b.smoker, b.annual_income,
        b.credit_tier, b.status, b.source, b.broker_notes]);

    if (!result.rowCount) return Response.json({ error: 'Client not found.' }, { status: 404 });
    return Response.json({ client: result.rows[0] });
  } finally {
    client.release();
  }
}
