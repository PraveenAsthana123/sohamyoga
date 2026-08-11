import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Lists content drafts with their per-platform variants — no MCP tool covers listing. */
export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const drafts = await query(
    `SELECT id, master_text, content_type, status, generated_with_ai, tags, created_at
     FROM social_content_draft ORDER BY created_at DESC LIMIT 100`,
  );
  const variants = await query(
    `SELECT draft_id, platform, adapted_text, status, account_id FROM social_platform_variant
     WHERE draft_id = ANY($1::uuid[])`,
    [drafts.rows.map((d) => (d as { id: string }).id)],
  );

  return Response.json({
    drafts: drafts.rows.map((d) => ({
      ...d,
      variants: variants.rows.filter((v) => (v as { draft_id: string }).draft_id === (d as { id: string }).id),
    })),
  });
}
