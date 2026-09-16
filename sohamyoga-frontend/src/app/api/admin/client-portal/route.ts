import { requireAdmin } from '@/lib/admin-auth';
import { databaseConfigured, getPool } from '@/lib/postgres';
import { NextRequest } from 'next/server';
import type { PoolClient } from 'pg';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function provision(client: PoolClient) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS client_portal_accounts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      company_name TEXT NOT NULL,
      primary_contact_name TEXT,
      primary_contact_email TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      logo_url TEXT,
      brand_color TEXT DEFAULT '#3B82F6',
      allowed_modules TEXT[] DEFAULT ARRAY['campaigns','analytics','reports','invoices'],
      status TEXT DEFAULT 'active',
      plan TEXT DEFAULT 'standard',
      retainer_cad NUMERIC(10,2),
      trial_ends_at DATE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  const existing = await client.query(`SELECT id FROM client_portal_accounts LIMIT 1`);
  if (existing.rowCount === 0) {
    const seeds = [
      {
        company_name: 'Sunrise Wellness Studio',
        primary_contact_name: 'Anita Sharma',
        primary_contact_email: 'anita@sunrisewellness.ca',
        slug: 'sunrise-wellness',
        brand_color: '#F59E0B',
        allowed_modules: ['campaigns', 'analytics', 'reports', 'invoices', 'social'],
        status: 'active',
        plan: 'premium',
        retainer_cad: 3500.00,
        trial_ends_at: null,
      },
      {
        company_name: 'Acme Fitness Corp',
        primary_contact_name: 'Derek Nguyen',
        primary_contact_email: 'derek@acmefitness.com',
        slug: 'acme-fitness',
        brand_color: '#10B981',
        allowed_modules: ['campaigns', 'analytics', 'reports'],
        status: 'active',
        plan: 'standard',
        retainer_cad: 1800.00,
        trial_ends_at: null,
      },
      {
        company_name: 'ZenFlow Yoga',
        primary_contact_name: 'Sara Patel',
        primary_contact_email: 'sara@zenflow.yoga',
        slug: 'zenflow-yoga',
        brand_color: '#8B5CF6',
        allowed_modules: ['campaigns', 'reports', 'invoices'],
        status: 'trial',
        plan: 'trial',
        retainer_cad: null,
        trial_ends_at: '2026-10-01',
      },
    ];

    for (const s of seeds) {
      await client.query(`
        INSERT INTO client_portal_accounts
          (company_name, primary_contact_name, primary_contact_email, slug, brand_color,
           allowed_modules, status, plan, retainer_cad, trial_ends_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      `, [s.company_name, s.primary_contact_name, s.primary_contact_email, s.slug,
          s.brand_color, s.allowed_modules, s.status, s.plan,
          s.retainer_cad, s.trial_ends_at]);
    }
  }
}

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const pool = getPool();
  const client = await pool.connect();
  try {
    await provision(client);

    const result = await client.query(`
      SELECT id, company_name, primary_contact_name, primary_contact_email, slug, logo_url,
             brand_color, allowed_modules, status, plan, retainer_cad, trial_ends_at, created_at
      FROM client_portal_accounts
      ORDER BY created_at DESC
    `);

    return Response.json({ clients: result.rows });
  } finally {
    client.release();
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const body = await req.json().catch(() => null) as {
    companyName?: string;
    primaryContactName?: string;
    primaryContactEmail?: string;
    slug?: string;
    brandColor?: string;
    allowedModules?: string[];
    plan?: string;
    retainerCad?: number;
    trialEndsAt?: string;
  } | null;

  if (!body?.companyName || !body?.primaryContactEmail || !body?.slug) {
    return Response.json({ error: 'companyName, primaryContactEmail, and slug are required.' }, { status: 400 });
  }

  const pool = getPool();
  const client = await pool.connect();
  try {
    await provision(client);

    const result = await client.query(`
      INSERT INTO client_portal_accounts
        (company_name, primary_contact_name, primary_contact_email, slug, brand_color,
         allowed_modules, plan, retainer_cad, trial_ends_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      RETURNING id, company_name, primary_contact_name, primary_contact_email, slug,
                brand_color, allowed_modules, status, plan, retainer_cad, trial_ends_at, created_at
    `, [
      body.companyName,
      body.primaryContactName ?? null,
      body.primaryContactEmail,
      body.slug,
      body.brandColor ?? '#3B82F6',
      body.allowedModules ?? ['campaigns', 'analytics', 'reports', 'invoices'],
      body.plan ?? 'standard',
      body.retainerCad ?? null,
      body.trialEndsAt ?? null,
    ]);

    return Response.json({ client: result.rows[0] }, { status: 201 });
  } catch (err: unknown) {
    const pg = err as { code?: string };
    if (pg?.code === '23505') {
      return Response.json({ error: 'A client portal with that slug already exists.' }, { status: 409 });
    }
    throw err;
  } finally {
    client.release();
  }
}
