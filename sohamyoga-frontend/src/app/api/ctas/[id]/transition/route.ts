import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { requireAdmin } from '@/lib/admin-auth';
import { Cta, type CtaProps } from '@/domain/cta/Cta';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Action = 'activate' | 'pause' | 'archive';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const body = await req.json().catch(() => null) as { action?: Action } | null;
  if (!body?.action) return Response.json({ error: 'action is required.' }, { status: 400 });

  const result = await query(`SELECT * FROM cta WHERE id = $1`, [params.id]);
  if (!result.rows.length) return Response.json({ error: 'CTA not found.' }, { status: 404 });
  const r = result.rows[0] as Record<string, unknown>;

  const props: CtaProps = {
    id: r.id as string, label: r.label as string, type: r.type as CtaProps['type'],
    destinationUrl: r.destination_url as string, trackingSlug: r.tracking_slug as string,
    placement: r.placement as CtaProps['placement'], riskClassification: r.risk_classification as CtaProps['riskClassification'],
    status: r.status as CtaProps['status'], clickCount: r.click_count as number,
    lastCheckedAt: r.last_checked_at ? new Date(r.last_checked_at as string) : undefined,
    lastCheckStatus: r.last_check_status as CtaProps['lastCheckStatus'], fallbackUrl: (r.fallback_url as string) ?? undefined,
    createdBy: r.created_by as string, createdAt: new Date(r.created_at as string), updatedAt: new Date(r.updated_at as string),
  };

  let updated: Cta;
  try {
    const cta = new Cta(props);
    if (body.action === 'activate') updated = cta.activate();
    else if (body.action === 'pause') updated = cta.pause();
    else if (body.action === 'archive') updated = cta.archive();
    else return Response.json({ error: `Unknown action: ${body.action}` }, { status: 400 });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : 'Transition failed.' }, { status: 422 });
  }

  const p = updated.toJSON();
  await query(`UPDATE cta SET status = $2, updated_at = $3 WHERE id = $1`, [p.id, p.status, p.updatedAt]);
  return Response.json({ ok: true, status: p.status });
}
