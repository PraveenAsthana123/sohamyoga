import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/postgres';

interface WebhookRow {
  id: number;
  platform: string;
  event_type: string | null;
  event_id: string | null;
  payload: Record<string, unknown>;
  raw_body: string | null;
  signature_valid: boolean | null;
  processed: boolean;
  processing_error: string | null;
  received_at: string;
  processed_at: string | null;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const platform = searchParams.get('platform');
  const eventType = searchParams.get('event_type');
  const processed = searchParams.get('processed');

  const conditions: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  if (platform) {
    conditions.push(`platform = $${idx++}`);
    values.push(platform);
  }
  if (eventType) {
    conditions.push(`event_type = $${idx++}`);
    values.push(eventType);
  }
  if (processed !== null && processed !== '') {
    conditions.push(`processed = $${idx++}`);
    values.push(processed === 'true');
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  try {
    const result = await query<WebhookRow>(
      `SELECT id, platform, event_type, event_id, payload, raw_body, signature_valid,
              processed, processing_error, received_at, processed_at
       FROM platform_webhook_event
       ${where}
       ORDER BY received_at DESC
       LIMIT 100`,
      values,
    );
    return NextResponse.json({ rows: result.rows, total: result.rows.length });
  } catch (err) {
    console.error('[webhooks GET]', err);
    return NextResponse.json({ error: 'Failed to fetch webhook events' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      platform: string;
      event_type?: string;
      payload?: Record<string, unknown>;
    };

    const syntheticId = `sim_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const syntheticPayload = body.payload ?? {
      simulated: true,
      timestamp: new Date().toISOString(),
      platform: body.platform,
      event_type: body.event_type ?? 'test.event',
    };

    const result = await query<{ id: number }>(
      `INSERT INTO platform_webhook_event
         (platform, event_type, event_id, payload, raw_body, signature_valid, processed)
       VALUES ($1, $2, $3, $4, $5, true, false)
       RETURNING id`,
      [
        body.platform,
        body.event_type ?? 'test.event',
        syntheticId,
        JSON.stringify(syntheticPayload),
        JSON.stringify(syntheticPayload),
      ],
    );

    return NextResponse.json({ success: true, id: result.rows[0].id }, { status: 201 });
  } catch (err) {
    console.error('[webhooks POST]', err);
    return NextResponse.json({ error: 'Failed to create webhook event' }, { status: 500 });
  }
}
