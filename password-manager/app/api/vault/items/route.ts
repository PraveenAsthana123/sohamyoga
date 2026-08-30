import { NextRequest } from 'next/server';
import { query } from '@/lib/postgres';
import { getUserIdFromSession } from '@/lib/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET/POST — the server only ever handles ciphertext+iv here. It cannot read,
// search, or validate the contents of any vault item.
export async function GET(req: NextRequest) {
  const userId = await getUserIdFromSession(req);
  if (!userId) return Response.json({ error: 'Not authenticated.' }, { status: 401 });

  const rows = await query<{ id: string; ciphertext: string; iv: string; created_at: string; updated_at: string }>(
    `SELECT id, ciphertext, iv, created_at, updated_at FROM vault_item WHERE owner_id = $1 ORDER BY created_at DESC`,
    [userId],
  );
  return Response.json({ items: rows.rows.map(r => ({ id: r.id, ciphertext: r.ciphertext, iv: r.iv, createdAt: r.created_at, updatedAt: r.updated_at })) });
}

export async function POST(req: NextRequest) {
  const userId = await getUserIdFromSession(req);
  if (!userId) return Response.json({ error: 'Not authenticated.' }, { status: 401 });

  const body = await req.json().catch(() => null) as { ciphertext?: string; iv?: string } | null;
  if (!body?.ciphertext || !body.iv) return Response.json({ error: 'ciphertext and iv are required.' }, { status: 400 });

  const result = await query<{ id: string }>(
    `INSERT INTO vault_item (owner_id, ciphertext, iv) VALUES ($1,$2,$3) RETURNING id`,
    [userId, body.ciphertext, body.iv],
  );
  return Response.json({ ok: true, id: result.rows[0].id }, { status: 201 });
}
