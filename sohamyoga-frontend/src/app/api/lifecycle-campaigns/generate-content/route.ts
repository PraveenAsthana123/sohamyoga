import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { generateCampaignContent } from '@/domain/social/CampaignContentGenerator';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Real "Generate with AI (Ollama)" -- the campaign wizard's button
// previously set a single hardcoded canned message on click, with zero
// Ollama call despite the label. Reuses the existing real
// CampaignContentGenerator.ts (already used elsewhere for social content).
export async function POST(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const body = await req.json().catch(() => null) as { brief?: string } | null;
  if (!body?.brief?.trim()) return Response.json({ error: 'brief is required.' }, { status: 400 });

  try {
    const [piece] = await generateCampaignContent(body.brief.trim(), ['email_subject_body']);
    // generateCampaignContent already parses "SUBJECT: ...\nBODY: ..." into
    // title/bodyText for this channel -- no need to re-parse here.
    return Response.json({ subject: piece.title, body: piece.bodyText });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : 'Failed to generate content.' }, { status: 502 });
  }
}
