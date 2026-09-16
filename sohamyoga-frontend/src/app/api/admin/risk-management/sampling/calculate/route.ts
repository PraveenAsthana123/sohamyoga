export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { databaseConfigured } from '@/lib/postgres';

// Sample size formula: Cochran's formula for finite populations
// n0 = Z^2 * p * (1-p) / e^2 ; n = n0 / (1 + (n0-1)/N)
// Z=1.96 (95% confidence), p=0.5 (max variance), e=0.05 (5% tolerable deviation)
function calculateSampleSize(populationSize: number): { sample_size: number; method: string; confidence: number; tolerable_deviation: number; formula: string } {
  const Z = 1.96;
  const p = 0.5;
  const e = 0.05;
  const n0 = (Z * Z * p * (1 - p)) / (e * e);
  const n = Math.ceil(n0 / (1 + (n0 - 1) / populationSize));
  return {
    sample_size: Math.min(n, populationSize),
    method: 'Cochran (finite population)',
    confidence: 95,
    tolerable_deviation: 5,
    formula: `n = Z²·p·(1-p)/e² / (1 + (n₀-1)/N) = ${n0.toFixed(0)} / (1 + ${(n0 - 1).toFixed(0)}/${populationSize}) = ${n}`,
  };
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DB not configured' }, { status: 503 });
  const body = await req.json().catch(() => null);
  if (!body?.population_size || body.population_size < 1) return Response.json({ error: 'population_size (>0) required' }, { status: 400 });
  const result = calculateSampleSize(parseInt(body.population_size));
  return Response.json(result);
}
