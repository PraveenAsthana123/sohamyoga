import { requireAdmin } from '@/lib/admin-auth';
import { databaseConfigured, getPool } from '@/lib/postgres';
import { NextRequest } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const { id } = await params;
  const pool = getPool();
  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT id, company_name, primary_contact_name, primary_contact_email, slug, logo_url,
             brand_color, allowed_modules, status, plan, retainer_cad, trial_ends_at, created_at
      FROM client_portal_accounts WHERE id = $1
    `, [id]);

    if (!result.rowCount) return Response.json({ error: 'Client not found.' }, { status: 404 });
    return Response.json({ client: result.rows[0] });
  } finally {
    client.release();
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const { id } = await params;
  const body = await req.json().catch(() => null) as {
    companyName?: string;
    primaryContactName?: string;
    primaryContactEmail?: string;
    logoUrl?: string;
    brandColor?: string;
    allowedModules?: string[];
    status?: string;
    plan?: string;
    retainerCad?: number;
    trialEndsAt?: string | null;
  } | null;

  if (!body) return Response.json({ error: 'Request body is required.' }, { status: 400 });

  const pool = getPool();
  const client = await pool.connect();
  try {
    const current = await client.query(
      `SELECT * FROM client_portal_accounts WHERE id = $1`,
      [id],
    );
    if (!current.rowCount) return Response.json({ error: 'Client not found.' }, { status: 404 });
    const c = current.rows[0];

    const result = await client.query(`
      UPDATE client_portal_accounts SET
        company_name          = $1,
        primary_contact_name  = $2,
        primary_contact_email = $3,
        logo_url              = $4,
        brand_color           = $5,
        allowed_modules       = $6,
        status                = $7,
        plan                  = $8,
        retainer_cad          = $9,
        trial_ends_at         = $10
      WHERE id = $11
      RETURNING id, company_name, primary_contact_name, primary_contact_email, slug, logo_url,
                brand_color, allowed_modules, status, plan, retainer_cad, trial_ends_at, created_at
    `, [
      body.companyName ?? c.company_name,
      body.primaryContactName ?? c.primary_contact_name,
      body.primaryContactEmail ?? c.primary_contact_email,
      body.logoUrl ?? c.logo_url,
      body.brandColor ?? c.brand_color,
      body.allowedModules ?? c.allowed_modules,
      body.status ?? c.status,
      body.plan ?? c.plan,
      body.retainerCad ?? c.retainer_cad,
      'trialEndsAt' in body ? body.trialEndsAt : c.trial_ends_at,
      id,
    ]);

    return Response.json({ client: result.rows[0] });
  } finally {
    client.release();
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const { id } = await params;
  const pool = getPool();
  const client = await pool.connect();
  try {
    const result = await client.query(
      `UPDATE client_portal_accounts SET status = 'suspended' WHERE id = $1 RETURNING id`,
      [id],
    );
    if (!result.rowCount) return Response.json({ error: 'Client not found.' }, { status: 404 });
    return Response.json({ success: true, message: 'Client portal deactivated.' });
  } finally {
    client.release();
  }
}
