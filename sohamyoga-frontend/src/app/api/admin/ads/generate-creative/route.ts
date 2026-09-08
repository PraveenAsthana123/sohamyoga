import { NextRequest } from 'next/server';
import { query } from '@/lib/postgres';
import { getAdminPrincipal } from '@/lib/admin-auth';
import { generateAdCreativeVariants } from '@/domain/ads/AdCreativeGenerator';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const { principal, denied } = await getAdminPrincipal(req);
  if (denied) return denied;

  const body = await req.json();
  const { adGroupId, prompt, businessType, ageGroup, tone, count } = body;
  if (!adGroupId || !prompt || !businessType || !ageGroup) {
    return Response.json({ error: 'adGroupId, prompt, businessType, and ageGroup are required.' }, { status: 400 });
  }

  const group = await query(`SELECT id FROM ad_group WHERE id = $1`, [adGroupId]);
  if (!group.rowCount) return Response.json({ error: 'Ad group not found.' }, { status: 404 });

  let variants;
  try {
    variants = await generateAdCreativeVariants(prompt, { businessType, ageGroup, tone }, Math.min(Number(count) || 3, 6));
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : 'Generation failed.' }, { status: 502 });
  }
  if (!variants.length) return Response.json({ error: 'Ollama returned no usable ad variants.' }, { status: 502 });

  const inserted = [];
  for (const v of variants) {
    const result = await query<{ id: string }>(
      `INSERT INTO advertisement (ad_group_id, name, ad_type, headlines, descriptions, final_url, ai_generated, generated_by)
       VALUES ($1, $2, 'responsive_search', $3, $4, $5, true, $6) RETURNING id`,
      [adGroupId, `AI variant — ${businessType}/${ageGroup}`, [v.headline], [v.description], 'https://sohamyoga.com', `ollama/strong (targeting: ${businessType}, ${ageGroup})`],
    );
    inserted.push({ id: result.rows[0].id, ...v });
  }

  return Response.json({ variants: inserted, generatedBy: principal!.email ?? principal!.id }, { status: 201 });
}
