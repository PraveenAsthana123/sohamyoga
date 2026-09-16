import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const category = searchParams.get('category');

  let query = 'SELECT * FROM bot_knowledge_base WHERE is_active=true';
  const params: string[] = [];
  if (category) { query += ' AND category=$1'; params.push(category); }
  query += ' ORDER BY usage_count DESC, created_at DESC LIMIT 200';

  try {
    const result = await pool.query(query, params);
    return NextResponse.json({ items: result.rows });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { category, question, answer, keywords } = body;
    const result = await pool.query(
      `INSERT INTO bot_knowledge_base (category, question, answer, keywords)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [category, question, answer, keywords ?? '']
    );
    return NextResponse.json({ item: result.rows[0] }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
