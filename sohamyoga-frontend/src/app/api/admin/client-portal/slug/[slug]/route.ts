import { databaseConfigured, getPool } from '@/lib/postgres';
import { NextRequest } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Public endpoint — no admin auth required; used by the client-facing portal page.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
): Promise<Response> {
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const { slug } = await params;
  const pool = getPool();
  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT id, company_name, primary_contact_name, primary_contact_email, slug, logo_url,
             brand_color, allowed_modules, status, plan, created_at
      FROM client_portal_accounts
      WHERE slug = $1 AND status != 'suspended'
    `, [slug]);

    if (!result.rowCount) {
      return Response.json({ error: 'Portal not found or suspended.' }, { status: 404 });
    }

    return Response.json({ portal: result.rows[0] });
  } finally {
    client.release();
  }
}
