import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/postgres';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const id = parseInt(params.id, 10);
  if (isNaN(id)) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  }

  try {
    const body = await req.json() as { action: 'retry_now' | 'cancel' };

    if (body.action === 'retry_now') {
      await query(
        `UPDATE platform_retry_queue
         SET next_retry_at = NOW(), status = 'pending', updated_at = NOW()
         WHERE id = $1`,
        [id],
      );
      return NextResponse.json({ success: true, action: 'retry_now', id });
    }

    if (body.action === 'cancel') {
      await query(
        `UPDATE platform_retry_queue
         SET status = 'cancelled', updated_at = NOW()
         WHERE id = $1`,
        [id],
      );
      return NextResponse.json({ success: true, action: 'cancel', id });
    }

    return NextResponse.json({ error: 'Invalid action. Use retry_now or cancel' }, { status: 400 });
  } catch (err) {
    console.error('[retry-queue/id POST]', err);
    return NextResponse.json({ error: 'Action failed' }, { status: 500 });
  }
}
