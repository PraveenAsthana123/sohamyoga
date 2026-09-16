// GET/PATCH /api/admin/platform-credentials/[platform]
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { databaseConfigured, query } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ platform: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return NextResponse.json({ error: 'Database not configured' }, { status: 503 });

  const { platform } = await params;

  try {
    const [configResult, stepsResult, logsResult] = await Promise.all([
      query(`SELECT * FROM platform_credential_config WHERE platform = $1`, [platform]),
      query(`SELECT * FROM platform_setup_step WHERE platform = $1 ORDER BY step_number`, [platform]),
      query(`SELECT * FROM platform_setup_log WHERE platform = $1 ORDER BY created_at DESC LIMIT 20`, [platform]),
    ]);

    if (configResult.rows.length === 0) {
      return NextResponse.json({ error: 'Platform not found' }, { status: 404 });
    }

    return NextResponse.json({
      config: configResult.rows[0],
      steps: stepsResult.rows,
      logs: logsResult.rows,
    });
  } catch (err) {
    console.error('[platform-credentials/[platform]] GET error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return NextResponse.json({ error: 'Database not configured' }, { status: 503 });

  const { platform } = await params;

  try {
    const body = await req.json() as Record<string, unknown>;

    // Only allow non-secret fields to be updated
    const allowedFields = [
      'app_name', 'app_id', 'account_email', 'account_username',
      'webhook_url', 'notes', 'setup_status', 'scopes_granted',
      'configured_env_vars', 'developer_portal_url',
    ];

    const updates: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    for (const field of allowedFields) {
      if (field in body) {
        updates.push(`${field} = $${idx}`);
        values.push(body[field]);
        idx++;
      }
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    updates.push(`updated_at = NOW()`);
    values.push(platform);

    const result = await query(
      `UPDATE platform_credential_config SET ${updates.join(', ')} WHERE platform = $${idx} RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Platform not found' }, { status: 404 });
    }

    // Log the update
    await query(
      `INSERT INTO platform_setup_log (platform, action, details) VALUES ($1, 'credential_saved', $2)`,
      [platform, JSON.stringify({ fields: Object.keys(body).filter(k => allowedFields.includes(k)) })]
    );

    return NextResponse.json({ config: result.rows[0] });
  } catch (err) {
    console.error('[platform-credentials/[platform]] PATCH error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
