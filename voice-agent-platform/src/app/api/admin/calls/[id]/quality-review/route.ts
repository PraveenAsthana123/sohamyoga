import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/requireAdmin';
import { setCallQualityReview } from '@/domain/call/repository';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdmin(req);
  if (auth.denied) return auth.denied;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Request body must be JSON.' }, { status: 400 });
  }

  const qualityScore = typeof body.qualityScore === 'number' ? body.qualityScore : null;
  if (qualityScore !== null && (qualityScore < 1 || qualityScore > 5)) {
    return NextResponse.json({ error: 'qualityScore must be between 1 and 5.' }, { status: 400 });
  }

  try {
    const updated = await setCallQualityReview(params.id, {
      qualityScore,
      isIncident: Boolean(body.isIncident),
      incidentNotes: typeof body.incidentNotes === 'string' ? body.incidentNotes : null,
    });
    return NextResponse.json(updated.toJSON());
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Could not save review.' }, { status: 400 });
  }
}
