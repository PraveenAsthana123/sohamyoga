import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'SPA';
  for (let i = 0; i < 5; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const { searchParams } = new URL(req.url);
  const active = searchParams.get('active');
  try {
    const pool = getPool();
    const client = await pool.connect();
    try {
      const { rows } = await client.query(`
        SELECT * FROM spa_gift_card
        WHERE ($1::boolean IS NULL OR is_active=$1::boolean)
        ORDER BY created_at DESC
      `, [active !== null ? active === 'true' : null]);
      return Response.json(rows);
    } finally { client.release(); }
  } catch (e: unknown) { return Response.json({ error: String(e) }, { status: 500 }); }
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    const body = await req.json();
    const pool = getPool();
    const client = await pool.connect();
    try {
      let code = generateCode();
      // Ensure uniqueness
      let attempts = 0;
      while (attempts < 10) {
        const { rows } = await client.query(`SELECT id FROM spa_gift_card WHERE code=$1`, [code]);
        if (!rows.length) break;
        code = generateCode();
        attempts++;
      }
      const amount = parseFloat(body.amount);
      const expiryDate = body.expiry_date || null;
      const { rows } = await client.query(`
        INSERT INTO spa_gift_card (code, purchaser_name, purchaser_email, recipient_name, recipient_email, initial_amount, remaining_balance, expiry_date)
        VALUES ($1,$2,$3,$4,$5,$6,$6,$7) RETURNING *
      `, [code, body.purchaser_name || null, body.purchaser_email || null, body.recipient_name || null, body.recipient_email || null, amount, expiryDate]);
      return Response.json(rows[0], { status: 201 });
    } finally { client.release(); }
  } catch (e: unknown) { return Response.json({ error: String(e) }, { status: 500 }); }
}
