import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const { id } = await params;
  const result = await query<{ version: number; adapted_content: string; adapted_subject: string | null; changed_by: string; changed_at: string }>(
    `SELECT version, adapted_content, adapted_subject, changed_by, changed_at
     FROM content_variant_history WHERE content_variant_id = $1 ORDER BY version DESC`,
    [id],
  );
  return Response.json({
    history: result.rows.map((r) => ({
      version: r.version, adaptedContent: r.adapted_content, adaptedSubject: r.adapted_subject,
      changedBy: r.changed_by, changedAt: r.changed_at,
    })),
  });
}
