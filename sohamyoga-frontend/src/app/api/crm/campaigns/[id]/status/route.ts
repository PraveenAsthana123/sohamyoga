import { NextRequest } from 'next/server';
import { databaseConfigured } from '@/lib/postgres';
import { getAdminPrincipal } from '@/lib/admin-auth';
import { type CampaignBrief } from '@/domain/marketing/CampaignBrief';
import { loadCampaignBrief, saveCampaignBriefState } from '@/domain/marketing/campaignBriefRepository';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Action = 'approve' | 'launch' | 'pause' | 'resume' | 'complete' | 'archive';
const ACTIONS: Action[] = ['approve', 'launch', 'pause', 'resume', 'complete', 'archive'];

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { principal, denied } = await getAdminPrincipal(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const body = await req.json().catch(() => null) as { action?: Action; reason?: string; approvedBy?: string } | null;
  if (!body?.action || !ACTIONS.includes(body.action)) {
    return Response.json({ error: `action must be one of: ${ACTIONS.join(', ')}.` }, { status: 400 });
  }

  const campaign = await loadCampaignBrief(params.id);
  if (!campaign) return Response.json({ error: 'Campaign not found.' }, { status: 404 });

  const now = new Date();
  const approvedBy = body.approvedBy || principal!.id;
  let next: CampaignBrief;
  try {
    switch (body.action) {
      case 'approve':  next = campaign.approve(approvedBy, now); break;
      case 'launch':   next = campaign.launch(now); break;
      case 'pause':    next = campaign.pause(body.reason ?? '', now); break;
      case 'resume':   next = campaign.resume(now); break;
      case 'complete': next = campaign.complete(now); break;
      case 'archive':  next = campaign.archive(now); break;
      default: return Response.json({ error: 'Unknown action.' }, { status: 400 });
    }
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : 'Invalid transition.' }, { status: 409 });
  }

  await saveCampaignBriefState(next);
  return Response.json({ ok: true, status: next.status });
}
