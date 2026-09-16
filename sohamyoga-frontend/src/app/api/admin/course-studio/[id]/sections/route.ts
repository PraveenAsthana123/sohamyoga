import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    const pool = getPool();
    const { rows } = await pool.query(
      `SELECT cs.*, COUNT(cl.id)::int AS lesson_count
       FROM course_sections cs
       LEFT JOIN course_lessons cl ON cl.section_id = cs.id
       WHERE cs.course_id=$1
       GROUP BY cs.id
       ORDER BY cs.order_index ASC`,
      [params.id]
    );
    return Response.json({ sections: rows });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    const pool = getPool();
    const body = await req.json() as { title: string; description?: string; order_index?: number };
    if (!body.title?.trim()) return Response.json({ error: 'Title is required' }, { status: 400 });

    // Auto-increment order_index if not provided
    let orderIndex = body.order_index;
    if (orderIndex === undefined) {
      const { rows: maxRow } = await pool.query(
        `SELECT COALESCE(MAX(order_index), -1)::int AS max_idx FROM course_sections WHERE course_id=$1`,
        [params.id]
      );
      orderIndex = (maxRow[0]?.max_idx ?? -1) + 1;
    }

    const { rows } = await pool.query(`
      INSERT INTO course_sections (course_id, title, description, order_index)
      VALUES ($1,$2,$3,$4)
      RETURNING *
    `, [params.id, body.title, body.description ?? null, orderIndex]);
    return Response.json({ section: rows[0] }, { status: 201 });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
