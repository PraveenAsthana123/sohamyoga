import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest): Promise<Response> {
  const auth = await requireAdmin(req);
  if (auth) return auth;

  const body = await req.json();
  const { event_name, event_type, expected_customers, cuisine_type, capacity_servings_per_hour = 60, truck_name } = body;

  if (!event_name || !cuisine_type) {
    return NextResponse.json({ error: 'event_name and cuisine_type required' }, { status: 400 });
  }

  const prompt = `Write a professional food truck booking pitch for: ${event_name}, ${event_type || 'event'}, ${expected_customers || 'unknown'} expected attendees. Our truck${truck_name ? ` "${truck_name}"` : ''} cuisine: ${cuisine_type}. Include: introduction, menu highlights, setup requirements (space, power, water), service capacity (${capacity_servings_per_hour} servings/hr), health permit compliance (Alberta Health Services), insurance coverage, pricing model, and why we're the right fit. Professional, appetizing tone.`;

  try {
    const res = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'llama3.2', prompt, stream: false }),
      signal: AbortSignal.timeout(30000),
    });

    if (!res.ok) throw new Error('Ollama error');
    const data = await res.json();
    return NextResponse.json({ pitch: data.response });
  } catch {
    return NextResponse.json({
      pitch: `[AI service unavailable. Please retry to generate a custom booking pitch for "${event_name}"]`,
      fallback: true,
    });
  }
}
