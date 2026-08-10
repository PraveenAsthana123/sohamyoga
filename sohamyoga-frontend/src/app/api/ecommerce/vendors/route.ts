import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const VENDOR_TYPES = new Set(['teacher', 'partner', 'brand', 'affiliate', 'independent']);
const COMMISSION_TYPES = new Set(['percentage', 'fixed', 'tiered']);

function slugify(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

// POST /api/ecommerce/vendors — onboard a marketplace vendor (teacher/partner/etc).
// Starts 'pending' — an admin must activate before the vendor can list products.
export async function POST(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const body = await req.json().catch(() => null) as {
    name?: string; vendorType?: string; email?: string; phone?: string;
    commissionType?: string; commissionRate?: number;
  } | null;

  if (!body?.name?.trim()) return Response.json({ error: 'Vendor name is required.' }, { status: 400 });
  if (!body.email?.trim()) return Response.json({ error: 'Vendor email is required.' }, { status: 400 });
  if (!body.vendorType || !VENDOR_TYPES.has(body.vendorType)) {
    return Response.json({ error: `vendorType must be one of: ${Array.from(VENDOR_TYPES).join(', ')}` }, { status: 400 });
  }
  const commissionType = body.commissionType && COMMISSION_TYPES.has(body.commissionType) ? body.commissionType : 'percentage';
  const commissionRate = typeof body.commissionRate === 'number' && body.commissionRate >= 0 ? body.commissionRate : 15;

  const slug = slugify(body.name);
  const result = await query<{ id: string }>(
    `INSERT INTO vendor (name, slug, vendor_type, status, email, phone, commission_type, commission_rate)
     VALUES ($1,$2,$3,'pending',$4,$5,$6,$7)
     ON CONFLICT (slug) DO NOTHING RETURNING id`,
    [body.name.trim(), slug, body.vendorType, body.email.trim(), body.phone ?? null, commissionType, commissionRate],
  );

  if (!result.rows.length) return Response.json({ error: 'A vendor with this name already exists.' }, { status: 409 });
  return Response.json({ ok: true, id: result.rows[0].id, status: 'pending' }, { status: 201 });
}

// PATCH /api/ecommerce/vendors — { id, status: 'active' | 'suspended' }
export async function PATCH(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const body = await req.json().catch(() => null) as { id?: string; status?: string } | null;
  if (!body?.id || !['active', 'suspended'].includes(body.status ?? '')) {
    return Response.json({ error: "id and status ('active'|'suspended') are required." }, { status: 400 });
  }

  const result = await query(`UPDATE vendor SET status = $1 WHERE id = $2 RETURNING id`, [body.status, body.id]);
  if (!result.rows.length) return Response.json({ error: 'Vendor not found.' }, { status: 404 });
  return Response.json({ ok: true });
}

export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const rows = await query<{
    id: string; name: string; vendor_type: string; status: string;
    commission_type: string; commission_rate: string;
    sales: string | null; pending: string | null;
  }>(
    `SELECT v.id, v.name, v.vendor_type, v.status, v.commission_type, v.commission_rate,
            COALESCE(SUM(c.net_amount) FILTER (WHERE c.status = 'settled'), 0) AS sales,
            COALESCE(SUM(c.net_amount) FILTER (WHERE c.status IN ('pending','processing')), 0) AS pending
     FROM vendor v LEFT JOIN commission c ON c.vendor_id = v.id
     GROUP BY v.id ORDER BY v.name`,
  );

  return Response.json({
    vendors: rows.rows.map(v => ({
      id: v.id, name: v.name, type: v.vendor_type, status: v.status,
      commission: v.commission_type === 'percentage' ? `${v.commission_rate}%` : `CAD ${v.commission_rate}`,
      sales: Number(v.sales ?? 0), pending: Number(v.pending ?? 0),
    })),
  });
}
