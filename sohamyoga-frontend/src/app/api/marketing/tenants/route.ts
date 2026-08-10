import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { databaseConfigured, query, transaction } from '@/lib/postgres';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });
  const result = await query(
    `SELECT t.id, t.name, t.slug, t.type, t.plan, t.status,
            COUNT(DISTINCT o.id)::int AS organization_count,
            COUNT(DISTINCT u.id)::int AS employee_count
     FROM tenant t LEFT JOIN organization o ON o.tenant_id=t.id
     LEFT JOIN app_user u ON u.tenant_id=t.id
     GROUP BY t.id ORDER BY t.name`,
  );
  return Response.json({ tenants: result.rows });
}

export async function POST(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });
  const body = await req.json().catch(() => null) as { name?: string; slug?: string; type?: string; adminEmail?: string; adminName?: string } | null;
  const name = body?.name?.trim();
  const slug = body?.slug?.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-');
  const adminEmail = body?.adminEmail?.trim().toLowerCase();
  const tenantType = body?.type || '';
  const types = new Set(['b2c','b2b_studio','b2b_corporate','b2b_franchise']);
  if (!name || !slug || !adminEmail || !types.has(tenantType)) {
    return Response.json({ error: 'Name, slug, tenant type, and admin email are required.' }, { status: 400 });
  }
  const id = await transaction(async client => {
    const tenant = await client.query<{ id: string }>(
      `INSERT INTO tenant(name,slug,type,plan,status,max_users) VALUES ($1,$2,$3,'professional','active',100) RETURNING id`,
      [name, slug, tenantType],
    );
    const tenantId = tenant.rows[0].id;
    const org = await client.query<{ id: string }>(
      `INSERT INTO organization(tenant_id,name,is_default) VALUES ($1,$2,TRUE) RETURNING id`, [tenantId, name],
    );
    const user = await client.query<{ id: string }>(
      `INSERT INTO app_user(tenant_id,org_id,email,display_name,role) VALUES ($1,$2,$3,$4,'admin') RETURNING id`,
      [tenantId, org.rows[0].id, adminEmail, body?.adminName?.trim() || 'Tenant Admin'],
    );
    await client.query(`UPDATE tenant SET owner_user_id=$2 WHERE id=$1`, [tenantId, user.rows[0].id]);
    return tenantId;
  });
  return Response.json({ ok: true, id }, { status: 201 });
}
