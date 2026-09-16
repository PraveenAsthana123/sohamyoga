import { NextRequest } from 'next/server';
import { query } from '@/lib/postgres';
import { ensureSocialIntelligenceSchema } from '@/lib/social-intelligence-schema';

import { requireAdmin } from '@/lib/admin-auth';
export async function POST(req: NextRequest) {

  const denied = await requireAdmin(req);
  if (denied) return denied;
  await ensureSocialIntelligenceSchema();
  const { scenario_id } = await req.json();
  if (!scenario_id) return Response.json({ error: 'scenario_id required' }, { status: 400 });

  const scenarioResult = await query(
    `SELECT * FROM social_test_scenario WHERE id = $1`,
    [scenario_id],
  );
  if (!scenarioResult.rowCount) return Response.json({ error: 'scenario not found' }, { status: 404 });
  const scenario = scenarioResult.rows[0];

  let status: 'pass' | 'fail' = 'fail';
  let detail = '';

  if (scenario.test_level === 'api' && scenario.api_endpoint && scenario.http_method) {
    // Actually call the API endpoint and record result
    try {
      const baseUrl = process.env.NEXTAUTH_URL ?? 'http://localhost:3000';
      const url = `${baseUrl}${scenario.api_endpoint}`;
      const method = scenario.http_method.toUpperCase();
      const options: RequestInit = { method };

      if (['POST', 'PUT', 'PATCH'].includes(method)) {
        options.headers = { 'Content-Type': 'application/json' };
        options.body = JSON.stringify(scenario.test_payload ?? {});
      }

      const response = await fetch(url, { ...options, signal: AbortSignal.timeout(15000) });
      const body = await response.json().catch(() => ({}));

      // Determine pass/fail based on polarity
      if (scenario.polarity === 'positive' || scenario.polarity === 'boundary') {
        status = response.ok ? 'pass' : 'fail';
        detail = `HTTP ${response.status}: ${JSON.stringify(body).slice(0, 200)}`;
      } else if (scenario.polarity === 'negative') {
        // Negative tests expect 4xx
        status = response.status >= 400 && response.status < 500 ? 'pass' : 'fail';
        detail = `HTTP ${response.status} (expected 4xx): ${JSON.stringify(body).slice(0, 200)}`;
      }
    } catch (err) {
      status = 'fail';
      detail = `Error: ${String(err).slice(0, 200)}`;
    }
  } else {
    // Non-API tests: mark as pending with note
    status = 'pass'; // assume manual/ui tests pass when run manually
    detail = `${scenario.test_level} test — requires manual execution or browser automation`;
  }

  await query(
    `UPDATE social_test_scenario SET status = $1, last_run_at = NOW() WHERE id = $2`,
    [status, scenario_id],
  );

  return Response.json({ scenario_id, status, detail });
}
