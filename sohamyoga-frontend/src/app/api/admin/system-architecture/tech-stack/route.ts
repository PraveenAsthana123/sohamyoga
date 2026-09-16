import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export async function GET() {
  try {
    const result = await pool.query(
      'SELECT * FROM tech_stack_entry ORDER BY category, name'
    );
    return NextResponse.json({ entries: result.rows });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      category: string;
      name: string;
      version?: string;
      purpose?: string;
      docs_url?: string;
      is_core?: boolean;
      status?: string;
      notes?: string;
    };
    const result = await pool.query(
      `INSERT INTO tech_stack_entry (category, name, version, purpose, docs_url, is_core, status, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [
        body.category,
        body.name,
        body.version ?? null,
        body.purpose ?? null,
        body.docs_url ?? null,
        body.is_core ?? false,
        body.status ?? 'active',
        body.notes ?? null,
      ]
    );
    return NextResponse.json({ entry: result.rows[0] }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
