import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL not configured.' }, { status: 503 });

  const projectId = new URL(req.url).searchParams.get('project_id');
  const rows = await query<{
    id: string; project_id: string; company_name: string; website: string;
    industry: string; founded_year: string; hq_location: string; employee_range: string;
    revenue_range: string; market_position: string; strengths: string; weaknesses: string;
    key_products: string; pricing_model: string; target_audience: string;
    social_presence: Record<string, unknown>; threat_level: string; notes: string; created_at: string;
  }>(
    projectId
      ? `SELECT * FROM market_competitor WHERE project_id = $1 ORDER BY threat_level DESC, company_name`
      : `SELECT * FROM market_competitor ORDER BY threat_level DESC, company_name`,
    projectId ? [projectId] : [],
  );

  return Response.json({
    competitors: rows.rows.map(r => ({
      id: Number(r.id), projectId: r.project_id ? Number(r.project_id) : null,
      companyName: r.company_name, website: r.website, industry: r.industry,
      foundedYear: r.founded_year ? Number(r.founded_year) : null,
      hqLocation: r.hq_location, employeeRange: r.employee_range,
      revenueRange: r.revenue_range, marketPosition: r.market_position,
      strengths: r.strengths, weaknesses: r.weaknesses,
      keyProducts: r.key_products, pricingModel: r.pricing_model,
      targetAudience: r.target_audience, socialPresence: r.social_presence,
      threatLevel: r.threat_level, notes: r.notes, createdAt: r.created_at,
    })),
  });
}

export async function POST(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL not configured.' }, { status: 503 });

  const body = await req.json().catch(() => null) as {
    project_id?: number; company_name?: string; website?: string; industry?: string;
    founded_year?: number; hq_location?: string; employee_range?: string;
    revenue_range?: string; market_position?: string; strengths?: string;
    weaknesses?: string; key_products?: string; pricing_model?: string;
    target_audience?: string; social_presence?: Record<string, unknown>;
    threat_level?: string; notes?: string;
  } | null;

  if (!body?.company_name?.trim()) {
    return Response.json({ error: 'company_name is required.' }, { status: 400 });
  }

  const result = await query<{ id: string }>(
    `INSERT INTO market_competitor
       (project_id, company_name, website, industry, founded_year, hq_location,
        employee_range, revenue_range, market_position, strengths, weaknesses,
        key_products, pricing_model, target_audience, social_presence, threat_level, notes)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
     RETURNING id`,
    [
      body.project_id ?? null, body.company_name.trim(), body.website ?? '',
      body.industry ?? '', body.founded_year ?? null, body.hq_location ?? '',
      body.employee_range ?? '', body.revenue_range ?? '', body.market_position ?? 'challenger',
      body.strengths ?? '', body.weaknesses ?? '', body.key_products ?? '',
      body.pricing_model ?? '', body.target_audience ?? '',
      JSON.stringify(body.social_presence ?? {}), body.threat_level ?? 'medium', body.notes ?? '',
    ],
  );

  return Response.json({ id: Number(result.rows[0].id) }, { status: 201 });
}
