import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/requireAdmin';
import { listSubmissions } from '@/domain/form/repository';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdmin(req);
  if (auth.denied) return auth.denied;

  const submissions = await listSubmissions(params.id);
  return NextResponse.json(submissions.map((s) => s.toJSON()));
}
