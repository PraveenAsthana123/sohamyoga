export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { databaseConfigured, getPool } from '@/lib/postgres';

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req); if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DB not configured' }, { status: 503 });
  const b = await req.json().catch(() => null);
  if (!b || !b.description) return Response.json({ error: 'description required' }, { status: 400 });

  const prompt = `You are a B2B marketing strategist. Create a detailed Ideal Customer Profile (ICP) from this description:

"${b.description}"

Return ONLY valid JSON:
{"name": "<ICP name>", "industry": "<primary industry>", "company_size": "<size range>", "pain_points": ["pain1","pain2","pain3","pain4"], "buying_signals": ["signal1","signal2","signal3"]}`;

  let profile = {
    name: b.name || 'Generated ICP',
    industry: 'Technology',
    company_size: '50-200',
    pain_points: ['scaling operations', 'reducing costs', 'improving efficiency'],
    buying_signals: ['evaluating tools', 'budget approved'],
  };

  try {
    const aiRes = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'llama3.2', prompt, stream: false }),
      signal: AbortSignal.timeout(30000),
    });
    if (aiRes.ok) {
      const aiData = await aiRes.json();
      const text = aiData.response || '';
      const match = text.match(/\{[\s\S]*\}/);
      if (match) { const parsed = JSON.parse(match[0]); profile = { ...profile, ...parsed }; }
    }
  } catch { /* fallback to defaults */ }

  const pool = getPool(); const client = await pool.connect();
  try {
    const { rows } = await client.query(
      `INSERT INTO lead_management_icp (name,industry,company_size,pain_points,buying_signals)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [profile.name, profile.industry, profile.company_size, profile.pain_points, profile.buying_signals]
    );
    return Response.json({ profile: rows[0] }, { status: 201 });
  } finally { client.release(); }
}
