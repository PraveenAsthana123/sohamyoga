import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { getAdminPrincipal } from '@/lib/admin-auth';
import { getPrimaryTenantId } from '@/domain/ingestion/Connector';
import { checkBrandCompliance } from '@/domain/branding/BrandComplianceChecker';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Two real resolution paths for a flagged content_variant, matching the
// "record a human decision, never silently auto-resolve" pattern used
// elsewhere (ServiceRecoveryPanel, review moderation): edit the copy and
// re-run the real deterministic check, or an admin override with a reason.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { principal, denied } = await getAdminPrincipal(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const { id } = await params;
  const body = await req.json().catch(() => null) as { adaptedContent?: string; overrideReason?: string } | null;
  if (!body?.adaptedContent && !body?.overrideReason) {
    return Response.json({ error: 'Provide either adaptedContent (to re-check) or overrideReason (to override).' }, { status: 400 });
  }

  const existing = await query<{ compliance_status: string; adapted_content: string; adapted_subject: string | null }>(
    `SELECT compliance_status, adapted_content, adapted_subject FROM content_variant WHERE id = $1`, [id],
  );
  if (!existing.rowCount) return Response.json({ error: 'Content variant not found.' }, { status: 404 });
  if (existing.rows[0].compliance_status !== 'flagged') {
    return Response.json({ error: 'Only flagged content can be resolved here.' }, { status: 409 });
  }

  // Content Versioning -- content_variant_history already had a real schema
  // (version/adapted_content/changed_by) but nothing ever wrote to it
  // (found live 2026-09-07). Snapshot the pre-edit content before either
  // resolution path mutates it, so a real edit history accumulates.
  const priorVersion = await query<{ v: number | null }>(
    `SELECT max(version) AS v FROM content_variant_history WHERE content_variant_id = $1`, [id],
  );
  const nextVersion = (priorVersion.rows[0].v ?? 0) + 1;
  await query(
    `INSERT INTO content_variant_history (content_variant_id, version, adapted_content, adapted_subject, changed_by)
     VALUES ($1,$2,$3,$4,$5)`,
    [id, nextVersion, existing.rows[0].adapted_content, existing.rows[0].adapted_subject, principal!.email ?? principal!.id],
  );

  if (body.overrideReason) {
    await query(
      `UPDATE content_variant SET compliance_status = 'pass', updated_at = now(),
              adapted_content = adapted_content || E'\n\n[Compliance override by ' || $2 || ': ' || $3 || ']'
       WHERE id = $1`,
      [id, principal!.email ?? principal!.id, body.overrideReason],
    );
    return Response.json({ ok: true, resolution: 'overridden' });
  }

  const tenantId = await getPrimaryTenantId();
  const kit = await query<{ banned_phrases: string[]; approved_phrases: string[]; tone_words: string[] }>(
    `SELECT banned_phrases, approved_phrases, tone_words FROM brand_kit WHERE tenant_id = $1 AND is_default = true LIMIT 1`,
    [tenantId],
  );
  if (!kit.rowCount) return Response.json({ error: 'No default brand kit exists.' }, { status: 404 });

  const result = checkBrandCompliance(body.adaptedContent!, kit.rows[0]);
  await query(
    `UPDATE content_variant
     SET adapted_content = $2, compliance_status = $3, compliance_violations = $4, compliance_checked_at = now(), updated_at = now()
     WHERE id = $1`,
    [id, body.adaptedContent, result.status, result.violations],
  );
  return Response.json({ ok: true, resolution: 're-checked', result });
}
