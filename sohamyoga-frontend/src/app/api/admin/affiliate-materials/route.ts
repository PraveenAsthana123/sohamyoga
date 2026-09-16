import { NextRequest } from 'next/server';
import { getAdminPrincipal } from '@/lib/admin-auth';
import { databaseConfigured, query } from '@/lib/postgres';

export const dynamic = 'force-dynamic';

async function access(req: NextRequest) {
  const auth = await getAdminPrincipal(req);
  if (auth.denied) return auth;
  if (!databaseConfigured()) return { denied: Response.json({ error: 'Database unavailable.' }, { status: 503 }) };
  return auth;
}

export async function GET(req: NextRequest) {
  const auth = await access(req);
  if (auth.denied) return auth.denied;

  const url = new URL(req.url);
  const type = url.searchParams.get('type');
  const platform = url.searchParams.get('platform');

  let sql = `SELECT * FROM affiliate_material WHERE is_active = true`;
  const params: unknown[] = [];
  let i = 1;

  if (type) { sql += ` AND type = $${i++}`; params.push(type); }
  if (platform) { sql += ` AND platform = $${i++}`; params.push(platform); }
  sql += ` ORDER BY created_at DESC`;

  const materials = await query(sql, params);
  return Response.json({ materials: materials.rows });
}

export async function POST(req: NextRequest) {
  const auth = await access(req);
  if (auth.denied) return auth.denied;

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') return Response.json({ error: 'Invalid request.' }, { status: 400 });

  if (body.action === 'download') {
    if (!body.id) return Response.json({ error: 'Material ID required.' }, { status: 400 });
    await query(`UPDATE affiliate_material SET download_count = download_count + 1 WHERE id = $1`, [body.id]);
    return Response.json({ ok: true });
  }

  if (body.action === 'toggle') {
    if (!body.id) return Response.json({ error: 'Material ID required.' }, { status: 400 });
    const result = await query(
      `UPDATE affiliate_material SET is_active = NOT is_active WHERE id = $1 RETURNING is_active`,
      [body.id]
    );
    return result.rowCount ? Response.json({ ok: true, is_active: result.rows[0].is_active }) : Response.json({ error: 'Not found.' }, { status: 404 });
  }

  if (body.action === 'delete') {
    if (!body.id) return Response.json({ error: 'Material ID required.' }, { status: 400 });
    await query(`DELETE FROM affiliate_material WHERE id = $1`, [body.id]);
    return Response.json({ ok: true });
  }

  // create
  const { title, type, format, platform, file_url, copy_text, cta_text, utm_preset } = body;
  if (!title || !type) return Response.json({ error: 'Title and type required.' }, { status: 400 });

  const result = await query(
    `INSERT INTO affiliate_material (title, type, format, platform, file_url, copy_text, cta_text, utm_preset)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [title, type, format || null, platform || null, file_url || null, copy_text || null, cta_text || null, utm_preset || null]
  );
  return Response.json({ ok: true, material: result.rows[0] }, { status: 201 });
}
