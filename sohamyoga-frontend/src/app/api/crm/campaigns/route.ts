import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { requireAdmin, getAdminPrincipal } from '@/lib/admin-auth';
import { getPrimaryTenantId } from '@/domain/ingestion/Connector';
import { CampaignBrief, type CampaignObjective, type CampaignOfferType, type ContentSequenceStep } from '@/domain/marketing/CampaignBrief';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UTM_SLUG_RE = /^[a-z][a-z0-9_-]+$/;

/** Derive a default utm_campaign slug from the campaign name; falls back to a
 * timestamp-based slug when the name doesn't yield a valid one (e.g. all-symbol names). */
function slugify(name: string): string {
  const base = name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').replace(/_+$/g, '');
  const candidate = base.length >= 2 && /^[a-z]/.test(base) ? base : `c_${base}`;
  return UTM_SLUG_RE.test(candidate) ? candidate : `campaign_${Date.now()}`;
}

export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const rows = await query<{
    id: string; name: string; status: string; target_persona: string[];
    impressions: string | null; clicks: string | null; leads_captured: string | null; registrations: string | null;
  }>(
    `SELECT b.id, b.name, b.status, b.target_persona,
            SUM(a.impressions) AS impressions, SUM(a.clicks) AS clicks,
            SUM(a.leads_captured) AS leads_captured, SUM(a.registrations) AS registrations
     FROM campaign_brief b LEFT JOIN campaign_analytics a ON a.brief_id = b.id
     GROUP BY b.id ORDER BY b.start_date DESC LIMIT 50`,
  );

  return Response.json({
    campaigns: rows.rows.map(r => {
      const impressions = Number(r.impressions ?? 0);
      const clicks = Number(r.clicks ?? 0);
      return {
        id: r.id, name: r.name, status: r.status,
        segment: r.target_persona?.join(', ') || '—',
        sent: impressions,
        openRatePct: impressions ? Math.round((clicks / impressions) * 1000) / 10 : 0,
        ctrPct: impressions ? Math.round((clicks / impressions) * 1000) / 10 : 0,
        conversions: Number(r.registrations ?? 0),
      };
    }),
  });
}

export async function POST(req: NextRequest) {
  const { principal, denied } = await getAdminPrincipal(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const body = await req.json().catch(() => null) as {
    name?: string; description?: string; objective?: CampaignObjective; offerType?: CampaignOfferType;
    targetPersona?: string[]; channels?: string[]; contentSequence?: ContentSequenceStep[];
    budgetPlannedCAD?: number; startDate?: string; endDate?: string;
    utmCampaign?: string; brandKitId?: string;
  } | null;
  if (!body?.name || !body.objective || !body.offerType || !body.channels?.length || !body.startDate || !body.endDate) {
    return Response.json({ error: 'name, objective, offerType, channels, startDate, and endDate are required.' }, { status: 400 });
  }

  const utmCampaign = body.utmCampaign?.trim() || slugify(body.name);
  const startDate = new Date(body.startDate);
  const endDate = new Date(body.endDate);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return Response.json({ error: 'startDate and endDate must be valid dates.' }, { status: 400 });
  }

  const now = new Date();
  try {
    new CampaignBrief({
      id: '00000000-0000-0000-0000-000000000000', tenantId: '00000000-0000-0000-0000-000000000000',
      name: body.name, description: body.description ?? '', objective: body.objective, offerType: body.offerType,
      targetPersona: body.targetPersona ?? [], channels: body.channels, contentSequence: body.contentSequence ?? [],
      budgetPlannedCAD: body.budgetPlannedCAD ?? 0, budgetActualCAD: 0,
      startDate, endDate, status: 'draft', utmCampaign,
      createdBy: principal!.id, createdAt: now, updatedAt: now,
    });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : 'Invalid campaign data.' }, { status: 400 });
  }

  const tenantId = await getPrimaryTenantId();
  try {
    const result = await query<{ id: string }>(
      `INSERT INTO campaign_brief (tenant_id, name, description, objective, offer_type, target_persona, channels,
                                    content_sequence, budget_planned_cad, budget_actual_cad, start_date, end_date,
                                    status, utm_campaign, brand_kit_id, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,0,$10,$11,'draft',$12,$13,$14) RETURNING id`,
      [tenantId, body.name, body.description ?? '', body.objective, body.offerType,
        body.targetPersona ?? [], body.channels, body.contentSequence ?? [],
        body.budgetPlannedCAD ?? 0, startDate.toISOString().slice(0, 10), endDate.toISOString().slice(0, 10),
        utmCampaign, body.brandKitId ?? null, principal!.id],
    );
    return Response.json({ ok: true, id: result.rows[0].id }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const status = message.includes('duplicate key') ? 409 : 502;
    return Response.json({ error: status === 409 ? 'A campaign with this UTM slug already exists.' : message }, { status });
  }
}
