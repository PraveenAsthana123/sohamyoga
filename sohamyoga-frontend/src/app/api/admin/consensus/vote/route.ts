import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { pool } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const body = await req.json() as { item_id: number; voter_name: string; option_id: string };
  if (!body.item_id || !body.voter_name || !body.option_id) {
    return Response.json({ error: 'item_id, voter_name and option_id are required' }, { status: 400 });
  }

  const client = await pool.connect();
  try {
    // Fetch current votes
    const row = await client.query(
      `SELECT votes FROM consensus_item WHERE id = $1`,
      [body.item_id],
    ).catch(() => ({ rows: [] as { votes: Record<string, string> }[] }));

    if (!row.rows.length) return Response.json({ error: 'Item not found' }, { status: 404 });

    const currentVotes = (row.rows[0].votes as Record<string, string>) ?? {};
    const updatedVotes = { ...currentVotes, [body.voter_name]: body.option_id };

    const result = await client.query(
      `UPDATE consensus_item
       SET votes = $2::jsonb,
           status = CASE WHEN status = 'open' THEN 'voting' ELSE status END
       WHERE id = $1
       RETURNING *`,
      [body.item_id, JSON.stringify(updatedVotes)],
    );

    return Response.json({ item: result.rows[0] });
  } finally {
    client.release();
  }
}
