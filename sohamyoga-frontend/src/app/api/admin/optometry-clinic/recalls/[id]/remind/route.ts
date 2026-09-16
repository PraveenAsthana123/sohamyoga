import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const pool = getPool();
  const client = await pool.connect();
  try {
    const { rows } = await client.query(`SELECT * FROM opt_patient WHERE id = $1`, [params.id]);
    if (!rows[0]) return Response.json({ error: 'Not found' }, { status: 404 });
    const p = rows[0];

    const monthsAgo = p.last_exam_date
      ? Math.round((Date.now() - new Date(p.last_exam_date).getTime()) / (1000 * 60 * 60 * 24 * 30))
      : null;
    const coverageNote = 'comprehensive exams';
    const prompt = `Write a patient recall reminder message for an optometry clinic. Patient: ${p.first_name}, last exam: ${monthsAgo ?? 'unknown'} months ago, recall interval: every ${p.recall_interval_months} months. Exam type: comprehensive. Include: warm greeting, reminder of why regular eye exams are important (mention Alberta Health covers ${coverageNote} for children under 18 and seniors 65+), easy booking call to action. Professional yet friendly tone. Under 100 words.`;

    let aiMessage = `Hi ${p.first_name}! It's time for your annual eye exam at our clinic. Regular eye exams help detect vision changes and eye health conditions early. Remember, Alberta Health covers exams for children under 18 and seniors 65+. Call us today to book your appointment — we'd love to see you!`;

    try {
      const aiRes = await fetch('http://localhost:11434/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'llama3.2', prompt, stream: false }),
        signal: AbortSignal.timeout(30000),
      });
      if (aiRes.ok) {
        const data = await aiRes.json();
        if (data.response) aiMessage = data.response.trim();
      }
    } catch { /* use fallback */ }

    // Update next_recall_date to prompt a new recall cycle
    await client.query(`UPDATE opt_patient SET next_recall_date = NOW() + (recall_interval_months || ' months')::INTERVAL WHERE id = $1`, [params.id]);

    return Response.json({ patient: p, ai_message: aiMessage, reminder_sent_at: new Date().toISOString() });
  } finally { client.release(); }
}
