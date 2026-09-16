// GET /api/admin/platform-credentials/seed — create tables and seed all 36 platforms
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { databaseConfigured, query } from '@/lib/postgres';
import { PLATFORM_SEED_DATA } from '@/lib/platform-credentials-seed';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CREATE_TABLES_SQL = `
CREATE TABLE IF NOT EXISTS platform_credential_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  setup_status TEXT DEFAULT 'not_started',
  connector_type TEXT NOT NULL,
  priority TEXT DEFAULT 'medium',
  required_env_vars TEXT[] DEFAULT '{}',
  optional_env_vars TEXT[] DEFAULT '{}',
  configured_env_vars TEXT[] DEFAULT '{}',
  developer_portal_url TEXT,
  oauth_authorize_url TEXT,
  account_email TEXT,
  account_username TEXT,
  app_name TEXT,
  app_id TEXT,
  webhook_url TEXT,
  scopes_granted TEXT[] DEFAULT '{}',
  setup_steps_completed INTEGER DEFAULT 0,
  setup_steps_total INTEGER DEFAULT 0,
  last_tested_at TIMESTAMPTZ,
  test_result TEXT,
  test_error TEXT,
  notes TEXT,
  setup_started_at TIMESTAMPTZ,
  setup_completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS platform_setup_step (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform TEXT NOT NULL,
  step_number INTEGER NOT NULL,
  step_title TEXT NOT NULL,
  step_description TEXT NOT NULL,
  step_type TEXT NOT NULL,
  required_fields JSONB DEFAULT '[]',
  action_url TEXT,
  action_label TEXT,
  env_var_to_set TEXT,
  validation_hint TEXT,
  is_completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMPTZ,
  UNIQUE(platform, step_number)
);

CREATE TABLE IF NOT EXISTS platform_setup_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform TEXT NOT NULL,
  action TEXT NOT NULL,
  details JSONB DEFAULT '{}',
  actor TEXT DEFAULT 'admin',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
`;

export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  if (!databaseConfigured()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }

  try {
    // Create tables
    await query(CREATE_TABLES_SQL);

    let platformsInserted = 0;
    let stepsInserted = 0;

    for (const p of PLATFORM_SEED_DATA) {
      // Insert platform config
      const insertResult = await query(
        `INSERT INTO platform_credential_config
          (platform, display_name, connector_type, priority, required_env_vars, optional_env_vars,
           developer_portal_url, setup_steps_total)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (platform) DO NOTHING
         RETURNING id`,
        [
          p.platform,
          p.display_name,
          p.connector_type,
          p.priority,
          p.required_env_vars,
          p.optional_env_vars,
          p.developer_portal_url ?? null,
          p.steps.length,
        ]
      );
      if (insertResult.rowCount && insertResult.rowCount > 0) platformsInserted++;

      // Insert steps
      for (const step of p.steps) {
        const stepResult = await query(
          `INSERT INTO platform_setup_step
            (platform, step_number, step_title, step_description, step_type,
             required_fields, action_url, action_label, env_var_to_set, validation_hint)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
           ON CONFLICT (platform, step_number) DO NOTHING
           RETURNING id`,
          [
            p.platform,
            step.step_number,
            step.step_title,
            step.step_description,
            step.step_type,
            JSON.stringify(step.required_fields),
            step.action_url ?? null,
            step.action_label ?? null,
            step.env_var_to_set ?? null,
            step.validation_hint ?? null,
          ]
        );
        if (stepResult.rowCount && stepResult.rowCount > 0) stepsInserted++;
      }
    }

    return NextResponse.json({
      success: true,
      message: `Tables created. Inserted ${platformsInserted} new platforms and ${stepsInserted} new steps.`,
      totalPlatforms: PLATFORM_SEED_DATA.length,
      platformsInserted,
      stepsInserted,
    });
  } catch (err) {
    console.error('[platform-credentials/seed] error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
