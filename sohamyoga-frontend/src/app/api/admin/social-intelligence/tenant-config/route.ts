import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/postgres';
import { ensureSocialIntelligenceSchema } from '@/lib/social-intelligence-schema';

export async function GET(req: NextRequest) {
  await ensureSocialIntelligenceSchema();
  const tenant_type = req.nextUrl.searchParams.get('tenant_type');
  const platform = req.nextUrl.searchParams.get('platform');
  const conditions: string[] = [];
  const params: string[] = [];
  let idx = 1;
  if (tenant_type) { conditions.push(`tenant_type = $${idx++}`); params.push(tenant_type); }
  if (platform) { conditions.push(`platform = $${idx++}`); params.push(platform); }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const result = await query(
    `SELECT * FROM social_tenant_config ${where} ORDER BY tenant_type, platform`,
    params,
  );
  return NextResponse.json({ configs: result.rows });
}
