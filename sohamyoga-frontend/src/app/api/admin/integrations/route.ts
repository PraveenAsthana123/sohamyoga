import { NextRequest } from 'next/server';
import { pool } from '@/lib/db';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const VALID_STATUSES = ['enabled', 'disabled'];

export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const client = await pool.connect();
  try {
    const [masters, callCounts, scenarios] = await Promise.all([
      client.query<{
        id: string;
        integration_key: string;
        name: string;
        install_status: string;
        config_status: string;
        runtime_status: string;
        endpoint: string | null;
        enabled: boolean;
        requires_credentials: boolean;
        last_checked_at: string | null;
        notes: string | null;
        created_at: string;
        updated_at: string;
      }>(
        `SELECT id, integration_key, name, install_status, config_status, runtime_status,
                endpoint, enabled, requires_credentials, last_checked_at, notes, created_at, updated_at
         FROM integration_master
         ORDER BY name ASC`,
      ),
      client
        .query<{ provider: string; call_count: string; success_count: string; error_count: string }>(
          `SELECT provider,
                  count(*)::text AS call_count,
                  count(*) FILTER (WHERE status = 'success')::text AS success_count,
                  count(*) FILTER (WHERE status = 'error')::text AS error_count
           FROM integration_call
           WHERE created_at >= now() - INTERVAL '30 days'
           GROUP BY provider
           ORDER BY count(*) DESC`,
        )
        .catch(() => ({ rows: [] as { provider: string; call_count: string; success_count: string; error_count: string }[] })),
      client
        .query<{
          scenario_key: string;
          category: string;
          title: string;
          direction: string;
          execution_mode: string;
          status: string;
          created_at: string;
        }>(
          `SELECT scenario_key, category, title, direction, execution_mode, status, created_at
           FROM integration_scenario
           ORDER BY category, title`,
        )
        .catch(() => ({ rows: [] as { scenario_key: string; category: string; title: string; direction: string; execution_mode: string; status: string; created_at: string }[] })),
    ]);

    const total = masters.rows.length;
    const active = masters.rows.filter((r) => r.enabled).length;
    const totalCalls30d = callCounts.rows.reduce((s, r) => s + Number(r.call_count), 0);

    return Response.json({
      integrations: masters.rows,
      callCounts: callCounts.rows,
      scenarios: scenarios.rows,
      summary: {
        total,
        active,
        inactive: total - active,
        calls30d: totalCalls30d,
        scenarios: scenarios.rows.length,
      },
    });
  } finally {
    client.release();
  }
}

export async function PATCH(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const body = await req.json().catch(() => null) as { id?: string; enabled?: boolean } | null;
  if (!body?.id) return Response.json({ error: 'id is required.' }, { status: 400 });
  if (typeof body.enabled !== 'boolean') {
    return Response.json({ error: 'enabled (boolean) is required.' }, { status: 400 });
  }

  const client = await pool.connect();
  try {
    const result = await client.query(
      `UPDATE integration_master SET enabled = $1, updated_at = now() WHERE id = $2 RETURNING id, name, enabled`,
      [body.enabled, body.id],
    );
    if (!result.rowCount) return Response.json({ error: 'Integration not found.' }, { status: 404 });
    return Response.json({ integration: result.rows[0] });
  } finally {
    client.release();
  }
}
