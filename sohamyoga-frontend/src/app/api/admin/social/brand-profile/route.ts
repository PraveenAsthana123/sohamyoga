import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { getAdminPrincipal } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// The single tenant-level brand profile, drafted by BrandProfileDraftJob.
// Approval is a real human/business decision -- this route can move it to
// approved/rejected but never auto-approves anything itself.
export async function GET(req: NextRequest) {
  const auth = await getAdminPrincipal(req); if (auth.denied) return auth.denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const profile = await query(`SELECT * FROM social_brand_profile ORDER BY created_at DESC LIMIT 1`);
  const bios = await query(`SELECT * FROM social_platform_bio ORDER BY platform`);
  return Response.json({ profile: profile.rows[0] ?? null, platformBios: bios.rows });
}

export async function PATCH(req: NextRequest) {
  const auth = await getAdminPrincipal(req); if (auth.denied) return auth.denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const body = await req.json().catch(() => null) as { action?: string } | null;
  if (!body?.action || !['approve', 'reject'].includes(body.action)) {
    return Response.json({ error: 'action must be approve or reject.' }, { status: 400 });
  }
  const status = body.action === 'approve' ? 'approved' : 'rejected';
  const result = await query(
    `UPDATE social_brand_profile SET approval_status = $1, approved_by = $2, approved_at = now(), updated_at = now()
     WHERE id = (SELECT id FROM social_brand_profile ORDER BY created_at DESC LIMIT 1) RETURNING *`,
    [status, auth.principal!.id],
  );
  if (!result.rowCount) return Response.json({ error: 'No brand profile exists yet.' }, { status: 404 });
  return Response.json({ profile: result.rows[0] });
}
