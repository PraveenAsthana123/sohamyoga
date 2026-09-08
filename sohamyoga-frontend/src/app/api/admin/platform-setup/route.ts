import { NextRequest } from 'next/server';
import { getAdminPrincipal } from '@/lib/admin-auth';
import { databaseConfigured, query } from '@/lib/postgres';
import { vaultRead, vaultWrite } from '@/lib/openbao';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface CredentialField { field: string; description?: string }
interface SetupRow {
  category: string;
  required_credentials: CredentialField[];
  credential_reference: string | null;
  configured_fields: string[];
  last_connection_test_status: string | null;
}

const publicColumns = `id, platform_key, platform_name, category, status, is_active,
  required_credentials, configured_fields, credential_reference IS NOT NULL AS has_credentials,
  setup_instructions, code_reference, use_cases, demo_scenario, automation_job, monitoring_query,
  last_verified_at, last_connection_test_at, last_connection_test_status,
  last_connection_test_detail, last_error_at, last_error_message, updated_at`;

function cleanCredentials(input: unknown, allowed: Set<string>): Record<string, string> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {};
  const result: Record<string, string> = {};
  for (const [field, raw] of Object.entries(input)) {
    if (!allowed.has(field)) throw new Error(`Unknown credential field: ${field}`);
    if (typeof raw !== 'string') throw new Error(`${field} must be a string.`);
    const value = raw.trim();
    if (!value) continue;
    if (value.length > 8192) throw new Error(`${field} exceeds the 8192-character limit.`);
    result[field] = value;
  }
  return result;
}

// Metadata/status only. Raw secrets and vault references never leave the server.
export async function GET(req: NextRequest) {
  const denied = (await getAdminPrincipal(req)).denied;
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const [platforms, socialAccounts, events, scenarios, responseSummary, operationSummary, assetSummary] = await Promise.all([
    query(`SELECT ${publicColumns} FROM platform_setup ORDER BY category, platform_name`),
    query<{ platform: string; status: string }>(`SELECT platform, status FROM social_account`),
    query(`SELECT platform_key, event_type, outcome, detail, created_at
           FROM platform_setup_event ORDER BY created_at DESC LIMIT 250`),
    query(`SELECT scenario_key,category,title,description,direction,asset_types,platform_keys,
                  execution_mode,tracking_events,required_capabilities,demo_steps,scale_profile,status
           FROM integration_scenario ORDER BY category,title`),
    query(`SELECT
             (SELECT count(*)::int FROM customer_channel_thread) AS threads,
             (SELECT count(*)::int FROM customer_channel_thread WHERE status NOT IN ('resolved','spam')) AS open_threads,
             (SELECT count(*)::int FROM customer_channel_event) AS events,
             (SELECT count(*)::int FROM marketing_response_work_item WHERE status='needs_review') AS needs_review`),
    query(`SELECT status,count(*)::int AS count FROM operation_run GROUP BY status ORDER BY status`),
    query(`SELECT asset_type,status,count(*)::int AS count FROM generated_marketing_asset
           GROUP BY asset_type,status ORDER BY asset_type,status`),
  ]);

  // Real per-platform connection state, joined where it actually exists --
  // never a fabricated "connected" status.
  const connectedSocial = new Set(socialAccounts.rows.filter(r => r.status === 'connected').map(r => r.platform));
  const rows = platforms.rows as any[];

  return Response.json({
    platforms: rows.map(p => ({ ...p, sociallyConnected: connectedSocial.has(p.platform_key) })),
    events: events.rows,
    scenarios: scenarios.rows,
    responseSummary: responseSummary.rows[0] ?? { threads: 0, open_threads: 0, events: 0, needs_review: 0 },
    operationSummary: operationSummary.rows,
    assetSummary: assetSummary.rows,
    tally: {
      total: rows.length,
      configured: rows.filter(p => p.status === 'configured' || p.status === 'verified').length,
      verified: rows.filter(p => p.status === 'verified').length,
      active: rows.filter(p => p.is_active).length,
      connected: connectedSocial.size,
    },
  });
}

