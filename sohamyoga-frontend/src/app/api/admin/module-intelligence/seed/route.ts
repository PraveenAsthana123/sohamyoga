import { NextRequest, NextResponse } from 'next/server';
import { query, transaction } from '@/lib/postgres';
import { ensureSchema } from '@/lib/module-intelligence-schema';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface ModuleRow {
  module_key: string;
  name: string;
  built_status: string;
  user_flow: string | null;
  admin_flow: string | null;
  job_name: string | null;
  report_location: string | null;
  dashboard_location: string | null;
  integration_platforms: unknown[];
}

// Detect integration platform from module data
function detectIntegration(mod: ModuleRow): string {
  const key = mod.module_key.toLowerCase();
  const name = mod.name.toLowerCase();
  if (key.includes('stripe') || name.includes('payment')) return 'stripe';
  if (key.includes('postiz') || key.includes('social')) return 'postiz';
  if (key.includes('calcom') || key.includes('booking') || key.includes('calendar')) return 'calcom';
  if (key.includes('google') || key.includes('ads') || key.includes('analytics')) return 'google-ads';
  if (key.includes('email') || key.includes('newsletter')) return 'listmonk';
  if (key.includes('affiliate') || key.includes('referral')) return 'internal-affiliate';
  if (key.includes('sms') || key.includes('notification')) return 'novu';
  if (key.includes('crm') || key.includes('lead')) return 'internal-crm';
  if (key.includes('video')) return 'mux';
  if (key.includes('chat') || key.includes('support')) return 'internal-chat';
  return 'internal';
}

function deriveApiEndpoint(mod: ModuleRow): string {
  const key = mod.module_key;
  // Try to derive from report_location or dashboard_location
  if (mod.report_location && mod.report_location.startsWith('/api/')) {
    return mod.report_location.split(' ')[0];
  }
  return `/api/admin/${key}`;
}

function deriveCustomerRoute(mod: ModuleRow): string {
  const key = mod.module_key;
  if (mod.dashboard_location && mod.dashboard_location.includes('/customer/')) {
    return mod.dashboard_location.split(' ')[0];
  }
  return `/customer/${key}`;
}

function deriveAdminRoute(mod: ModuleRow): string {
  const key = mod.module_key;
  if (mod.dashboard_location && mod.dashboard_location.includes('/admin/')) {
    return mod.dashboard_location.split(' ')[0];
  }
  if (mod.report_location && mod.report_location.includes('/admin/')) {
    return mod.report_location.split(' ')[0];
  }
  return `/admin/${key}`;
}

