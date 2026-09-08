import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { generateContentBrief } from '@/domain/seo/ContentBrief';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const keyword = req.nextUrl.searchParams.get('keyword');
  if (!keyword?.trim()) return Response.json({ error: 'A keyword query param is required.' }, { status: 400 });

  try {
    const brief = await generateContentBrief(keyword);
    return Response.json(brief);
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : 'Could not generate content brief.' }, { status: 502 });
  }
}
