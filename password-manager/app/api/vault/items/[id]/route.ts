import { NextRequest } from 'next/server';
import { query } from '@/lib/postgres';
import { getUserIdFromSession } from '@/lib/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const userId = await getUserIdFromSession(req);
  if (!userId) return Response.json({ error: 'Not authenticated.' }, { status: 401 });

  const body = await req.json().catch(() => null) as { ciphertext?: string; iv?: string } | null;
  if (!body?.ciphertext || !body.iv) return Response.json({ error: 'ciphertext and iv are required.' }, { status: 400 });

  const result = await query(
    `UPDATE vault_item SET ciphertext = $3, iv = $4, updated_at = now() WHERE id = $1 AND owner_id = $2`,
    [params.id, userId, body.ciphertext, body.iv],
  );
  if (!result.rowCount) return Response.json({ error: 'Item not found.' }, { status: 404 });
  return Response.json({ ok: true });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const userId = await getUserIdFromSession(req);
  if (!userId) return Response.json({ error: 'Not authenticated.' }, { status: 401 });

  const result = await query(`DELETE FROM vault_item WHERE id = $1 AND owner_id = $2`, [params.id, userId]);
  if (!result.rowCount) return Response.json({ error: 'Item not found.' }, { status: 404 });
  return Response.json({ ok: true });
}
