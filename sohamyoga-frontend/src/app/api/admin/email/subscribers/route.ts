import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { query } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const { searchParams } = new URL(req.url);
  const search = searchParams.get('search') ?? '';
  const status = searchParams.get('status') ?? '';
  const limit = Math.min(Number(searchParams.get('limit') ?? '100'), 500);
  const offset = Number(searchParams.get('offset') ?? '0');

  let whereClause = 'WHERE 1=1';
  const params: (string | number)[] = [];

  if (search) {
    params.push(`%${search}%`);
    whereClause += ` AND (email ILIKE $${params.length} OR first_name ILIKE $${params.length} OR last_name ILIKE $${params.length})`;
  }
  if (status) {
    params.push(status);
    whereClause += ` AND status = $${params.length}`;
  }

  params.push(limit, offset);
  const result = await query(
    `SELECT * FROM email_subscriber ${whereClause} ORDER BY joined_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );

  const countResult = await query(
    `SELECT COUNT(*) AS total FROM email_subscriber ${whereClause}`,
    params.slice(0, params.length - 2),
  );

  return Response.json({ subscribers: result.rows, total: Number(countResult.rows[0].total) });
}

export async function POST(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const body = await req.json().catch(() => null) as Record<string, any> | null;
  if (!body) return Response.json({ error: 'body required' }, { status: 400 });

  if (body.action === 'bulk_import') {
    const rows = body.rows as Array<{ email: string; first_name?: string; last_name?: string; tags?: string[] }> | undefined;
    if (!Array.isArray(rows) || rows.length === 0) {
      return Response.json({ error: 'rows array required for bulk_import' }, { status: 400 });
    }

    let imported = 0, skipped = 0;
    for (const row of rows) {
      if (!row.email?.includes('@')) { skipped++; continue; }
      try {
        await query(
          `INSERT INTO email_subscriber (email, first_name, last_name, tags, source) VALUES ($1,$2,$3,$4,'csv_import') ON CONFLICT (email) DO NOTHING`,
          [row.email.toLowerCase().trim(), row.first_name ?? null, row.last_name ?? null, row.tags ?? []],
        );
        imported++;
      } catch { skipped++; }
    }
    return Response.json({ imported, skipped }, { status: 201 });
  }

  if (!body.email?.includes('@')) {
    return Response.json({ error: 'valid email required' }, { status: 400 });
  }

  try {
    const result = await query(
      `INSERT INTO email_subscriber (email, first_name, last_name, tags, source) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [body.email.toLowerCase().trim(), body.first_name ?? null, body.last_name ?? null, body.tags ?? [], body.source ?? 'admin'],
    );
    return Response.json({ subscriber: result.rows[0] }, { status: 201 });
  } catch (err) {
    if (err instanceof Error && err.message.includes('unique')) {
      return Response.json({ error: 'Email already exists' }, { status: 409 });
    }
    throw err;
  }
}

export async function PATCH(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const body = await req.json().catch(() => null) as Record<string, any> | null;
  if (!body?.id) return Response.json({ error: 'id required' }, { status: 400 });

  const result = await query(
    `UPDATE email_subscriber SET status=$2, first_name=$3, last_name=$4, tags=$5 WHERE id=$1 RETURNING *`,
    [body.id, body.status ?? 'active', body.first_name ?? null, body.last_name ?? null, body.tags ?? []],
  );
  if (!result.rowCount) return Response.json({ error: 'not found' }, { status: 404 });
  return Response.json({ subscriber: result.rows[0] });
}
