import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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
