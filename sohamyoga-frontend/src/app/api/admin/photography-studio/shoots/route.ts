import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<Response> {
  try { await requireAdmin(); } catch { return Response.json({ error: 'Unauthorized' }, { status: 401 }); }
  const pool = getPool();
  const client = await pool.connect();
  try {
    const status = req.nextUrl.searchParams.get('status');
    const type = req.nextUrl.searchParams.get('type');
    const month = req.nextUrl.searchParams.get('month'); // YYYY-MM
    const conditions: string[] = [];
    const values: unknown[] = [];
    if (status) { values.push(status); conditions.push(`s.status = $${values.length}`); }
    if (type) { values.push(type); conditions.push(`s.shoot_type = $${values.length}`); }
    if (month) {
      const start = `${month}-01`;
      const end = new Date(parseInt(month.slice(0,4)), parseInt(month.slice(5,7)), 1).toISOString().slice(0,10);
      values.push(start); conditions.push(`s.scheduled_at >= $${values.length}`);
      values.push(end); conditions.push(`s.scheduled_at < $${values.length}`);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const rows = await client.query(
      `SELECT s.*, c.first_name, c.last_name, c.email, c.phone FROM photo_shoot s JOIN photo_client c ON c.id = s.client_id ${where} ORDER BY s.scheduled_at DESC LIMIT 300`,
      values
    );
    return Response.json(rows.rows);
  } finally { client.release(); }
}

export async function POST(req: NextRequest): Promise<Response> {
  try { await requireAdmin(); } catch { return Response.json({ error: 'Unauthorized' }, { status: 401 }); }
  const pool = getPool();
  const client = await pool.connect();
  try {
    const b = await req.json();
    const row = await client.query(
      `INSERT INTO photo_shoot (client_id,shoot_type,title,scheduled_at,location,duration_hours,photographer,second_shooter,package_name,package_price,deposit_amount,balance_due,notes,contract_signed)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
      [b.client_id, b.shoot_type, b.title, b.scheduled_at, b.location, b.duration_hours ?? 2,
       b.photographer, b.second_shooter, b.package_name, b.package_price, b.deposit_amount, b.balance_due, b.notes, b.contract_signed ?? false]
    );
    return Response.json(row.rows[0], { status: 201 });
  } finally { client.release(); }
}
