import { NextRequest } from 'next/server';
import { listOllamaModels, OLLAMA_MODEL } from '@/lib/ollama';
import { databaseConfigured, query } from '@/lib/postgres';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(req: NextRequest) {
  const models = await listOllamaModels();
  const sorted = Array.from(new Set(models)).sort();
  const defaultModel = sorted.includes(OLLAMA_MODEL) ? OLLAMA_MODEL : sorted[0] || OLLAMA_MODEL;

  const tenantId = req.nextUrl.searchParams.get('tenantId') || req.headers.get('x-tenant-id');
  let settings: Record<string, { enabled: boolean; isDefault: boolean; purpose: string }> = {};
  if (tenantId && UUID.test(tenantId) && databaseConfigured()) {
    const result = await query<{ model_name: string; enabled: boolean; is_default: boolean; purpose: string }>(
      `SELECT model_name, enabled, is_default, purpose FROM tenant_ai_model WHERE tenant_id=$1`,
      [tenantId],
    );
    settings = Object.fromEntries(result.rows.map(row => [row.model_name, {
      enabled: row.enabled,
      isDefault: row.is_default,
      purpose: row.purpose,
    }]));
  }

  return Response.json({
    models: sorted.map(name => ({
      name,
      installed: true,
      enabled: settings[name]?.enabled ?? true,
      isDefault: settings[name]?.isDefault ?? name === defaultModel,
      purpose: settings[name]?.purpose ?? 'general',
    })),
    defaultModel: Object.entries(settings).find(([, value]) => value.isDefault && value.enabled)?.[0] || defaultModel,
    persistence: databaseConfigured() ? 'postgres' : 'environment',
  });
}

export async function PUT(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) {
    return Response.json({ error: 'DATABASE_URL is required to save model settings.' }, { status: 503 });
  }
  const body = await req.json().catch(() => null) as {
    tenantId?: string; modelName?: string; enabled?: boolean; isDefault?: boolean; purpose?: string;
  } | null;
  if (!body?.tenantId || !UUID.test(body.tenantId) || !body.modelName) {
    return Response.json({ error: 'A valid tenantId and modelName are required.' }, { status: 400 });
  }
  const installed = await listOllamaModels();
  if (!installed.includes(body.modelName)) {
    return Response.json({ error: 'The selected model is not installed in Ollama.' }, { status: 400 });
  }
  const purpose = ['general', 'copy', 'code', 'image_prompt', 'video_script', 'embedding'].includes(body.purpose || '')
    ? body.purpose : 'general';
  if (body.isDefault) {
    await query(`UPDATE tenant_ai_model SET is_default=FALSE, updated_at=now() WHERE tenant_id=$1`, [body.tenantId]);
  }
  await query(
    `INSERT INTO tenant_ai_model (tenant_id, model_name, enabled, is_default, purpose, last_health_status, last_health_check_at)
     VALUES ($1,$2,$3,$4,$5,'healthy',now())
     ON CONFLICT (tenant_id, model_name) DO UPDATE SET enabled=EXCLUDED.enabled,
       is_default=EXCLUDED.is_default, purpose=EXCLUDED.purpose,
       last_health_status='healthy', last_health_check_at=now(), updated_at=now()`,
    [body.tenantId, body.modelName, body.enabled !== false, Boolean(body.isDefault), purpose],
  );
  return Response.json({ ok: true });
}
