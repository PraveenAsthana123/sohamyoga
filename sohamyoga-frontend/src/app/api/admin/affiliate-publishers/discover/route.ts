import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const OLLAMA_BASE = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3';

type ProspectCard = {
  archetype: string;
  style: string;
  why_they_convert: string;
  audience_size_range: string;
  how_to_find: string;
};

async function ollamaGenerate(prompt: string): Promise<string> {
  const res = await fetch(`${OLLAMA_BASE}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: OLLAMA_MODEL, prompt, stream: false }),
    signal: AbortSignal.timeout(90_000),
  });
  if (!res.ok) throw new Error(`Ollama error: ${res.status}`);
  const data = await res.json() as { response: string };
  return data.response || '';
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  // Validate DB is accessible (schema already exists from main route)
  getPool();
  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') return Response.json({ error: 'Invalid request body' }, { status: 400 });
    const { niche, publisher_type, geo } = body as { niche?: string; publisher_type?: string; geo?: string };

    const nicheStr = niche || 'wellness, yoga';
    const typeStr = publisher_type || 'blogger';
    const geoStr = geo || 'global';

    const prompt = `Suggest 8 types of ${typeStr} publishers in the ${nicheStr} niche for the ${geoStr} market who would be ideal affiliate partners for a yoga/wellness brand.

For each publisher archetype provide:
1. Publisher archetype name (not a real company)
2. Typical website/channel style description
3. Why they would convert affiliate traffic well
4. Estimated audience size range (e.g. "50k-200k")
5. How to find them (search terms, directories, hashtags, or platforms)

Respond as a JSON array of 8 objects with these exact keys:
[{"archetype": "...", "style": "...", "why_they_convert": "...", "audience_size_range": "...", "how_to_find": "..."}]

No real company names. Focus on archetypes.`;

    let prospects: ProspectCard[] = [];

    try {
      const raw = await ollamaGenerate(prompt);
      const jsonMatch = raw.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]) as ProspectCard[];
        if (Array.isArray(parsed)) prospects = parsed.slice(0, 8);
      }
    } catch { /* fall through to fallback */ }

    if (!prospects.length) {
      // Fallback: static archetypes tailored to yoga/wellness
      prospects = [
        { archetype: 'Daily Yoga Practice Blogger', style: 'Personal blog documenting a daily yoga journey with tutorials, poses, and lifestyle content', why_they_convert: 'Highly engaged audience of yoga practitioners actively seeking tools and subscriptions', audience_size_range: '10k-80k', how_to_find: 'Search "yoga daily practice blog", hashtags #yogaeverydamnday, Pinterest yoga boards' },
        { archetype: 'Holistic Health Podcast Host', style: 'Weekly interview podcast covering wellness, nutrition, mindfulness and yoga', why_they_convert: 'Listeners trust host recommendations; high purchase intent audience', audience_size_range: '5k-50k', how_to_find: 'Apple Podcasts wellness category, Spotify wellness shows, Podchaser directory' },
        { archetype: 'Fitness & Wellness Instagram Creator', style: 'Visual-first Instagram feed with workout videos, yoga flows, and wellness tips', why_they_convert: 'High engagement rates; followers buy products shown by creators they follow', audience_size_range: '20k-500k', how_to_find: '#yogateacher #wellnesscoach #yogalifestyle on Instagram, AspireIQ, Creator.co' },
        { archetype: 'Mindfulness & Meditation YouTube Channel', style: 'Guided meditation videos, stress-relief content, and yoga sessions on YouTube', why_they_convert: 'Long watch time indicates deep engagement; audience actively improving health habits', audience_size_range: '50k-1M', how_to_find: 'YouTube search "meditation for beginners", check similar channels tab, Social Blade' },
        { archetype: 'Health & Wellness Comparison Website', style: 'Review and comparison site covering yoga apps, studios, and wellness subscriptions', why_they_convert: 'Users are in active research/buying mode; high-intent traffic', audience_size_range: '100k-2M', how_to_find: 'Search "best yoga apps review", "yoga class comparison", check affiliate networks like ShareASale' },
        { archetype: 'Corporate Wellness Newsletter', style: 'Email newsletter for HR and corporate wellness teams covering employee wellness programs', why_they_convert: 'B2B audience with budget; can drive bulk subscriptions from organizations', audience_size_range: '5k-30k', how_to_find: 'LinkedIn wellness groups, HR publications, ProductHunt wellness tools, Beehiiv newsletter directory' },
        { archetype: 'Mommy & Family Wellness Blogger', style: 'Parenting + wellness blog covering prenatal yoga, family-friendly wellness, and self-care', why_they_convert: 'Mothers are high-value consumers who trust peer recommendations', audience_size_range: '15k-150k', how_to_find: '#prenatalyoga #mommyyoga on Instagram, Pinterest parenting boards, Google "family yoga blog"' },
        { archetype: 'Travel & Digital Nomad Wellness Creator', style: 'Content about yoga retreats, wellness travel, and maintaining practice while traveling', why_they_convert: 'Aspirational audience with disposable income seeking premium experiences', audience_size_range: '30k-300k', how_to_find: '#yogaretreat #wellnesstravel #digitalnomad on Instagram, TravelBloggers.com, Nomadic Matt-type communities' },
      ];
    }

    return Response.json({ prospects });
  } catch (err) {
    console.error('affiliate-publishers discover POST error:', err);
    return Response.json({ error: 'Discovery failed' }, { status: 500 });
  }
}
