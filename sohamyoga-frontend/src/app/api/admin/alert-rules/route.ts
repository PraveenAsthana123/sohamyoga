import { NextRequest } from 'next/server';
import { pool } from '@/lib/db';

import { requireAdmin } from '@/lib/admin-auth';
export async function GET(req: NextRequest) {

  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    const result = await pool.query('SELECT * FROM alert_rule ORDER BY severity DESC, created_at DESC');
    return Response.json({ rules: result.rows });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {

  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    const body = await req.json();
    const { name, category, condition_config, channels, severity, cooldown_minutes } = body;
    const result = await pool.query(
      `INSERT INTO alert_rule (name, category, condition_config, channels, severity, cooldown_minutes)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [name, category, JSON.stringify(condition_config ?? {}), channels, severity ?? 'medium', cooldown_minutes ?? 60]
    );
    return Response.json({ rule: result.rows[0] }, { status: 201 });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {

  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    const body = await req.json();
    const { id, is_active, name, severity } = body;
    const result = await pool.query(
      `UPDATE alert_rule SET
        is_active=COALESCE($2,is_active),
        name=COALESCE($3,name),
        severity=COALESCE($4,severity)
       WHERE id=$1 RETURNING *`,
      [id, is_active, name, severity]
    );
    return Response.json({ rule: result.rows[0] });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {

  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    await pool.query('DELETE FROM alert_rule WHERE id=$1', [id]);
    return Response.json({ ok: true });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : 'Internal server error' }, { status: 500 });
  }
}
