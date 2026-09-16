import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/postgres';
import {
  publishExtendedPlatform,
  type ExtendedPlatform,
  type PublishInput,
  type RuntimeSecret,
} from '@/domain/social/platform-adapters';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  let body: { platform?: ExtendedPlatform; input?: PublishInput; secret?: RuntimeSecret };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { platform, input, secret } = body;
  if (!platform || !input || !secret) {
    return NextResponse.json({ error: 'platform, input, and secret are required' }, { status: 400 });
  }

  let result;
  try {
    result = await publishExtendedPlatform(platform, input, secret);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown publish error';
    return NextResponse.json({ error: message }, { status: 502 });
  }

  // Persist to unified_content_item and log to social_provisioning_event on success/queued
  if (result.status === 'published' || result.status === 'queued') {
    try {
      // Insert into unified_content_item
      const uci = await query(
        `INSERT INTO unified_content_item
           (item_type, source_id, platform, content_type, caption, status, external_url, created_at, updated_at)
         VALUES ('social_post', $1, $2, 'custom', $3, $4, $5, now(), now())
         ON CONFLICT DO NOTHING
         RETURNING id`,
        [
          input.idempotencyKey,
          platform,
          input.text.slice(0, 500),
          result.status,
          result.externalUrl ?? null,
        ],
      );

      // Log provisioning event
      await query(
        `INSERT INTO social_provisioning_event
           (event_type, platform, reference_id, payload, created_at)
         VALUES ('extended_publish', $1, $2, $3, now())`,
        [
          platform,
          result.externalId ?? input.idempotencyKey,
          JSON.stringify({ status: result.status, uci_id: uci.rows[0]?.id ?? null }),
        ],
      );
    } catch (dbErr) {
      // Non-fatal — publish succeeded; log but don't fail the response
      console.warn('[publish-extended] DB logging failed:', dbErr instanceof Error ? dbErr.message : dbErr);
    }
  }

  return NextResponse.json({ ok: true, result });
}
