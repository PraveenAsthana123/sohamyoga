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
  const status = url.searchParams.get('status');
  const severity = url.searchParams.get('severity');

  let sql = `
    SELECT f.*, p.name AS partner_name, p.email AS partner_email
    FROM affiliate_fraud_flag f
    LEFT JOIN affiliate_partner p ON p.id = f.partner_id
    WHERE 1=1
  `;
  const params: unknown[] = [];
  let i = 1;

  if (status) { sql += ` AND f.status = $${i++}`; params.push(status); }
  if (severity) { sql += ` AND f.severity = $${i++}`; params.push(severity); }
  sql += ` ORDER BY f.created_at DESC LIMIT 200`;

  const flags = await query(sql, params);

  const summary = await query(`
    SELECT
      COUNT(*) FILTER (WHERE status='open') AS open_count,
      COUNT(*) FILTER (WHERE severity='high' AND status='open') AS high_severity_open,
      COUNT(*) FILTER (WHERE status='actioned') AS actioned_count,
      COUNT(*) AS total_count
    FROM affiliate_fraud_flag
  `);

  return Response.json({ flags: flags.rows, summary: summary.rows[0] ?? {} });
}

export async function POST(req: NextRequest) {
  const auth = await access(req);
  if (auth.denied) return auth.denied;

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') return Response.json({ error: 'Invalid request.' }, { status: 400 });

  if (body.action === 'review') {
    if (!body.id || !body.status) return Response.json({ error: 'Flag ID and status required.' }, { status: 400 });
    if (!['reviewed', 'dismissed', 'actioned'].includes(body.status)) {
      return Response.json({ error: 'Invalid status.' }, { status: 400 });
    }

    const result = await query(
      `UPDATE affiliate_fraud_flag SET status = $2, reviewed_by = $3 WHERE id = $1 RETURNING *`,
      [body.id, body.status, auth.principal?.email || 'admin']
    );

    // If actioned and partner_id present, optionally suspend partner
    if (body.status === 'actioned' && body.suspend_partner && result.rows[0]?.partner_id) {
      await query(
        `UPDATE affiliate_partner SET status = 'suspended', updated_at = NOW() WHERE id = $1`,
        [result.rows[0].partner_id]
      );
    }

    return result.rowCount ? Response.json({ ok: true, flag: result.rows[0] }) : Response.json({ error: 'Not found.' }, { status: 404 });
  }

  if (body.action === 'create_flag') {
    const { partner_id, flag_type, detail, severity } = body;
    if (!partner_id || !flag_type) return Response.json({ error: 'Partner ID and flag type required.' }, { status: 400 });
    const result = await query(
      `INSERT INTO affiliate_fraud_flag (partner_id, flag_type, detail, severity) VALUES ($1,$2,$3,$4) RETURNING *`,
      [partner_id, flag_type, JSON.stringify(detail || {}), severity || 'medium']
    );
    return Response.json({ ok: true, flag: result.rows[0] }, { status: 201 });
  }

  return Response.json({ error: 'Unknown action.' }, { status: 400 });
}