export async function PATCH(req: NextRequest) {
  const { principal, denied } = await getAdminPrincipal(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const body = await req.json().catch(() => null) as {
    platformKey?: string; credentialValues?: Record<string, string>; isActive?: boolean;
  } | null;
  if (!body?.platformKey) return Response.json({ error: 'platformKey is required.' }, { status: 400 });
  if (body.platformKey.length > 100) return Response.json({ error: 'Invalid platformKey.' }, { status: 400 });

  const found = await query<SetupRow>(
    `SELECT category, required_credentials, credential_reference, configured_fields,
            last_connection_test_status
     FROM platform_setup WHERE platform_key = $1`, [body.platformKey],
  );
  if (!found.rowCount) return Response.json({ error: 'Unknown platform.' }, { status: 404 });
  const existing = found.rows[0];
  const requiredFields = (existing.required_credentials || []).map(f => f.field);
  const allowed = new Set(requiredFields);
  let configuredFields = existing.configured_fields || [];
  let credentialReference = existing.credential_reference;

  if (body.credentialValues !== undefined) {
    let incoming: Record<string, string>;
    try {
      incoming = cleanCredentials(body.credentialValues, allowed);
    } catch (err) {
      return Response.json({ error: err instanceof Error ? err.message : 'Invalid credentials.' }, { status: 400 });
    }
    if (!Object.keys(incoming).length) {
      return Response.json({ error: 'Enter at least one non-empty credential value.' }, { status: 400 });
    }
    const previous = credentialReference
      ? await vaultRead<Record<string, string>>(credentialReference) ?? {}
      : {};
    const merged = { ...previous, ...incoming };
    try {
      credentialReference = await vaultWrite(
        `sohamyoga-portal/platform-setup/${body.platformKey}/credentials`, merged,
      );
    } catch (err) {
      return Response.json({ error: err instanceof Error ? err.message : 'Vault write failed.' }, { status: 502 });
    }
    configuredFields = requiredFields.filter(field => Boolean(merged[field]?.trim()));
    await query(
      `INSERT INTO platform_setup_event(platform_key,event_type,outcome,detail,actor_id)
       VALUES($1,'credentials_saved','success',$2,$3)`,
      [body.platformKey, `${configuredFields.length}/${requiredFields.length} required fields stored in OpenBao.`, principal!.id],
    );
  }

  const hasAll = requiredFields.length === 0 || requiredFields.every(field => configuredFields.includes(field));
  if (body.isActive === true && !hasAll) {
    return Response.json({ error: 'All required credential fields must be stored before activation.' }, { status: 409 });
  }
  const newStatus = existing.last_connection_test_status === 'passed'
    ? 'verified'
    : hasAll && credentialReference ? 'configured'
      : configuredFields.length ? 'partial' : 'not_configured';

  await query(
    `UPDATE platform_setup SET credential_reference=$2, configured_fields=$3::jsonb,
       is_active=COALESCE($4,is_active), status=$5, updated_at=now()
     WHERE platform_key=$1`,
    [body.platformKey, credentialReference, JSON.stringify(configuredFields), body.isActive ?? null, newStatus],
  );
  if (body.isActive !== undefined) {
    await query(
      `INSERT INTO platform_setup_event(platform_key,event_type,outcome,detail,actor_id)
       VALUES($1,$2,'success',$3,$4)`,
      [body.platformKey, body.isActive ? 'activated' : 'deactivated',
       body.isActive ? 'Integration enabled by an administrator.' : 'Integration disabled by an administrator.', principal!.id],
    );
  }

  const result = await query(`SELECT ${publicColumns} FROM platform_setup WHERE platform_key=$1`, [body.platformKey]);
  return Response.json({ platform: result.rows[0] });
}
