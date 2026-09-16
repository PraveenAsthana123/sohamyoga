import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/postgres';
import { ensurePlatformApiCatalogSchema } from '@/lib/platform-api-catalog-schema';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  await ensurePlatformApiCatalogSchema();
  const { id } = await params;
  const body = await req.json() as Record<string, unknown>;

  const allowed = [
    'implementation_status', 'our_api_route', 'notes', 'is_stable',
    'requires_review', 'data_returned', 'example_request', 'example_response',
    'last_error', 'last_verified_at', 'avg_latency_ms',
  ];
  const sets: string[] = [];
  const vals: unknown[] = [];
  let idx = 1;

  for (const key of allowed) {
    if (key in body) {
      sets.push(`${key} = $${idx++}`);
      vals.push(body[key]);
    }
  }

  if (sets.length === 0) {
    return NextResponse.json({ error: 'No updatable fields provided' }, { status: 400 });
  }

  sets.push(`updated_at = NOW()`);
  vals.push(id);

  const result = await query(
    `UPDATE platform_api_offering SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
    vals,
  );
  if (result.rowCount === 0) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  return NextResponse.json({ offering: result.rows[0] });
}
