import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    const { artist_name, genre, influences } = await req.json();
    if (!artist_name) return Response.json({ error: 'artist_name is required' }, { status: 400 });
    const prompt = `Write a compelling professional press biography for a music artist. This bio will be used for press kits, music submissions, and promotional materials.

Artist Name: ${artist_name}
Genre: ${genre || 'Not specified'}
Musical Influences: ${influences || 'Not specified'}

Write a 3-paragraph press bio in third person. Include: the artist's musical identity and sound, their influences and artistic vision, and their current projects or direction. Make it engaging, professional, and suitable for music industry contacts, journalists, and sync licensing inquiries. Canadian market context if relevant.`;

    const res = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'llama3.2', prompt, stream: false }),
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) throw new Error('Ollama error');
    const data = await res.json();
    return Response.json({ bio: data.response });
  } catch {
    return Response.json({
      bio: `[Artist Name] is a [genre] artist whose music blends [influences] into a distinctive sonic landscape. Drawing from a rich tradition of Canadian artistry, they craft compositions that resonate with authenticity and emotional depth.\n\nCurrently in production on their latest project, [Artist Name] continues to push creative boundaries while honoring the roots of their musical heritage. Their work has earned recognition from industry professionals and audiences alike.\n\n[AI generation unavailable — placeholder provided. Please fill in artist-specific details.]`,
      fallback: true,
    });
  }
}
