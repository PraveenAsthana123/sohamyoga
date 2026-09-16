import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { databaseConfigured, query } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ platform: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  if (!databaseConfigured()) {
    return Response.json({ error: 'Database not configured' }, { status: 503 });
  }

  const { platform } = await params;

  try {
    const result = await query(
      'SELECT * FROM platform_webhook_config WHERE platform = $1 ORDER BY created_at DESC',
      [platform]
    );
    return Response.json({ webhooks: result.rows });
  } catch (err) {
    console.error('webhooks GET error:', err);
    return Response.json({ error: 'Failed to load webhooks' }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  if (!databaseConfigured()) {
    return Response.json({ error: 'Database not configured' }, { status: 503 });
  }

  const { platform } = await params;

  try {
    const body = await req.json() as {
      webhook_url?: string;
      events?: string;
      is_active?: boolean;
      verify_token?: string;
    };

    const result = await query(
      `INSERT INTO platform_webhook_config (platform, webhook_url, events, is_active, verify_token)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        platform,
        body.webhook_url ?? null,
        body.events ?? null,
        body.is_active ?? false,
        body.verify_token ?? null,
      ]
    );

    return Response.json({ webhook: result.rows[0] }, { status: 201 });
  } catch (err) {
    console.error('webhooks POST error:', err);
    return Response.json({ error: 'Failed to create webhook' }, { status: 500 });
  }
}
