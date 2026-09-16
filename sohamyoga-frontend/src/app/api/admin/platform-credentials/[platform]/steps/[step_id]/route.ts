// PATCH /api/admin/platform-credentials/[platform]/steps/[step_id]
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { databaseConfigured, query } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ platform: string; step_id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return NextResponse.json({ error: 'Database not configured' }, { status: 503 });

  const { platform, step_id } = await params;

  try {
    const body = await req.json() as {
      is_completed?: boolean;
      form_values?: Record<string, string>;
    };

    const { is_completed, form_values } = body;

    // Mark step completed/incomplete
    const stepResult = await query(
      `UPDATE platform_setup_step
       SET is_completed = $1, completed_at = CASE WHEN $1 THEN NOW() ELSE NULL END
       WHERE id = $2 AND platform = $3
       RETURNING *`,
      [is_completed ?? true, step_id, platform]
    );

    if (stepResult.rows.length === 0) {
      return NextResponse.json({ error: 'Step not found' }, { status: 404 });
    }

    const step = stepResult.rows[0] as { step_type: string; env_var_to_set?: string };

    // Save non-secret form values to platform config
    if (form_values && Object.keys(form_values).length > 0) {
      const allowedConfigFields: Record<string, string> = {
        app_name: 'app_name',
        app_id: 'app_id',
        account_email: 'account_email',
        account_username: 'account_username',
        webhook_url: 'webhook_url',
        redirect_url: 'webhook_url',
        github_owner: 'account_username',
        github_repo: 'notes',
        bot_username: 'account_username',
        instance_url: 'developer_portal_url',
        channel_id: 'app_id',
        publication_url: 'developer_portal_url',
        rss_feed_url: 'developer_portal_url',
        business_account_id: 'app_id',
        location_id: 'notes',
        wa_business_account_id: 'notes',
        phone_number_id: 'app_id',
        customer_id: 'app_id',
        campaign_id: 'app_id',
        business_unit_id: 'app_id',
        business_id: 'app_id',
        client_id: 'app_id',
        chat_id: 'notes',
        redirect_uri: 'webhook_url',
        gitlab_project_id: 'app_id',
      };

      const updates: string[] = [];
      const values: unknown[] = [];
      let idx = 1;

      for (const [formKey, val] of Object.entries(form_values)) {
        const configCol = allowedConfigFields[formKey];
        if (configCol && val) {
          updates.push(`${configCol} = $${idx}`);
          values.push(val);
          idx++;
        }
      }

      if (updates.length > 0) {
        values.push(platform);
        await query(
          `UPDATE platform_credential_config SET ${updates.join(', ')}, updated_at = NOW() WHERE platform = $${idx}`,
          values
        );
      }
    }

    // If env_var step is confirmed, add to configured_env_vars
    if (step.step_type === 'env_var' && step.env_var_to_set && is_completed) {
      await query(
        `UPDATE platform_credential_config
         SET configured_env_vars = array_append(
           array_remove(configured_env_vars, $2),
           $2
         ), updated_at = NOW()
         WHERE platform = $1`,
        [platform, step.env_var_to_set]
      );
    }

    // Recalculate completed steps count
    await query(
      `UPDATE platform_credential_config
       SET setup_steps_completed = (
         SELECT COUNT(*) FROM platform_setup_step WHERE platform = $1 AND is_completed = true
       ),
       setup_status = CASE
         WHEN (SELECT COUNT(*) FROM platform_setup_step WHERE platform = $1 AND is_completed = true) = 0 THEN 'not_started'
         WHEN (SELECT COUNT(*) FROM platform_setup_step WHERE platform = $1 AND is_completed = true) =
              (SELECT COUNT(*) FROM platform_setup_step WHERE platform = $1) THEN 'configured'
         ELSE 'in_progress'
       END,
       updated_at = NOW()
       WHERE platform = $1`,
      [platform]
    );

    // Log action
    await query(
      `INSERT INTO platform_setup_log (platform, action, details)
       VALUES ($1, 'step_completed', $2)`,
      [platform, JSON.stringify({ step_id, is_completed: is_completed ?? true })]
    );

    return NextResponse.json({ step: stepResult.rows[0], success: true });
  } catch (err) {
    console.error('[platform-credentials/steps/[step_id]] PATCH error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
