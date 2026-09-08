import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { databaseConfigured } from '@/lib/postgres';
import { getPrimaryTenantId } from '@/domain/ingestion/Connector';
import { listPositioningEntries, addPositioningEntry } from '@/domain/branding/BrandStrategy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const tenantId = await getPrimaryTenantId();
  const entries = await listPositioningEntries(tenantId);
  return Response.json({ entries });
}

interface EntryBody { label?: string; isSelf?: boolean; pricePosition?: number; qualityPosition?: number; notes?: string }

export async function POST(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const body = await req.json().catch(() => null) as EntryBody | null;
  if (!body?.label?.trim()) return Response.json({ error: 'label is required.' }, { status: 400 });
  if (!Number.isInteger(body.pricePosition) || body.pricePosition! < 1 || body.pricePosition! > 10) {
    return Response.json({ error: 'pricePosition must be an integer 1-10.' }, { status: 400 });
  }
  if (!Number.isInteger(body.qualityPosition) || body.qualityPosition! < 1 || body.qualityPosition! > 10) {
    return Response.json({ error: 'qualityPosition must be an integer 1-10.' }, { status: 400 });
  }

  const tenantId = await getPrimaryTenantId();
  try {
    const entry = await addPositioningEntry(tenantId, {
      label: body.label.trim(), isSelf: Boolean(body.isSelf), pricePosition: body.pricePosition!, qualityPosition: body.qualityPosition!, notes: body.notes ?? '',
    });
    return Response.json({ entry }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to add entry.';
    if (message.includes('uq_brand_positioning_self')) {
      return Response.json({ error: 'A "self" positioning entry already exists for this tenant.' }, { status: 409 });
    }
    return Response.json({ error: message }, { status: 500 });
  }
}
