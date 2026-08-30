import { NextRequest } from 'next/server';
import { databaseConfigured } from '@/lib/postgres';
import { requireAdmin, getAdminPrincipal } from '@/lib/admin-auth';
import { type BrandKit } from '@/domain/marketing/BrandKit';
import { loadBrandKit, saveBrandKitState } from '@/domain/marketing/brandKitRepository';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type PatchBody =
  | { action: 'updateColors'; primaryColor: string; secondaryColor: string; accentColor: string }
  | { action: 'addApprovedPhrase'; phrase: string }
  | { action: 'removeApprovedPhrase'; phrase: string }
  | { action: 'addBannedPhrase'; phrase: string }
  | { action: 'addHashtag'; hashtag: string }
  | { action: 'removeHashtag'; hashtag: string };

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { principal, denied } = await getAdminPrincipal(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const body = await req.json().catch(() => null) as Partial<PatchBody> | null;
  if (!body?.action) {
    return Response.json({ error: 'action is required.' }, { status: 400 });
  }

  const kit = await loadBrandKit(params.id);
  if (!kit) return Response.json({ error: 'Brand kit not found.' }, { status: 404 });

  const now = new Date();
  const updatedBy = principal!.id;
  let next: BrandKit;
  try {
    switch (body.action) {
      case 'updateColors': {
        const b = body as Extract<PatchBody, { action: 'updateColors' }>;
        if (!b.primaryColor || !b.secondaryColor || !b.accentColor) {
          return Response.json({ error: 'primaryColor, secondaryColor, and accentColor are required.' }, { status: 400 });
        }
        next = kit.updateColors(b.primaryColor, b.secondaryColor, b.accentColor, updatedBy, now);
        break;
      }
      case 'addApprovedPhrase': {
        const b = body as Extract<PatchBody, { action: 'addApprovedPhrase' }>;
        if (!b.phrase) return Response.json({ error: 'phrase is required.' }, { status: 400 });
        next = kit.addApprovedPhrase(b.phrase, updatedBy, now);
        break;
      }
      case 'removeApprovedPhrase': {
        const b = body as Extract<PatchBody, { action: 'removeApprovedPhrase' }>;
        if (!b.phrase) return Response.json({ error: 'phrase is required.' }, { status: 400 });
        next = kit.removeApprovedPhrase(b.phrase, updatedBy, now);
        break;
      }
      case 'addBannedPhrase': {
        const b = body as Extract<PatchBody, { action: 'addBannedPhrase' }>;
        if (!b.phrase) return Response.json({ error: 'phrase is required.' }, { status: 400 });
        next = kit.addBannedPhrase(b.phrase, updatedBy, now);
        break;
      }
      case 'addHashtag': {
        const b = body as Extract<PatchBody, { action: 'addHashtag' }>;
        if (!b.hashtag) return Response.json({ error: 'hashtag is required.' }, { status: 400 });
        next = kit.addHashtag(b.hashtag, updatedBy, now);
        break;
      }
      case 'removeHashtag': {
        const b = body as Extract<PatchBody, { action: 'removeHashtag' }>;
        if (!b.hashtag) return Response.json({ error: 'hashtag is required.' }, { status: 400 });
        next = kit.removeHashtag(b.hashtag, updatedBy, now);
        break;
      }
      default:
        return Response.json({ error: 'Unknown action.' }, { status: 400 });
    }
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : 'Invalid update.' }, { status: 400 });
  }

  await saveBrandKitState(next);
  return Response.json({ ok: true, brandKit: next.toJSON() });
}
