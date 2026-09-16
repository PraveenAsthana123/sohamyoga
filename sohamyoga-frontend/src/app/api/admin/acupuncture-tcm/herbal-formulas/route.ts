import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<Response> {
  const authRes = await requireAdmin(req);
  if (authRes) return authRes;
  const pool = getPool();
  const client = await pool.connect();
  try {
    const { searchParams } = new URL(req.url);
    const category = searchParams.get('category');
    const vals: unknown[] = [];
    const where = category ? `WHERE category = $1` : '';
    if (category) vals.push(category);
    const { rows } = await client.query(`SELECT * FROM tcm_herbal_formula ${where} ORDER BY formula_name ASC`, vals);
    return Response.json(rows);
  } finally { client.release(); }
}

export async function POST(req: NextRequest): Promise<Response> {
  const authRes = await requireAdmin(req);
  if (authRes) return authRes;
  const pool = getPool();
  const client = await pool.connect();
  try {
    const b = await req.json();
    const { rows } = await client.query(
      `INSERT INTO tcm_herbal_formula (formula_name, formula_name_chinese, category, indications, contraindications, ingredients, preparation, dosage, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [b.formula_name, b.formula_name_chinese || null, b.category || null, b.indications || null, b.contraindications || null, b.ingredients ? JSON.stringify(b.ingredients) : null, b.preparation || 'decoction', b.dosage || null, b.notes || null]
    );
    return Response.json(rows[0], { status: 201 });
  } finally { client.release(); }
}
