import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const pool = getPool();
  const client = await pool.connect();
  try {
    const { searchParams } = new URL(req.url);
    const category = searchParams.get('category');
    const status = searchParams.get('status');
    const search = searchParams.get('search');
    let q = `SELECT * FROM jw_inventory WHERE 1=1`;
    const params: string[] = [];
    if (category) { params.push(category); q += ` AND category = $${params.length}`; }
    if (status) { params.push(status); q += ` AND status = $${params.length}`; }
    if (search) { params.push(`%${search}%`); q += ` AND (name ILIKE $${params.length} OR sku ILIKE $${params.length} OR gemstone_type ILIKE $${params.length})`; }
    q += ` ORDER BY created_at DESC`;
    const { rows } = await client.query(q, params);
    return Response.json(rows);
  } finally {
    client.release();
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const pool = getPool();
  const client = await pool.connect();
  try {
    const body = await req.json();
    const { sku, name, category, metal_type, metal_purity, gemstone_type, gemstone_cert_lab, cost_price, retail_price, appraisal_value, appraisal_date, notes } = body;
    if (!name) return Response.json({ error: 'name is required' }, { status: 400 });
    const { rows } = await client.query(
      `INSERT INTO jw_inventory (sku, name, category, metal_type, metal_purity, gemstone_type, gemstone_cert_lab, cost_price, retail_price, appraisal_value, appraisal_date, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [sku, name, category, metal_type, metal_purity, gemstone_type, gemstone_cert_lab, cost_price, retail_price, appraisal_value, appraisal_date || null, notes]
    );
    return Response.json(rows[0], { status: 201 });
  } finally {
    client.release();
  }
}
