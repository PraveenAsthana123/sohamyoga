import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { getAdminPrincipal } from '@/lib/admin-auth';
import { generateAmplificationHooks } from '@/domain/social/ViralAmplificationGenerator';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Viral Content Builder -- drafts real cross-platform amplification hooks
// from an already-viral post's own real content (never invents the
// original), saved as social_content_draft rows for human review. Never
// auto-posts, matching ViralDetectionJob's own guardrail.
export async function POST(req: NextRequest, { params }: { params: Promise<{ postId: string }> }) {
  const { principal, denied } = await getAdminPrincipal(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const { postId } = await params;

  const signal = await query<{ is_viral: boolean; viral_score: string }>(
    `SELECT is_viral, viral_score FROM viral_signal WHERE post_id = $1`, [postId],
  );
  if (!signal.rowCount) return Response.json({ error: 'No viral signal found for this post.' }, { status: 404 });
  if (!signal.rows[0].is_viral) return Response.json({ error: 'This post has not been flagged as viral -- amplification is only offered for real statistical outliers.' }, { status: 409 });

  const post = await query<{ tenant_id: string; master_text: string }>(
    `SELECT sp.tenant_id, d.master_text FROM social_post sp JOIN social_content_draft d ON d.id = sp.draft_id WHERE sp.id = $1`,
    [postId],
  );
  if (!post.rowCount || !post.rows[0].master_text.trim()) {
    return Response.json({ error: 'Original post content not found.' }, { status: 404 });
  }
  const { tenant_id: tenantId, master_text: originalText } = post.rows[0];

  let hooks;
  try {
    hooks = await generateAmplificationHooks(originalText);
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : 'Generation failed.' }, { status: 502 });
  }

  const admin = await query<{ id: string }>(
    `SELECT id FROM app_user WHERE tenant_id = $1 AND role IN ('admin','owner') AND status = 'active' LIMIT 1`,
    [tenantId],
  );
  if (!admin.rows[0]) return Response.json({ error: 'No active admin app_user to attribute the draft to.' }, { status: 409 });

  const inserted = [];
  for (const h of hooks) {
    const result = await query<{ id: string }>(
      `INSERT INTO social_content_draft (tenant_id, workspace_id, master_text, content_type, generated_with_ai, ai_prompt_used, ai_model, tags, created_by)
       VALUES ($1,$1,$2,'text',true,$3,'ollama/strong',$4::text[],$5) RETURNING id`,
      [tenantId, h.hook, `Amplification hook for viral post ${postId}`, ['viral-amplification', postId], admin.rows[0].id],
    );
    inserted.push({ id: result.rows[0].id, hook: h.hook });
  }

  return Response.json({ ok: true, drafts: inserted, viralScore: Number(signal.rows[0].viral_score) }, { status: 201 });
}
