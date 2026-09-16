export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { pool } from '@/lib/db';
import { requireAdmin } from '@/lib/admin-auth';

const CREATE_TABLE = `
  CREATE TABLE IF NOT EXISTS team_member (
    id         SERIAL PRIMARY KEY,
    name       TEXT NOT NULL,
    role       TEXT NOT NULL,
    bio        TEXT,
    image_url  TEXT,
    email      TEXT,
    linkedin_url TEXT,
    sort_order INT DEFAULT 0,
    is_active  BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  )
`;

export async function GET(): Promise<Response> {
  const client = await pool.connect();
  try {
    await client.query(CREATE_TABLE);
    const { rows } = await client.query(
      `SELECT id, name, role, bio, image_url, email, linkedin_url, sort_order, is_active, created_at, updated_at
       FROM team_member
       WHERE is_active = true
       ORDER BY sort_order ASC, name ASC`
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
      name: string;
      role: string;
      bio?: string;
      image_url?: string;
      email?: string;
      linkedin_url?: string;
      sort_order?: number;
    };
    const { name, role, bio, image_url, email, linkedin_url, sort_order = 0 } = body;

    const { rows } = await client.query(
      `INSERT INTO team_member (name, role, bio, image_url, email, linkedin_url, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [name, role, bio ?? null, image_url ?? null, email ?? null, linkedin_url ?? null, sort_order]
    );
    return Response.json(rows[0], { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return Response.json({ error: message }, { status: 500 });
  } finally {
    client.release();
  }
}
