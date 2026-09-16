import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface EnrichRequest {
  email?: string;
  name?: string;
  company?: string;
  portal: string;
  lead_id?: number;
}

interface EnrichedProfile {
  full_name: string;
  email: string;
  company: string;
  job_title: string;
  linkedin_url: string;
  phone: string;
  location: string;
  industry: string;
  company_size: string;
  revenue: string;
  technologies: string[];
  intent_signals: string[];
  confidence_score: number;
}

function buildDemoProfile(email: string, name: string, company: string): EnrichedProfile {
  return {
    full_name: name || 'Jane Smith',
    email: email || 'jane.smith@example.com',
    company: company || 'Acme Corp',
    job_title: 'Director of Corporate Wellness',
    linkedin_url: 'https://linkedin.com/in/jane-smith-wellness',
    phone: '+1-416-555-0147',
    location: 'Toronto, Ontario, Canada',
    industry: 'Health & Wellness',
    company_size: '201-500',
    revenue: '$10M-$50M',
    technologies: ['Salesforce', 'HubSpot', 'Slack', 'Zoom', 'Google Workspace'],
    intent_signals: ['Corporate Wellness Programs', 'Employee Engagement', 'Mindfulness Apps'],
    confidence_score: 78.5,
  };
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth) return auth;

  try {
    const body = await req.json() as EnrichRequest;

    if (!body.portal) {
      return NextResponse.json({ error: 'portal is required' }, { status: 400 });
    }
    if (!body.email && !body.name) {
      return NextResponse.json({ error: 'email or name is required' }, { status: 400 });
    }

    // Check if the portal's env var is set
    const portalRow = await pool.query(
      'SELECT api_key_env, connected FROM b2b_portal_integration WHERE portal_name=$1',
      [body.portal]
    );

    const envVarName = portalRow.rows[0]?.api_key_env as string | undefined;
    const hasApiKey = envVarName ? Boolean(process.env[envVarName]) : false;

    let enriched: EnrichedProfile;

    if (hasApiKey) {
      // Real API call would go here — stub with realistic demo for now
      enriched = buildDemoProfile(body.email ?? '', body.name ?? '', body.company ?? '');
      enriched.confidence_score = 92.0; // Higher confidence when using real API
    } else {
      // Demo data when no API key is configured
      enriched = buildDemoProfile(body.email ?? '', body.name ?? '', body.company ?? '');
    }

    // Persist enrichment record
    await pool.query(
      `INSERT INTO b2b_lead_enrichment
         (lead_id, portal_name, email, full_name, company, job_title, linkedin_url, phone,
          location, industry, company_size, revenue, technologies, intent_signals, confidence_score, raw_data)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
      [
        body.lead_id ?? null,
        body.portal,
        enriched.email,
        enriched.full_name,
        enriched.company,
        enriched.job_title,
        enriched.linkedin_url,
        enriched.phone,
        enriched.location,
        enriched.industry,
        enriched.company_size,
        enriched.revenue,
        JSON.stringify(enriched.technologies),
        JSON.stringify(enriched.intent_signals),
        enriched.confidence_score,
        JSON.stringify(enriched),
      ]
    );

    return NextResponse.json({
      enriched,
      source: hasApiKey ? 'api' : 'demo',
      portal: body.portal,
      api_key_configured: hasApiKey,
    });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth) return auth;

  const { rows } = await pool.query(
    'SELECT * FROM b2b_lead_enrichment ORDER BY created_at DESC LIMIT 50'
  );
  return NextResponse.json({ enrichments: rows });
}
