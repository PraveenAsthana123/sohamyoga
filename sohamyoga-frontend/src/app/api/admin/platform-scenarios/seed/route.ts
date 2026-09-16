import { NextRequest } from 'next/server';
import { getAdminPrincipal } from '@/lib/admin-auth';
import { databaseConfigured, query } from '@/lib/postgres';
import {
  ensureSchema, UNIVERSAL_SCENARIOS, PLATFORM_EXTRA_SCENARIOS,
  ALL_PLATFORMS, defaultPermissionForFeature, featureLabel,
} from '@/lib/platform-scenarios-schema';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function runSeed(): Promise<{ scenarios: number; permissions: number; moduleRegistry: boolean }> {
  await ensureSchema();

  let scenarioCount = 0;
  let permissionCount = 0;

  for (const platform of ALL_PLATFORMS) {
    // Universal scenarios
    const scenarios = [...UNIVERSAL_SCENARIOS];
    // Platform-specific extras
    const extras = PLATFORM_EXTRA_SCENARIOS[platform] ?? [];
    scenarios.push(...extras);

    const featureTypes = new Set<string>();

    for (const s of scenarios) {
      featureTypes.add(s.feature_type);
      const result = await query(
        `INSERT INTO platform_scenario
          (platform, feature_type, scenario_name, scenario_description, actor, trigger_type,
           steps, input_fields, output_type, api_endpoints, has_analytics, has_customer_feedback,
           has_review_capability, estimated_duration_seconds)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
         ON CONFLICT (platform, feature_type, scenario_name) DO NOTHING`,
        [
          platform, s.feature_type, s.scenario_name, s.scenario_description ?? null,
          s.actor, s.trigger_type,
          JSON.stringify(s.steps ?? []),
          JSON.stringify(s.input_fields ?? []),
          s.output_type ?? null,
          s.api_endpoints ?? [],
          s.has_analytics ?? false,
          s.has_customer_feedback ?? false,
          s.has_review_capability ?? false,
          s.estimated_duration_seconds ?? 60,
        ]
      );
      scenarioCount += result.rowCount ?? 0;
    }

    // Seed permissions for each unique feature_type on this platform
    for (const ft of featureTypes) {
      const perm = defaultPermissionForFeature(ft);
      const result = await query(
        `INSERT INTO platform_feature_permission
          (platform, feature_type, feature_label, admin_enabled, customer_enabled,
           requires_approval, approval_mode)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         ON CONFLICT (platform, feature_type) DO NOTHING`,
        [platform, ft, featureLabel(ft), perm.admin_enabled, perm.customer_enabled,
         perm.requires_approval, perm.approval_mode]
      );
      permissionCount += result.rowCount ?? 0;
    }
  }

  // Module registry entry
  try {
    await query(
      `INSERT INTO module_registry
        (app, module_key, name, description, built_status, has_admin_ui, has_user_ui,
         user_flow, admin_flow, job_name, report_location, dashboard_location,
         schema_tables, demo_use_cases, integration_platforms)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
       ON CONFLICT (app, module_key) DO NOTHING`,
      [
        'sohamyoga-frontend',
        'platform-scenario-registry',
        'Platform Scenario Registry & Feature Gating',
        'Per-platform scenario catalog (text/image/video/campaign/review/feedback/insight) with admin control over customer access, approval workflows, review management, and AI-powered insights.',
        'real', true, true,
        'Customer schedules a post — system checks permissions, routes through approval if required. Customer views engagement feedback and platform insights.',
        'Admin manages which platform features customers can access, approves pending customer posts, reads and responds to reviews, generates AI insights from platform analytics.',
        'SocialAlertScanJob',
        '/admin/platform-scenarios?tab=insights',
        '/admin/platform-scenarios',
        ['platform_scenario','platform_feature_permission','platform_scenario_run','platform_review','platform_insight','platform_content_feedback'],
        JSON.stringify([{"scenario":"Admin enables Instagram image posting for customers with approval required. Customer submits photo post. Admin sees it in pending approvals, approves. Post goes live."}]),
        JSON.stringify(["facebook","instagram","youtube","x_twitter","linkedin","tiktok","pinterest","reddit","whatsapp_business","google_business","trustpilot","discord","telegram"]),
      ]
    );
  } catch { /* ignore duplicate */ }

  return { scenarios: scenarioCount, permissions: permissionCount, moduleRegistry: true };
}

export async function POST(req: NextRequest) {
  const denied = (await getAdminPrincipal(req)).denied;
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL not configured' }, { status: 503 });

  // Run synchronously so caller gets real counts
  try {
    const result = await runSeed();
    return Response.json({ started: true, ...result });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return Response.json({ error: msg }, { status: 500 });
  }
}
