import { NextRequest } from 'next/server';
import { pool } from '@/lib/db';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const { searchParams } = new URL(req.url);
  const category = searchParams.get('category') || '';

  const whereClause = category ? `WHERE category = $1` : '';
  const params = category ? [category] : [];

  const result = await pool.query(
    `SELECT id, question, answer, category, sort_order, published, views, helpful_yes, helpful_no, created_at, updated_at
     FROM faq
     ${whereClause}
     ORDER BY category, sort_order ASC`,
    params,
  );

  const counts = await pool.query(
    `SELECT category, COUNT(*)::int AS total, SUM(CASE WHEN published THEN 1 ELSE 0 END)::int AS published_count
     FROM faq GROUP BY category`,
  );

  const totalResult = await pool.query(`SELECT COUNT(*)::int AS total FROM faq`);

  return Response.json({
    faqs: result.rows,
    counts: counts.rows,
    total: totalResult.rows[0]?.total ?? 0,
  });
}

export async function POST(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const body = (await req.json()) as {
    question?: string;
    answer?: string;
    category?: string;
    sort_order?: number;
    published?: boolean;
  };

  const { question, answer, category = 'general', sort_order = 0, published = false } = body;

  if (!question?.trim() || !answer?.trim()) {
    return Response.json({ error: 'question and answer are required' }, { status: 400 });
  }

  const validCategories = ['general', 'class', 'membership', 'payment', 'ai_feature'];
  if (!validCategories.includes(category)) {
    return Response.json({ error: `category must be one of: ${validCategories.join(', ')}` }, { status: 400 });
  }

  const result = await pool.query(
    `INSERT INTO faq (question, answer, category, sort_order, published)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [question.trim(), answer.trim(), category, sort_order, published],
  );

  return Response.json({ faq: result.rows[0] }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const body = (await req.json()) as {
    id?: number;
    question?: string;
    answer?: string;
    category?: string;
    sort_order?: number;
    published?: boolean;
  };

  const { id, ...fields } = body;

  if (!id) {
    return Response.json({ error: 'id is required' }, { status: 400 });
  }

  const allowedFields = ['question', 'answer', 'category', 'sort_order', 'published'];
  const updates: string[] = [];
  const values: unknown[] = [];

  for (const [key, value] of Object.entries(fields)) {
    if (allowedFields.includes(key) && value !== undefined) {
      updates.push(`${key} = $${values.length + 1}`);
      values.push(value);
    }
  }

  if (updates.length === 0) {
    return Response.json({ error: 'No valid fields to update' }, { status: 400 });
  }

  updates.push(`updated_at = NOW()`);
  values.push(id);

  const result = await pool.query(
    `UPDATE faq SET ${updates.join(', ')} WHERE id = $${values.length} RETURNING *`,
    values,
  );

  if (result.rowCount === 0) {
    return Response.json({ error: 'FAQ not found' }, { status: 404 });
  }

  return Response.json({ faq: result.rows[0] });
}

export async function DELETE(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');

  if (!id) {
    return Response.json({ error: 'id query param is required' }, { status: 400 });
  }

  const result = await pool.query(`DELETE FROM faq WHERE id = $1 RETURNING id`, [parseInt(id)]);

  if (result.rowCount === 0) {
    return Response.json({ error: 'FAQ not found' }, { status: 404 });
  }

  return Response.json({ deleted: true, id: parseInt(id) });
}
