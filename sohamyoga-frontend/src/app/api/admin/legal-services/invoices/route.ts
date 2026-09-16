export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { pool } from '@/lib/db';
import { requireAdmin } from '@/lib/admin-auth';

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const client = await pool.connect();
  try {
    const body = await req.json();
    const { matter_id, entry_ids } = body;

    if (!matter_id && (!entry_ids || entry_ids.length === 0)) {
      return Response.json({ error: 'matter_id or entry_ids required' }, { status: 400 });
    }

    // Mark specified entries (or all unbilled for matter) as billed
    let invoicedEntries;
    if (entry_ids && entry_ids.length > 0) {
      invoicedEntries = await client.query(`
        UPDATE legal_time_entry SET billed = true, invoiced_at = NOW()
        WHERE id = ANY($1::int[]) AND billed = false
        RETURNING *
      `, [entry_ids]);
    } else {
      invoicedEntries = await client.query(`
        UPDATE legal_time_entry SET billed = true, invoiced_at = NOW()
        WHERE matter_id = $1 AND billed = false
        RETURNING *
      `, [matter_id]);
    }

    if (invoicedEntries.rows.length === 0) {
      return Response.json({ error: 'No unbilled entries found' }, { status: 400 });
    }

    const total = invoicedEntries.rows.reduce((sum, e) => sum + (Number(e.hours) * Number(e.rate || 0)), 0);
    const matter = matter_id ? await client.query(`SELECT matter_number, title FROM legal_matter WHERE id = $1`, [matter_id]) : { rows: [{}] };

    return Response.json({
      invoice: {
        matter_id,
        matter_number: matter.rows[0]?.matter_number,
        matter_title: matter.rows[0]?.title,
        entries_count: invoicedEntries.rows.length,
        total_amount: total.toFixed(2),
        invoiced_at: new Date().toISOString(),
        entries: invoicedEntries.rows,
      }
    }, { status: 201 });
  } finally {
    client.release();
  }
}
