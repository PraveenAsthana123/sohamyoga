export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool, databaseConfigured } from '@/lib/postgres';

export async function POST(req: NextRequest): Promise<Response> {
  if (!databaseConfigured()) return Response.json({ error: 'DB not configured' }, { status: 503 });
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const pool = getPool();
  const client = await pool.connect();
  try {
    const { content, content_type = 'ai_output' } = await req.json().catch(() => ({ content: '', content_type: 'ai_output' }));
    if (!content) return Response.json({ error: 'content is required' }, { status: 400 });

    let pii_types: string[] = [];
    let masked_content = content;
    let pii_found = false;

    // Use Ollama to detect PII
    try {
      const detectPrompt = `You are a PII detection system. Analyze the following text and identify any PII (Personally Identifiable Information).

Text: "${content}"

Respond in JSON format exactly like this:
{"pii_types": ["email", "phone", "ssn", "credit_card", "address", "name"], "masked_content": "text with PII replaced by [REDACTED_TYPE]"}

Only include pii_types that are actually present. If no PII found, use empty array and return original text.`;

      const ollamaRes = await fetch('http://localhost:11434/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'llama3.2', prompt: detectPrompt, stream: false }),
        signal: AbortSignal.timeout(25000),
      });

      if (ollamaRes.ok) {
        const ollamaJson = await ollamaRes.json();
        const raw = ollamaJson.response ?? '{}';
        const match = raw.match(/\{[\s\S]*?\}/);
        if (match) {
          const parsed = JSON.parse(match[0]);
          pii_types = parsed.pii_types ?? [];
          masked_content = parsed.masked_content ?? content;
        }
      }
    } catch {
      // Fallback: regex-based PII detection
      const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
      const phoneRegex = /(\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g;
      const ssnRegex = /\d{3}[-\s]?\d{2}[-\s]?\d{4}/g;
      const creditCardRegex = /\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}/g;

      if (emailRegex.test(content)) { pii_types.push('email'); masked_content = masked_content.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[REDACTED_EMAIL]'); }
      if (phoneRegex.test(content)) { pii_types.push('phone'); masked_content = masked_content.replace(/(\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g, '[REDACTED_PHONE]'); }
      if (ssnRegex.test(content)) { pii_types.push('ssn'); masked_content = masked_content.replace(/\d{3}[-\s]?\d{2}[-\s]?\d{4}/g, '[REDACTED_SSN]'); }
      if (creditCardRegex.test(content)) { pii_types.push('credit_card'); masked_content = masked_content.replace(/\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}/g, '[REDACTED_CREDIT_CARD]'); }
    }

    pii_found = pii_types.length > 0;
    const risk_level = pii_types.includes('ssn') || pii_types.includes('credit_card') ? 'high'
      : pii_types.length > 1 ? 'medium'
      : pii_found ? 'medium' : 'low';

    const snippet = content.length > 200 ? content.substring(0, 200) + '...' : content;

    const { rows } = await client.query(
      `INSERT INTO pii_scans (content_snippet, content_type, pii_found, pii_types, risk_level, masked_content)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [snippet, content_type, pii_found, pii_types, risk_level, masked_content]
    );

    return Response.json({
      scan: rows[0],
      pii_found,
      pii_types,
      risk_level,
      masked_content,
    });
  } finally {
    client.release();
  }
}
