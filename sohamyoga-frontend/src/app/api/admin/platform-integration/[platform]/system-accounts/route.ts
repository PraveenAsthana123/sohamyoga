import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { databaseConfigured, query } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ platform: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  if (!databaseConfigured()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }

  const { platform } = await params;

  try {
    const result = await query(
      'SELECT * FROM platform_system_account WHERE platform = $1 ORDER BY is_primary DESC, created_at DESC',
      [platform]
    );
    return NextResponse.json({ accounts: result.rows });
  } catch (err) {
    console.error('system-accounts GET error:', err);
    return NextResponse.json({ error: 'Failed to load system accounts' }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  if (!databaseConfigured()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }

  const { platform } = await params;

  try {
    const body = await req.json() as {
      account_type: string;
      account_label?: string;
      system_user_id?: string;
      app_id?: string;
      scopes_granted?: string;
      token_env_var?: string;
      token_expires_at?: string;
      is_primary?: boolean;
      notes?: string;
    };

    if (!body.account_type) {
      return NextResponse.json({ error: 'account_type is required' }, { status: 400 });
    }

    const result = await query(
      `INSERT INTO platform_system_account
         (platform, account_type, account_label, system_user_id, app_id, scopes_granted, token_env_var, token_expires_at, is_primary, notes, token_status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'unknown')
       RETURNING *`,
      [
        platform,
        body.account_type,
        body.account_label ?? null,
        body.system_user_id ?? null,
        body.app_id ?? null,
        body.scopes_granted ?? null,
        body.token_env_var ?? null,
        body.token_expires_at ?? null,
        body.is_primary ?? false,
        body.notes ?? null,
      ]
    );

    return NextResponse.json({ account: result.rows[0] }, { status: 201 });
  } catch (err) {
    console.error('system-accounts POST error:', err);
    return NextResponse.json({ error: 'Failed to create system account' }, { status: 500 });
  }
}
