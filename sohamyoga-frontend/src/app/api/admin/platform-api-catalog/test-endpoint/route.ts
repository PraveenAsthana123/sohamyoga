import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/postgres';
import { ensurePlatformApiCatalogSchema } from '@/lib/platform-api-catalog-schema';

interface TestRequest {
  offering_id: string;
  test_type?: string;
}

interface OfferingRow {
  id: string;
  platform: string;
  endpoint_path: string;
  http_method: string;
  required_env_vars: string[];
  auth_type: string;
  api_version: string | null;
  api_name: string;
}

export async function POST(req: NextRequest) {
  await ensurePlatformApiCatalogSchema();
  const body = await req.json() as TestRequest;
  const { offering_id, test_type = 'smoke' } = body;

  if (!offering_id) {
    return NextResponse.json({ error: 'offering_id is required' }, { status: 400 });
  }

  const offeringResult = await query<OfferingRow>(
    'SELECT * FROM platform_api_offering WHERE id = $1',
    [offering_id],
  );
  if (offeringResult.rowCount === 0) {
    return NextResponse.json({ error: 'Offering not found' }, { status: 404 });
  }

  const offering = offeringResult.rows[0];

  // Check if required env vars are set
  const missingVars = (offering.required_env_vars ?? []).filter(
    (v: string) => !process.env[v],
  );

  if (missingVars.length > 0) {
    await query(
      `INSERT INTO platform_api_test_result
         (offering_id, platform, endpoint_path, http_method, test_type, status, error_message, run_at)
       VALUES ($1, $2, $3, $4, $5, 'skip', $6, NOW())`,
      [
        offering_id,
        offering.platform,
        offering.endpoint_path,
        offering.http_method,
        test_type,
        `Credentials not configured: ${missingVars.join(', ')}`,
      ],
    );
    return NextResponse.json({
      status: 'skip',
      message: `Credentials not configured: ${missingVars.join(', ')}`,
      offering_id,
    });
  }

  // Attempt a real API call for known platform patterns
  const startTime = Date.now();
  let httpStatus: number | null = null;
  let responsePreview: string | null = null;
  let errorMessage: string | null = null;
  let testStatus: 'pass' | 'fail' | 'skip' | 'timeout' = 'skip';

  try {
    const result = await callPlatformEndpoint(offering);
    httpStatus = result.httpStatus;
    responsePreview = result.responsePreview;
    testStatus = result.httpStatus < 400 ? 'pass' : 'fail';
    if (result.httpStatus >= 400) {
      errorMessage = `HTTP ${result.httpStatus}`;
    }
  } catch (err) {
    testStatus = 'fail';
    errorMessage = err instanceof Error ? err.message : String(err);
  }

  const responseTimeMs = Date.now() - startTime;

  await query(
    `INSERT INTO platform_api_test_result
       (offering_id, platform, endpoint_path, http_method, test_type, status, http_status, response_time_ms, error_message, response_preview, run_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())`,
    [
      offering_id,
      offering.platform,
      offering.endpoint_path,
      offering.http_method,
      test_type,
      testStatus,
      httpStatus,
      responseTimeMs,
      errorMessage,
      responsePreview,
    ],
  );

  // Update offering with result
  if (testStatus === 'pass') {
    await query(
      `UPDATE platform_api_offering SET last_verified_at = NOW(), last_error = NULL, success_count_30d = success_count_30d + 1 WHERE id = $1`,
      [offering_id],
    );
  } else if (testStatus === 'fail') {
    await query(
      `UPDATE platform_api_offering SET last_error = $1, error_count_30d = error_count_30d + 1 WHERE id = $2`,
      [errorMessage, offering_id],
    );
  }

  return NextResponse.json({
    status: testStatus,
    http_status: httpStatus,
    response_time_ms: responseTimeMs,
    response_preview: responsePreview,
    error_message: errorMessage,
    offering_id,
  });
}

async function callPlatformEndpoint(offering: OfferingRow): Promise<{
  httpStatus: number;
  responsePreview: string;
}> {
  const { platform, auth_type } = offering;

  // Build a simple probe request based on platform + auth_type
  let url: string | null = null;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };

  if (platform === 'telegram') {
    const token = process.env['TELEGRAM_BOT_TOKEN'];
    if (token) {
      url = `https://api.telegram.org/bot${token}/getMe`;
    }
  } else if (platform === 'discord' && offering.endpoint_path.startsWith('/api/v10')) {
    const botToken = process.env['DISCORD_BOT_TOKEN'];
    if (botToken) {
      url = `https://discord.com/api/v10/users/@me`;
      headers['Authorization'] = `Bot ${botToken}`;
    }
  } else if (platform === 'vimeo') {
    const token = process.env['VIMEO_ACCESS_TOKEN'];
    if (token) {
      url = 'https://api.vimeo.com/me';
      headers['Authorization'] = `bearer ${token}`;
    }
  } else if (platform === 'github') {
    const token = process.env['GITHUB_TOKEN'];
    if (token) {
      url = 'https://api.github.com/user';
      headers['Authorization'] = `Bearer ${token}`;
    }
  } else if (platform === 'medium') {
    const token = process.env['MEDIUM_INTEGRATION_TOKEN'];
    if (token) {
      url = 'https://api.medium.com/v1/me';
      headers['Authorization'] = `Bearer ${token}`;
    }
  } else if (auth_type === 'api_key' && platform === 'trustpilot') {
    const key = process.env['TRUSTPILOT_API_KEY'];
    if (key) {
      url = `https://api.trustpilot.com/v1/resources/images`;
      headers['apikey'] = key;
    }
  } else if (platform === 'yelp') {
    const key = process.env['YELP_API_KEY'];
    if (key) {
      url = 'https://api.yelp.com/v3/businesses/search?term=yoga&location=toronto&limit=1';
      headers['Authorization'] = `Bearer ${key}`;
    }
  }

  if (!url) {
    // No probe URL available for this platform yet
    return { httpStatus: 0, responsePreview: 'No probe URL implemented for this platform' };
  }

  const res = await fetch(url, { headers, signal: AbortSignal.timeout(10_000) });
  const text = await res.text().catch(() => '');
  return {
    httpStatus: res.status,
    responsePreview: text.slice(0, 500),
  };
}
