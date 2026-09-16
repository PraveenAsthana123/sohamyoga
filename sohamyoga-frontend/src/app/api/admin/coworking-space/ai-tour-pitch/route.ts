import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const body = await req.json();
  const { client_type = 'startup', amenities = [], min_rate = 250 } = body;

  const pool = getPool();
  const client = await pool.connect();
  let min_rate_actual = min_rate;
  try {
    const rateRes = await client.query(`SELECT MIN(monthly_rate) AS min_rate FROM cw_space WHERE monthly_rate IS NOT NULL`);
    if (rateRes.rows[0]?.min_rate) min_rate_actual = rateRes.rows[0].min_rate;
  } finally {
    client.release();
  }

  const amenitiesStr = amenities.length ? amenities.join(', ') : 'high-speed internet, meeting rooms, printing, lounge access';
  const prompt = `Write a compelling sales pitch for a coworking space tour. Client type: ${client_type} (startup/freelancer/remote_worker/corporate). Highlights: ${amenitiesStr}. Monthly rates from $${min_rate_actual}. Calgary, Alberta. Include: community benefits, flexibility vs traditional office, networking opportunities, specific amenities, call to action. Conversational, enthusiastic tone.`;

  let pitch = '';
  try {
    const ollamaRes = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'llama3.2', prompt, stream: false }),
      signal: AbortSignal.timeout(30000),
    });
    if (ollamaRes.ok) {
      const data = await ollamaRes.json();
      pitch = data.response || '';
    }
  } catch {
    // graceful fallback
  }

  if (!pitch) {
    pitch = `Welcome to our coworking community in Calgary! Whether you're a ${client_type} looking for a dynamic workspace, we have the perfect solution. Starting from just $${min_rate_actual}/month, you get access to ${amenitiesStr}. Unlike a traditional office lease, our flexible memberships mean you only pay for what you need — no long-term commitment required. Join a thriving network of professionals, collaborate with like-minded innovators, and take your business to the next level. Ready to see it in action? Book your tour today!`;
  }

  return Response.json({ pitch, client_type, amenities, min_rate: min_rate_actual });
}
