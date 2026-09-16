export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { databaseConfigured, getPool } from '@/lib/postgres';

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req); if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DB not configured' }, { status: 503 });
  const pool = getPool(); const client = await pool.connect();
  try {
    const url = new URL(req.url);
    const sequenceId = url.searchParams.get('sequence_id');
    const where = sequenceId ? 'WHERE c.sequence_id=$1' : '';
    const params = sequenceId ? [sequenceId] : [];
    const { rows } = await client.query(
      `SELECT c.*, s.name AS sequence_name FROM outbound_contacts c
       LEFT JOIN outbound_sequences s ON s.id=c.sequence_id
       ${where} ORDER BY c.created_at DESC LIMIT 200`, params
    );
    return Response.json({ contacts: rows });
  } finally { client.release(); }
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req); if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DB not configured' }, { status: 503 });
  const pool = getPool(); const client = await pool.connect();
  try {
    const b = await req.json().catch(() => null);
    if (!b) return Response.json({ error: 'Invalid body' }, { status: 400 });
    // Support bulk import (array) or single
    const items: Array<{ name: string; email: string; company?: string; sequence_id?: number }> = Array.isArray(b) ? b : [b];
    if (!items.length || !items[0].name || !items[0].email) return Response.json({ error: 'name and email required' }, { status: 400 });
    const inserted = [];
    for (const item of items) {
      const { rows } = await client.query(
        `INSERT INTO outbound_contacts (name,email,company,sequence_id,step_index,status) VALUES ($1,$2,$3,$4,0,'active') RETURNING *`,
        [item.name, item.email, item.company || null, item.sequence_id || null]
      );
      inserted.push(rows[0]);
    }
    return Response.json({ contacts: inserted, count: inserted.length }, { status: 201 });
  } finally { client.release(); }
}
