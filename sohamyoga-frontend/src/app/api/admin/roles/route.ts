import { NextRequest } from 'next/server';
import { pool } from '@/lib/db';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  // All roles with permission count
  const rolesResult = await pool.query(`
    SELECT
      r.code,
      r.label,
      r.risk_level,
      r.sort_order,
      COUNT(DISTINCT rp.id)::int AS permission_count,
      COUNT(DISTINCT ira.identity_id)::int AS user_count
    FROM ref_admin_role r
    LEFT JOIN role_permission rp ON rp.role = r.code AND rp.is_active = true
    LEFT JOIN identity_role_assignment ira ON ira.role = r.code AND ira.revoked_at IS NULL
    GROUP BY r.code, r.label, r.risk_level, r.sort_order
    ORDER BY r.sort_order
  `);

  // Permission matrix data
  const permissionsResult = await pool.query(`
    SELECT
      rp.role,
      rp.resource,
      rp.is_active,
      COALESCE(array_agg(rpa.action) FILTER (WHERE rpa.action IS NOT NULL), '{}') AS actions
    FROM role_permission rp
    LEFT JOIN role_permission_action rpa ON rpa.permission_id = rp.id
    GROUP BY rp.role, rp.resource, rp.is_active
    ORDER BY rp.role, rp.resource
  `);

  // Users with roles
  const usersResult = await pool.query(`
    SELECT
      ia.id,
      ia.email,
      ia.status,
      ia.mfa_enabled,
      ia.last_login_at,
      ia.login_failure_count,
      ira.role,
      ira.assigned_at,
      ira.revoked_at
    FROM identity_role_assignment ira
    JOIN identity_account ia ON ia.id = ira.identity_id
    WHERE ira.revoked_at IS NULL
    ORDER BY ira.assigned_at DESC
    LIMIT 100
  `);

  // Active sessions
  const sessionsResult = await pool.query(`
    SELECT
      s.id,
      s.user_id,
      s.user_role,
      s.ip_address,
      s.device_info,
      s.mfa_verified,
      s.created_at,
      s.last_seen_at
    FROM user_session s
    WHERE s.is_active = true AND s.revoked_at IS NULL
    ORDER BY s.last_seen_at DESC
    LIMIT 50
  `);

  return Response.json({
    roles: rolesResult.rows,
    permissions: permissionsResult.rows,
    users: usersResult.rows,
    sessions: sessionsResult.rows,
  });
}

export async function POST(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const body = (await req.json()) as {
    code?: string;
    label?: string;
    risk_level?: number;
    sort_order?: number;
  };

  const { code, label, risk_level = 1, sort_order = 99 } = body;

  if (!code?.trim() || !label?.trim()) {
    return Response.json({ error: 'code and label are required' }, { status: 400 });
  }

  const result = await pool.query(
    `INSERT INTO ref_admin_role (code, label, risk_level, sort_order)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (code) DO NOTHING
     RETURNING *`,
    [code.trim().toLowerCase(), label.trim(), risk_level, sort_order],
  );

  if (result.rowCount === 0) {
    return Response.json({ error: 'Role code already exists' }, { status: 409 });
  }

  return Response.json({ role: result.rows[0] }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const body = (await req.json()) as {
    role?: string;
    resource?: string;
    actions?: string[];
    tenant_id?: string;
    granted_by?: string;
  };

  const { role, resource, actions, tenant_id, granted_by = 'admin' } = body;

  if (!role || !resource) {
    return Response.json({ error: 'role and resource are required' }, { status: 400 });
  }

  if (!tenant_id) {
    // Get any existing tenant or use a default value
    const tenantResult = await pool.query(`SELECT id FROM tenant LIMIT 1`);
    if (tenantResult.rowCount === 0) {
      return Response.json({ error: 'No tenant found in database' }, { status: 400 });
    }
    const resolvedTenantId = tenantResult.rows[0].id as string;
    return upsertPermission(role, resource, actions ?? [], resolvedTenantId, granted_by);
  }

  return upsertPermission(role, resource, actions ?? [], tenant_id, granted_by);
}

async function upsertPermission(
  role: string,
  resource: string,
  actions: string[],
  tenant_id: string,
  granted_by: string,
): Promise<Response> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Upsert the permission row
    const permResult = await client.query(
      `INSERT INTO role_permission (tenant_id, role, resource, granted_by)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (tenant_id, role, resource) DO UPDATE
         SET is_active = true, updated_at = NOW(), granted_by = EXCLUDED.granted_by
       RETURNING id`,
      [tenant_id, role, resource, granted_by],
    );

    const permId = permResult.rows[0].id as string;

    // Replace all actions
    await client.query(`DELETE FROM role_permission_action WHERE permission_id = $1`, [permId]);

    for (const action of actions) {
      await client.query(
        `INSERT INTO role_permission_action (permission_id, action) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [permId, action],
      );
    }

    await client.query('COMMIT');
    return Response.json({ updated: true, permission_id: permId });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
