export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { pool } from '@/lib/db';
import { requireAdmin } from '@/lib/admin-auth';

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status');
  const q = searchParams.get('q');

  const client = await pool.connect();
  try {
    const where: string[] = [];
    const params: unknown[] = [];
    let i = 1;
    if (status) { where.push(`lc.status=$${i++}`); params.push(status); }
    if (q) { where.push(`(lc.name ILIKE $${i++} OR lc.email ILIKE $${i - 1})`); params.push(`%${q}%`); }

    const wStr = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const rows = await client.query(`
      SELECT lc.*, COUNT(lm.id) AS matter_count
      FROM legal_client lc
      LEFT JOIN legal_matter lm ON lm.client_id = lc.id
      ${wStr}
      GROUP BY lc.id
      ORDER BY lc.created_at DESC LIMIT 200
    `, params);

    return Response.json({ clients: rows.rows });
  } finally {
    client.release();
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const client = await pool.connect();
  try {
    const body = await req.json();
    const { name, email, phone, company_name, city, province, matter_type, status,
      conflict_checked, retainer, retainer_balance, hourly_rate, source, referred_by, notes } = body;

    if (!name || !matter_type) return Response.json({ error: 'name and matter_type required' }, { status: 400 });

    const r = await client.query(`
      INSERT INTO legal_client (name, email, phone, company_name, city, province, matter_type, status,
        conflict_checked, retainer_amount, retainer_balance, hourly_rate, source, referred_by, notes)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *
    `, [name, email, phone, company_name, city || 'Calgary', province || 'AB', matter_type,
        status || 'active', conflict_checked || false, retainer || 0, retainer_balance || 0,
        hourly_rate || 350, source, referred_by, notes]);

    return Response.json({ client: r.rows[0] }, { status: 201 });
  } finally {
    client.release();
  }
}
