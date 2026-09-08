import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { getAdminPrincipal } from '@/lib/admin-auth';
import { getPrimaryTenantId } from '@/domain/ingestion/Connector';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Customer persona -- distinct entity from brand_kit (brand identity).
// brand_kit answers "who WE are"; customer_persona answers "who WE'RE
// TALKING TO". See src/domain/marketing/db-schema-persona.sql.
export async function GET(req: NextRequest) {
  const { denied } = await getAdminPrincipal(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const tenantId = await getPrimaryTenantId();
  const rows = await query(
    `SELECT id, name, age_range, goals, pain_points, preferred_channels, notes, is_default, created_at, updated_at
     FROM customer_persona WHERE tenant_id = $1 ORDER BY is_default DESC, name`,
    [tenantId],
  );
  return Response.json({
    personas: rows.rows.map(r => ({
      id: r.id, name: r.name, ageRange: r.age_range, goals: r.goals, painPoints: r.pain_points,
      preferredChannels: r.preferred_channels, notes: r.notes, isDefault: r.is_default,
      createdAt: r.created_at, updatedAt: r.updated_at,
    })),
  });
}

export async function POST(req: NextRequest) {
  const { principal, denied } = await getAdminPrincipal(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const body = await req.json();
  const { name, ageRange, goals, painPoints, preferredChannels, notes, isDefault } = body;
  if (!name?.trim()) return Response.json({ error: 'name is required.' }, { status: 400 });

  const tenantId = await getPrimaryTenantId();
  try {
    const result = await query<{ id: string }>(
      `INSERT INTO customer_persona (tenant_id, name, age_range, goals, pain_points, preferred_channels, notes, is_default, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
      [
        tenantId, name.trim(), ageRange || null,
        Array.isArray(goals) ? goals : [], Array.isArray(painPoints) ? painPoints : [],
        Array.isArray(preferredChannels) ? preferredChannels : [], notes || null,
        Boolean(isDefault), principal!.email ?? principal!.id,
      ],
    );
    return Response.json({ id: result.rows[0].id }, { status: 201 });
  } catch (err) {
    if (err instanceof Error && err.message.includes('customer_persona_tenant_id_name_key')) {
      return Response.json({ error: `A persona named "${name}" already exists.` }, { status: 409 });
    }
    throw err;
  }
}
