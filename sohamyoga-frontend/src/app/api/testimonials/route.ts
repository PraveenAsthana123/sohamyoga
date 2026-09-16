export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { pool } from '@/lib/db';
import { requireAdmin } from '@/lib/admin-auth';

const CREATE_TABLE = `
  CREATE TABLE IF NOT EXISTS testimonial (
    id             SERIAL PRIMARY KEY,
    author_name    TEXT NOT NULL,
    author_role    TEXT,
    author_company TEXT,
    content        TEXT NOT NULL,
    rating         INT CHECK (rating BETWEEN 1 AND 5),
    is_featured    BOOLEAN DEFAULT false,
    is_active      BOOLEAN DEFAULT true,
    sort_order     INT DEFAULT 0,
    created_at     TIMESTAMPTZ DEFAULT NOW(),
    updated_at     TIMESTAMPTZ DEFAULT NOW()
  )
`;

export async function GET(): Promise<Response> {
  const client = await pool.connect();
  try {
    await client.query(CREATE_TABLE);
    const { rows } = await client.query(
      `SELECT id, author_name, author_role, author_company, content, rating,
              is_featured, is_active, sort_order, created_at, updated_at
       FROM testimonial
       WHERE is_active = true
       ORDER BY is_featured DESC, sort_order ASC, created_at DESC`
    );
    return Response.json(rows);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return Response.json({ error: message }, { status: 500 });
  } finally {
    client.release();
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const client = await pool.connect();
  try {
    await client.query(CREATE_TABLE);
    const body = await req.json() as {
      author_name: string;
      author_role?: string;
      author_company?: string;
      content: string;
      rating?: number;
      is_featured?: boolean;
      sort_order?: number;
    };
    const { author_name, author_role, author_company, content, rating, is_featured = false, sort_order = 0 } = body;

    const { rows } = await client.query(
      `INSERT INTO testimonial (author_name, author_role, author_company, content, rating, is_featured, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [author_name, author_role ?? null, author_company ?? null, content, rating ?? null, is_featured, sort_order]
    );
    return Response.json(rows[0], { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return Response.json({ error: message }, { status: 500 });
  } finally {
    client.release();
  }
}
