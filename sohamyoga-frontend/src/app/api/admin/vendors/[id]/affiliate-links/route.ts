import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://sohamyoga.ca';

function generateCode(vendorName: string): string {
  const random = Math.random().toString(36).slice(2, 8).toUpperCase();
  const prefix = vendorName.replace(/[^A-Za-z]/g, '').slice(0, 6).toUpperCase() || 'VENDOR';
  return `AFF-${prefix}-${random}`;
}

// Real affiliate tracking-link CRUD for a vendor -- closes the documented
// gap: "attribution flows through vendor-owned storefront/products, not a
// unique external tracking link with click attribution -- the actual
// affiliate-link model is absent." Reuses the existing real referral_code/
// referral_click schema (referrer_type='affiliate') rather than a
// duplicate table -- referral codes were previously only ever
// self-issued by customers; this is the first admin/vendor-side issuance
// path. The real click-attribution redirect (/r/[code]) already existed
// but ignored any destination other than /customer/register -- fixed
// alongside this in the same change (see db-schema-affiliate-destination.sql).
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const { id } = await params;
  const result = await query<{
    id: string; code: string; destination_path: string | null; referral_url: string;
    status: string; click_count: number; used_count: number; created_at: string;
  }>(
    `SELECT id, code, destination_path, referral_url, status, click_count, used_count, created_at
     FROM referral_code WHERE referrer_id = $1 AND referrer_type = 'affiliate' ORDER BY created_at DESC`,
    [id],
  );
  return Response.json({
    links: result.rows.map(r => ({
      id: r.id, code: r.code, destinationPath: r.destination_path, trackingUrl: r.referral_url,
      status: r.status, clickCount: r.click_count, usedCount: r.used_count, createdAt: r.created_at,
    })),
  });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const { id } = await params;
  const body = await req.json().catch(() => null) as { destinationPath?: string } | null;
  const destinationPath = body?.destinationPath?.trim();
  if (!destinationPath || !destinationPath.startsWith('/') || destinationPath.startsWith('//')) {
    return Response.json({ error: 'destinationPath must be a portal-owned relative path starting with "/" (e.g. /catalog/product-slug) -- external URLs are not allowed.' }, { status: 400 });
  }

  const vendor = await query<{ name: string }>(`SELECT name FROM vendor WHERE id = $1`, [id]);
  if (!vendor.rowCount) return Response.json({ error: 'Vendor not found.' }, { status: 404 });

  const code = generateCode(vendor.rows[0].name);
  const result = await query<{ id: string }>(
    `INSERT INTO referral_code (code, referrer_id, referrer_type, referral_url, destination_path, status)
     VALUES ($1,$2,'affiliate',$3,$4,'active') RETURNING id`,
    [code, id, `${SITE_URL}/r/${code}`, destinationPath],
  );

  return Response.json({ ok: true, id: result.rows[0].id, code, trackingUrl: `${SITE_URL}/r/${code}` }, { status: 201 });
}
