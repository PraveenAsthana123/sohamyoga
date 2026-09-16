import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const pool = getPool();
  const client = await pool.connect();
  try {
    const b = await req.json();
    const { patient_id, exam_type = 'comprehensive' } = b;

    let firstName = b.first_name ?? 'Patient';
    let lastExamDate = b.last_exam_date ?? null;
    let recallInterval = b.recall_interval_months ?? 12;

    if (patient_id) {
      const { rows } = await client.query(`SELECT first_name, last_exam_date, recall_interval_months FROM opt_patient WHERE id = $1`, [patient_id]);
      if (rows[0]) {
        firstName = rows[0].first_name;
        lastExamDate = rows[0].last_exam_date;
        recallInterval = rows[0].recall_interval_months;
      }
    }

    const monthsAgo = lastExamDate
      ? Math.round((Date.now() - new Date(lastExamDate).getTime()) / (1000 * 60 * 60 * 24 * 30))
      : null;

    const coverageNote = 'comprehensive exams';
    const prompt = `Write a patient recall reminder message for an optometry clinic. Patient: ${firstName}, last exam: ${monthsAgo ?? 'unknown'} months ago, recall interval: every ${recallInterval} months. Exam type: ${exam_type}. Include: warm greeting, reminder of why regular eye exams are important (mention Alberta Health covers ${coverageNote} for children under 18 and seniors 65+), easy booking call to action. Professional yet friendly tone. Under 100 words.`;

    let message = `Hi ${firstName}! It's time for your annual eye exam. Regular eye exams help detect changes in your vision and eye health early — catching issues like glaucoma or macular degeneration before symptoms appear. Alberta Health covers exams for children under 18 and seniors 65+. Call us or book online today — we look forward to seeing you!`;

    try {
      const aiRes = await fetch('http://localhost:11434/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'llama3.2', prompt, stream: false }),
        signal: AbortSignal.timeout(30000),
      });
      if (aiRes.ok) {
        const data = await aiRes.json();
        if (data.response) message = data.response.trim();
      }
    } catch { /* use fallback */ }

    return Response.json({ message, patient_first_name: firstName, generated_at: new Date().toISOString() });
  } finally { client.release(); }
}
