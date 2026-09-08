import { NextRequest } from 'next/server';
import { query } from '@/lib/postgres';
import { getAdminPrincipal } from '@/lib/admin-auth';
import { getPrimaryTenantId } from '@/domain/ingestion/Connector';
import { generateCampaignContent, type CampaignChannel } from '@/domain/social/CampaignContentGenerator';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const VALID_CHANNELS: CampaignChannel[] = ['instagram_caption', 'email_subject_body', 'sms_text', 'blog_snippet'];

export async function POST(req: NextRequest) {
  const { principal, denied } = await getAdminPrincipal(req);
  if (denied) return denied;

  const body = await req.json();
  const { brief, channels } = body;
  if (!brief?.trim()) return Response.json({ error: 'brief is required.' }, { status: 400 });

  const selectedChannels: CampaignChannel[] = Array.isArray(channels) && channels.length
    ? channels.filter((c: string): c is CampaignChannel => VALID_CHANNELS.includes(c as CampaignChannel))
    : VALID_CHANNELS;
  if (!selectedChannels.length) return Response.json({ error: 'No valid channels selected.' }, { status: 400 });

  let pieces;
  try {
    pieces = await generateCampaignContent(brief, selectedChannels);
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : 'Generation failed.' }, { status: 502 });
  }

  const tenantId = await getPrimaryTenantId();
  const inserted = [];
  for (const p of pieces) {
    const result = await query<{ id: string }>(
      `INSERT INTO content_asset (tenant_id, title, asset_type, body_text, tags, category, created_by)
       VALUES ($1, $2, 'copy_text', $3, $4, 'campaign', $5) RETURNING id`,
      [tenantId, p.title.slice(0, 200), p.bodyText, [p.channel, 'ai-generated'], principal!.email ?? principal!.id],
    );
    inserted.push({ id: result.rows[0].id, channel: p.channel, title: p.title, bodyText: p.bodyText });
  }

  return Response.json({ assets: inserted }, { status: 201 });
}
