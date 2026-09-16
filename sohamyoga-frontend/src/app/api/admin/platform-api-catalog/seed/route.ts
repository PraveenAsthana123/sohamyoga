import { NextResponse } from 'next/server';
import { query } from '@/lib/postgres';
import { ensurePlatformApiCatalogSchema } from '@/lib/platform-api-catalog-schema';
import { API_OFFERINGS_SEED } from '@/lib/platform-api-catalog-seed';

export async function GET() {
  await ensurePlatformApiCatalogSchema();

  let inserted = 0;
  let skipped = 0;

  for (const o of API_OFFERINGS_SEED) {
    const result = await query(
      `INSERT INTO platform_api_offering
         (platform, api_version, api_name, endpoint_path, http_method, capability,
          category, auth_type, required_scopes, required_env_vars,
          rate_limit_calls, rate_limit_window, rate_limit_tier,
          implementation_status, our_api_route, is_stable, requires_review, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
       ON CONFLICT (platform, http_method, endpoint_path) DO NOTHING`,
      [
        o.platform,
        o.api_version ?? null,
        o.api_name,
        o.endpoint_path,
        o.http_method,
        o.capability,
        o.category,
        o.auth_type,
        o.required_scopes ?? [],
        o.required_env_vars ?? [],
        o.rate_limit_calls ?? null,
        o.rate_limit_window ?? null,
        o.rate_limit_tier ?? 'default',
        o.implementation_status,
        o.our_api_route ?? null,
        o.is_stable ?? true,
        o.requires_review ?? false,
        o.notes ?? null,
      ],
    );
    if ((result.rowCount ?? 0) > 0) {
      inserted++;
    } else {
      skipped++;
    }
  }

  // Module registry upsert
  await query(`
    INSERT INTO module_registry (app, module_key, name, description, built_status, has_admin_ui, has_user_ui,
      user_flow, admin_flow, job_name, report_location, dashboard_location, schema_tables, demo_use_cases, integration_platforms)
    VALUES (
      'sohamyoga-frontend', 'platform-api-catalog', 'Platform API Capabilities Catalog',
      'Registry of every API endpoint offered by all 36 platforms with implementation status, rate limits, auth types, quota monitoring, and gap analysis.',
      'real', true, false,
      'N/A — internal admin tool.',
      'Admin browses all platform APIs by category, sees which are built vs not built, runs smoke tests per endpoint, monitors daily quota usage, reviews changelogs for breaking changes, identifies highest-impact gaps to close next.',
      'ApiQuotaMonitorJob', '/admin/platform-api-catalog?tab=implementation-gaps', '/admin/platform-api-catalog',
      ARRAY['platform_api_offering','platform_api_quota','platform_api_changelog','platform_api_test_result'],
      '[{"scenario":"Admin opens API Catalog, filters by Instagram+analytics category, sees 3 endpoints marked not_built, clicks highest-impact gap, marks as in_progress, assigns to sprint"}]'::jsonb,
      '["facebook","instagram","youtube","x_twitter","linkedin","tiktok","pinterest","reddit","whatsapp_business","github","discord","telegram","trustpilot","vimeo","patreon","medium"]'::jsonb
    ) ON CONFLICT (app, module_key) DO NOTHING
  `).catch(() => { /* ignore if module_registry not present */ });

  return NextResponse.json({
    started: true,
    inserted,
    skipped,
    total: API_OFFERINGS_SEED.length,
    message: `Seeded ${inserted} offerings, skipped ${skipped} duplicates`,
  });
}