async function seedBatch(modules: ModuleRow[], counters: {
  plans: number; cases: number; scenarios: number; navMaps: number; alerts: number; tenants: number; datasets: number;
}): Promise<void> {
  await transaction(async (client) => {
    for (const mod of modules) {
      const mk = mod.module_key;
      const planName = `${mod.name} Test Plan v1.0`;
      const objective = mod.user_flow
        ? `Verify: ${mod.user_flow.slice(0, 200)}`
        : `Verify all ${mod.name} module functionality end-to-end`;
      const scopeIn = `${mod.name} user flows, admin flows, API endpoints, UI validation, tenant isolation, agentic automation`;
      const scopeOut = 'Performance benchmarking, penetration testing, third-party infrastructure';
      const apiEndpoint = deriveApiEndpoint(mod);
      const customerRoute = deriveCustomerRoute(mod);
      const adminRoute = deriveAdminRoute(mod);
      const integration = detectIntegration(mod);

      // ── test_plan ─────────────────────────────────────────────────────────
      const planRes = await client.query(
        `INSERT INTO test_plan (module_key, plan_name, version, objective, scope_in, scope_out, environment,
          test_data_source, total_cases, positive_cases, negative_cases, boundary_cases, status, created_by)
         VALUES ($1,$2,'1.0',$3,$4,$5,'local','synthetic',10,5,3,2,'active','system')
         ON CONFLICT DO NOTHING RETURNING id`,
        [mk, planName, objective, scopeIn, scopeOut],
      );
      const planId: string | null = planRes.rows[0]?.id ?? null;
      if (planRes.rows.length > 0) counters.plans++;

      // ── test_case_extended (10 per module) ───────────────────────────────
      const tcDefs = [
        {
          key: `${mk}-TC001`, name: `${mod.name}: Happy Path E2E`, level: 'e2e', polarity: 'positive',
          scenario_type: 'happy_path', priority: 'critical',
          precondition: `${mod.name} module is enabled; user is authenticated`,
          steps: JSON.stringify([
            { step: 1, action: `Navigate to ${customerRoute}`, expected: 'Page loads without error' },
            { step: 2, action: mod.user_flow ? mod.user_flow.slice(0, 150) : `Use ${mod.name} main feature`, expected: 'Feature executes successfully' },
            { step: 3, action: 'Verify output/result', expected: 'Expected outcome matches specification' },
          ]),
          expected_result: `${mod.name} completes its primary user flow successfully`,
          api_endpoint: apiEndpoint, http_method: 'GET', expected_status: 200,
          tags: JSON.stringify(['e2e', 'happy-path', 'smoke']),
        },
        {
          key: `${mk}-TC002`, name: `${mod.name}: Invalid Input Rejection`, level: 'api', polarity: 'negative',
          scenario_type: 'error_path', priority: 'high',
          precondition: 'API is accessible',
          steps: JSON.stringify([
            { step: 1, action: `POST to ${apiEndpoint} with invalid payload`, expected: '4xx error returned' },
            { step: 2, action: 'Verify error message is descriptive', expected: 'Error body contains field-level details' },
          ]),
          expected_result: 'Returns 400/422 with validation error message',
          api_endpoint: apiEndpoint, http_method: 'POST', expected_status: 400,
          tags: JSON.stringify(['api', 'negative', 'validation']),
        },
        {
          key: `${mk}-TC003`, name: `${mod.name}: Boundary Value Test`, level: 'api', polarity: 'boundary',
          scenario_type: 'edge_case', priority: 'medium',
          precondition: 'API is accessible',
          steps: JSON.stringify([
            { step: 1, action: 'Submit maximum allowed field lengths', expected: 'Accepted or rejected at exact boundary' },
            { step: 2, action: 'Submit zero/null values', expected: 'Graceful handling without crash' },
          ]),
          expected_result: 'Boundary inputs handled without 500 errors',
          api_endpoint: apiEndpoint, http_method: 'POST', expected_status: null,
          tags: JSON.stringify(['boundary', 'edge-case']),
        },
        {
          key: `${mk}-TC004`, name: `${mod.name}: API GET Smoke Test`, level: 'api', polarity: 'positive',
          scenario_type: 'happy_path', priority: 'critical',
          precondition: 'Service is running',
          steps: JSON.stringify([
            { step: 1, action: `GET ${apiEndpoint}`, expected: '200 OK response' },
            { step: 2, action: 'Verify response has expected JSON shape', expected: 'Response contains data array or object' },
          ]),
          expected_result: 'Returns 200 with JSON body',
          api_endpoint: apiEndpoint, http_method: 'GET', expected_status: 200,
          tags: JSON.stringify(['api', 'smoke', 'get']),
        },
        {
          key: `${mk}-TC005`, name: `${mod.name}: API POST Create`, level: 'api', polarity: 'positive',
          scenario_type: 'happy_path', priority: 'high',
          precondition: 'User is admin; required fields are provided',
          steps: JSON.stringify([
            { step: 1, action: `POST to ${apiEndpoint} with valid payload`, expected: '201/200 response' },
            { step: 2, action: 'Verify record exists in DB', expected: 'New record has correct field values' },
          ]),
          expected_result: 'Record created; returns 200 or 201 with new record id',
          api_endpoint: apiEndpoint, http_method: 'POST', expected_status: 200,
          tags: JSON.stringify(['api', 'create', 'positive']),
        },
        {
          key: `${mk}-TC006`, name: `${mod.name}: API Missing Required Field`, level: 'api', polarity: 'negative',
          scenario_type: 'error_path', priority: 'high',
          precondition: 'API is accessible',
          steps: JSON.stringify([
            { step: 1, action: `POST to ${apiEndpoint} with missing required fields`, expected: '400 Bad Request' },
            { step: 2, action: 'Check error message names missing field', expected: 'Error body identifies field' },
          ]),
          expected_result: 'Returns 400 with field-level validation error',
          api_endpoint: apiEndpoint, http_method: 'POST', expected_status: 400,
          tags: JSON.stringify(['api', 'negative', 'validation', 'missing-field']),
        },
        {
          key: `${mk}-TC007`, name: `${mod.name}: UI Form Validation`, level: 'ui', polarity: 'positive',
          scenario_type: 'happy_path', priority: 'medium',
          precondition: `Admin is on ${adminRoute}`,
          steps: JSON.stringify([
            { step: 1, action: 'Open main form', expected: 'Form renders with all required fields visible' },
            { step: 2, action: 'Submit form with valid data', expected: 'Success toast/message shown' },
            { step: 3, action: 'Verify data persisted', expected: 'Record appears in list after submit' },
          ]),
          expected_result: 'Form submits successfully and data is saved',
          api_endpoint: null, http_method: null, expected_status: null,
          ui_field: 'main form',
          tags: JSON.stringify(['ui', 'form', 'validation']),
        },
        {
          key: `${mk}-TC008`, name: `${mod.name}: Admin Flow E2E`, level: 'e2e', polarity: 'positive',
          scenario_type: 'admin flow', priority: 'critical',
          precondition: 'User has admin role',
          steps: JSON.stringify([
            { step: 1, action: `Navigate to ${adminRoute}`, expected: 'Admin page loads' },
            { step: 2, action: mod.admin_flow ? mod.admin_flow.slice(0, 150) : 'Perform admin management action', expected: 'Action completes' },
            { step: 3, action: 'Verify changes reflected', expected: 'Updated data shown in UI' },
          ]),
          expected_result: 'Admin can fully manage this module from admin portal',
          api_endpoint: apiEndpoint, http_method: 'GET', expected_status: 200,
          tags: JSON.stringify(['e2e', 'admin', 'flow']),
        },
        {
          key: `${mk}-TC009`, name: `${mod.name}: Tenant Isolation`, level: 'e2e', polarity: 'positive',
          scenario_type: 'tenant', priority: 'high',
          precondition: 'Two tenants exist: yoga_studio and fitness_center',
          steps: JSON.stringify([
            { step: 1, action: 'Log in as yoga_studio tenant admin', expected: 'Only yoga_studio data visible' },
            { step: 2, action: 'Log in as fitness_center tenant admin', expected: 'Only fitness_center data visible' },
            { step: 3, action: 'Verify cross-tenant data leak impossible', expected: 'No data from other tenant returned' },
          ]),
          expected_result: 'Tenant data is fully isolated; no cross-tenant data leakage',
          api_endpoint: apiEndpoint, http_method: 'GET', expected_status: 200,
          tags: JSON.stringify(['tenant', 'isolation', 'security']),
        },
        {
          key: `${mk}-TC010`, name: `${mod.name}: Agentic/Ollama Integration`, level: 'integration', polarity: 'positive',
          scenario_type: 'agentic', priority: 'medium',
          precondition: 'Ollama llama3.2 model is running on localhost:11434',
          steps: JSON.stringify([
            { step: 1, action: `Trigger ${mod.job_name ?? mk + ' job'} via agentic runner`, expected: 'Ollama receives prompt' },
            { step: 2, action: 'Verify Ollama response is used in workflow', expected: 'AI-generated content saved to DB' },
            { step: 3, action: 'Check output quality', expected: 'Output is non-empty, relevant to module domain' },
          ]),
          expected_result: 'Agentic job completes with Ollama-generated output persisted',
          api_endpoint: `/api/admin/cron/run/${mod.job_name ?? mk}`, http_method: 'POST', expected_status: 200,
          tags: JSON.stringify(['ollama', 'ai', 'agentic', 'job']),
        },
      ];

      for (const tc of tcDefs) {
        const res = await client.query(
          `INSERT INTO test_case_extended (plan_id, module_key, case_key, name, test_level, polarity,
            scenario_type, precondition, steps, expected_result, api_endpoint, ui_field, http_method,
            expected_status, tags, priority, status)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11,$12,$13,$14,$15::text[],$16,'pending')
           ON CONFLICT (case_key) DO NOTHING`,
          [
            planId, mk, tc.key, tc.name, tc.level, tc.polarity,
            tc.scenario_type, tc.precondition, tc.steps, tc.expected_result,
            tc.api_endpoint ?? null, (tc as { ui_field?: string }).ui_field ?? null,
            tc.http_method ?? null, tc.expected_status ?? null,
            `{${JSON.parse(tc.tags).join(',')}}`, tc.priority,
          ],
        );
        if (res.rowCount && res.rowCount > 0) counters.cases++;
      }

      // ── module_scenario (8 per module) ───────────────────────────────────
      const scenarios = [
        {
          category: 'user_flow', name: `${mod.name}: Customer User Flow`,
          description: mod.user_flow ?? `Customer completes primary ${mod.name} workflow`,
          actors: '{customer}',
          steps: JSON.stringify([{ step: 1, action: mod.user_flow?.slice(0, 200) ?? `Use ${mod.name}`, expected: 'Flow completes' }]),
          expected_outcome: 'Customer achieves their goal within this module',
        },
        {
          category: 'admin_flow', name: `${mod.name}: Admin Management Flow`,
          description: mod.admin_flow ?? `Admin manages ${mod.name} from admin portal`,
          actors: '{admin}',
          steps: JSON.stringify([{ step: 1, action: mod.admin_flow?.slice(0, 200) ?? `Manage ${mod.name}`, expected: 'Admin action completes' }]),
          expected_outcome: 'Admin successfully manages module configuration and data',
        },
        {
          category: 'agentic', name: `${mod.name}: Ollama Agentic Automation`,
          description: `Ollama llama3.2 autonomously processes ${mod.name} data and generates insights or actions`,
          actors: '{system,agent}',
          steps: JSON.stringify([
            { step: 1, action: 'Cron triggers agentic job', expected: 'Job starts' },
            { step: 2, action: 'Ollama processes module data', expected: 'AI output generated' },
            { step: 3, action: 'Result stored in DB', expected: 'Persisted for human review' },
          ]),
          expected_outcome: 'AI-driven insight or draft content ready for review',
        },
        {
          category: 'integration', name: `${mod.name}: ${integration} Integration`,
          description: `${mod.name} integrates with ${integration} to sync data and trigger actions`,
          actors: '{system,admin}',
          steps: JSON.stringify([
            { step: 1, action: `Connect ${integration} account`, expected: 'Auth successful' },
            { step: 2, action: 'Sync data bidirectionally', expected: 'Records match across systems' },
          ]),
          expected_outcome: `${integration} integration active and data synchronized`,
          integration_platform: integration,
        },
        {
          category: 'alert', name: `${mod.name}: Anomaly Alert`,
          description: `System detects data anomaly in ${mod.name} and sends alert to admin`,
          actors: '{system,admin}',
          steps: JSON.stringify([
            { step: 1, action: 'Threshold breached in module data', expected: 'Alert triggered' },
            { step: 2, action: 'Notification sent to configured channels', expected: 'Admin receives alert' },
          ]),
          expected_outcome: 'Admin is notified in time to take corrective action',
        },
        {
          category: 'job', name: `${mod.name}: Scheduled Job Run`,
          description: `${mod.job_name ?? 'Scheduled job'} runs on schedule to process ${mod.name} data`,
          actors: '{system}',
          steps: JSON.stringify([
            { step: 1, action: `${mod.job_name ?? 'Job'} triggers on schedule`, expected: 'Job starts without error' },
            { step: 2, action: 'Data processed and results stored', expected: 'DB records updated' },
          ]),
          expected_outcome: 'Job completes, results stored, no unhandled errors',
        },
        {
          category: 'tenant', name: `${mod.name}: Multi-Tenant Isolation`,
          description: `Yoga studio and fitness center both use ${mod.name} with isolated data`,
          actors: '{admin,customer}',
          steps: JSON.stringify([
            { step: 1, action: 'Yoga studio creates data in module', expected: 'Data scoped to yoga_studio tenant' },
            { step: 2, action: 'Fitness center accesses same module', expected: 'Cannot see yoga_studio data' },
          ]),
          expected_outcome: 'Full data isolation across tenants confirmed',
        },
        {
          category: 'report', name: `${mod.name}: Report Generation`,
          description: `${mod.name} report at ${mod.report_location ?? 'report location'} shows accurate metrics`,
          actors: '{admin}',
          steps: JSON.stringify([
            { step: 1, action: `Navigate to ${mod.report_location ?? `/admin/${mk}`}`, expected: 'Report page loads' },
            { step: 2, action: 'Apply date filter', expected: 'Data updates correctly' },
            { step: 3, action: 'Export report', expected: 'CSV/PDF downloaded' },
          ]),
          expected_outcome: 'Report accurately reflects module data with correct aggregations',
        },
      ];

      for (const sc of scenarios) {
        const res = await client.query(
          `INSERT INTO module_scenario (module_key, scenario_category, scenario_name, description,
            actors, steps, expected_outcome, integration_platform, is_automated)
           VALUES ($1,$2,$3,$4,$5::text[],$6::jsonb,$7,$8,false)`,
          [mk, sc.category, sc.name, sc.description, sc.actors,
            sc.steps, sc.expected_outcome, (sc as { integration_platform?: string }).integration_platform ?? null],
        );
        if (res.rowCount && res.rowCount > 0) counters.scenarios++;
      }

      // ── module_nav_map (2 per module) ─────────────────────────────────────
      const navItems = [
        {
          portal: 'customer', screen_name: `${mod.name} - Customer View`,
          route: customerRoute, parent_route: '/customer',
          ui_elements: JSON.stringify([
            { label: 'Main Content', type: 'section', required: true, validation: null },
            { label: 'Action Button', type: 'button', required: false, validation: null },
          ]),
          actions: JSON.stringify([
            { action: 'view', api_endpoint: apiEndpoint, method: 'GET' },
          ]),
          breadcrumb: `Home > ${mod.name}`,
        },
        {
          portal: 'admin', screen_name: `${mod.name} - Admin Panel`,
          route: adminRoute, parent_route: '/admin',
          ui_elements: JSON.stringify([
            { label: 'Data Table', type: 'table', required: true, validation: null },
            { label: 'Create Button', type: 'button', required: false, validation: null },
            { label: 'Filter Bar', type: 'filter', required: false, validation: null },
          ]),
          actions: JSON.stringify([
            { action: 'list', api_endpoint: apiEndpoint, method: 'GET' },
            { action: 'create', api_endpoint: apiEndpoint, method: 'POST' },
          ]),
          breadcrumb: `Admin > ${mod.name}`,
        },
      ];

      for (const nav of navItems) {
        const res = await client.query(
          `INSERT INTO module_nav_map (module_key, portal, screen_name, route, parent_route, ui_elements, actions, breadcrumb)
           VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8)`,
          [mk, nav.portal, nav.screen_name, nav.route, nav.parent_route,
            nav.ui_elements, nav.actions, nav.breadcrumb],
        );
        if (res.rowCount && res.rowCount > 0) counters.navMaps++;
      }

      // ── module_alert_scenario (2 per module) ──────────────────────────────
      const alerts = [
        {
          name: `${mod.name}: Data Anomaly Alert`,
          trigger: `${mod.name} records show unexpected spike or drop exceeding threshold`,
          threshold: '> 3x standard deviation from 7-day rolling average',
          severity: 'high', channels: '{email,slack}',
          remediation: 'Investigate data source; check upstream integrations; verify cron job status',
          payload: JSON.stringify({ module: mk, metric: 'record_count', deviation: 3.5, timestamp: '2026-09-15T06:00:00Z' }),
        },
        {
          name: `${mod.name}: System Health Alert`,
          trigger: `${mod.name} API endpoint returns 5xx errors for > 3 consecutive requests`,
          threshold: '3 consecutive failures or error rate > 10% in 5-minute window',
          severity: 'critical', channels: '{email,pagerduty,slack}',
          remediation: 'Check application logs; restart service if OOM; verify DB connection pool',
          payload: JSON.stringify({ module: mk, endpoint: apiEndpoint, error_rate: 0.15, last_error: '500 Internal Server Error' }),
        },
      ];

      for (const alert of alerts) {
        const res = await client.query(
          `INSERT INTO module_alert_scenario (module_key, alert_name, trigger_condition, threshold,
            severity, notification_channels, auto_remediation, example_payload, is_configured)
           VALUES ($1,$2,$3,$4,$5,$6::text[],$7,$8::jsonb,false)`,
          [mk, alert.name, alert.trigger, alert.threshold,
            alert.severity, alert.channels, alert.remediation, alert.payload],
        );
        if (res.rowCount && res.rowCount > 0) counters.alerts++;
      }

      // ── module_tenant_scenario (3 per module) ─────────────────────────────
      const tenantTypes = [
        {
          type: 'yoga_studio',
          scenario: `${mod.name} for Yoga Studio`,
          description: `A boutique yoga studio uses ${mod.name} to manage ${mod.name.toLowerCase()} for class members and instructors`,
          isolation: 'Tenant ID scoped at query level; no cross-studio data access',
          config: JSON.stringify({ brand_color: '#8b5cf6', class_types: ['hatha', 'vinyasa', 'yin'], timezone: 'America/Toronto' }),
          seed: `INSERT INTO module_registry_tenant (module_key, tenant_type, tenant_id) VALUES ('${mk}', 'yoga_studio', 'demo-yoga-studio-01');`,
        },
        {
          type: 'fitness_center',
          scenario: `${mod.name} for Fitness Center`,
          description: `A gym/fitness center uses ${mod.name} to manage ${mod.name.toLowerCase()} for gym members and personal trainers`,
          isolation: 'Tenant ID scoped at query level; no cross-gym data access',
          config: JSON.stringify({ brand_color: '#ef4444', class_types: ['HIIT', 'spin', 'weights', 'cardio'], timezone: 'America/New_York' }),
          seed: `INSERT INTO module_registry_tenant (module_key, tenant_type, tenant_id) VALUES ('${mk}', 'fitness_center', 'demo-fitness-center-01');`,
        },
        {
          type: 'wellness_brand',
          scenario: `${mod.name} for Wellness Brand`,
          description: `A D2C wellness brand uses ${mod.name} for ${mod.name.toLowerCase()} across online and offline channels`,
          isolation: 'Brand-level data scoping; product catalog isolated per brand',
          config: JSON.stringify({ brand_color: '#10b981', channels: ['web', 'mobile', 'social', 'retail'], timezone: 'UTC' }),
          seed: `INSERT INTO module_registry_tenant (module_key, tenant_type, tenant_id) VALUES ('${mk}', 'wellness_brand', 'demo-wellness-brand-01');`,
        },
      ];

      for (const t of tenantTypes) {
        const res = await client.query(
          `INSERT INTO module_tenant_scenario (module_key, tenant_type, scenario_name, description,
            data_isolation_notes, custom_config, test_tenant_seed_sql)
           VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7)`,
          [mk, t.type, t.scenario, t.description, t.isolation, t.config, t.seed],
        );
        if (res.rowCount && res.rowCount > 0) counters.tenants++;
      }

      // ── test_dataset (1 per module) ───────────────────────────────────────
      const schemaFields: Record<string, string> = {
        id: 'uuid', module_key: 'text', tenant_id: 'text',
        created_at: 'timestamptz', status: 'text', name: 'text',
        value: 'numeric', description: 'text',
      };
      const sampleRows = Array.from({ length: 5 }, (_, i) => ({
        id: `00000000-0000-0000-0000-00000000000${i + 1}`,
        module_key: mk, tenant_id: `demo-tenant-0${(i % 3) + 1}`,
        created_at: `2026-09-${String(i + 10).padStart(2, '0')}T10:00:00Z`,
        status: ['active', 'pending', 'completed', 'draft', 'archived'][i],
        name: `${mod.name} Sample ${i + 1}`,
        value: (i + 1) * 100,
        description: `Synthetic test record ${i + 1} for ${mod.name}`,
      }));

      const res = await client.query(
        `INSERT INTO test_dataset (module_key, dataset_name, source, record_count, schema_definition, sample_rows, status, generated_by)
         VALUES ($1,$2,'synthetic',5,$3::jsonb,$4::jsonb,'available','system')`,
        [mk, `${mod.name} Synthetic Dataset`, JSON.stringify(schemaFields), JSON.stringify(sampleRows)],
      );
      if (res.rowCount && res.rowCount > 0) counters.datasets++;
    }
  });
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const statusOnly = searchParams.get('status') === 'true';

  await ensureSchema();

  // Return quick status if requested
  if (statusOnly) {
    const [plans, cases, scenarios, nav, alerts, tenants, datasets] = await Promise.all([
      query('SELECT COUNT(*) FROM test_plan'),
      query('SELECT COUNT(*) FROM test_case_extended'),
      query('SELECT COUNT(*) FROM module_scenario'),
      query('SELECT COUNT(*) FROM module_nav_map'),
      query('SELECT COUNT(*) FROM module_alert_scenario'),
      query('SELECT COUNT(*) FROM module_tenant_scenario'),
      query('SELECT COUNT(*) FROM test_dataset'),
    ]);
    return NextResponse.json({
      test_plans: parseInt(plans.rows[0].count),
      test_cases: parseInt(cases.rows[0].count),
      scenarios: parseInt(scenarios.rows[0].count),
      nav_maps: parseInt(nav.rows[0].count),
      alerts: parseInt(alerts.rows[0].count),
      tenants: parseInt(tenants.rows[0].count),
      datasets: parseInt(datasets.rows[0].count),
    });
  }

  // Fire-and-forget seed
  setImmediate(async () => {
    try {
      const modules = await query<ModuleRow>(
        `SELECT module_key, name, built_status, user_flow, admin_flow, job_name,
                report_location, dashboard_location, integration_platforms
         FROM module_registry
         ORDER BY module_key`,
      );

      const counters = { plans: 0, cases: 0, scenarios: 0, navMaps: 0, alerts: 0, tenants: 0, datasets: 0 };
      const all = modules.rows;
      const batchSize = 20;

      for (let i = 0; i < all.length; i += batchSize) {
        const batch = all.slice(i, i + batchSize);
        await seedBatch(batch, counters);
        console.log(`[ModuleIntelligenceSeed] Batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(all.length / batchSize)} done`);
      }

      console.log(`[ModuleIntelligenceSeed] Complete:`, counters);
    } catch (err) {
      console.error('[ModuleIntelligenceSeed] Error:', err);
    }
  });

  return NextResponse.json({ status: 'started', message: 'Seed running in background. Poll GET /api/admin/module-intelligence/seed?status=true to check counts.' });
}
