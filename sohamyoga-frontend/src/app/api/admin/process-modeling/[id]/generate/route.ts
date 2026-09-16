export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { databaseConfigured, getPool } from '@/lib/postgres';

export async function POST(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DB not configured' }, { status: 503 });
  const body = await req.json().catch(() => null);
  const description = body?.description || '';
  const pool = getPool();
  const client = await pool.connect();
  try {
    const m = await client.query('SELECT * FROM process_models WHERE id=$1', [params.id]);
    if (!m.rowCount) return Response.json({ error: 'Not found' }, { status: 404 });
    const model = m.rows[0];
    const prompt = `You are a BPMN process modeling expert. Given the following business process description, generate a structured BPMN process definition with:
1. Start Event
2. Tasks with assigned roles (use format: "Task Name [Role]")
3. Gateways with conditions (Exclusive or Parallel)
4. End Event

Process Name: ${model.name}
Department: ${model.department || 'General'}
Description: ${description || model.description || 'Standard business process'}

Output as a structured text-based BPMN flow. Be concise and practical.`;

    let bpmnText = '';
    try {
      const aiRes = await fetch('http://localhost:11434/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'llama3.2', prompt, stream: false }),
        signal: AbortSignal.timeout(30000),
      });
      if (aiRes.ok) {
        const aiData = await aiRes.json();
        bpmnText = aiData.response || '';
      }
    } catch {
      bpmnText = `[AI Unavailable] Default BPMN for ${model.name}:\nStart Event → Initiate Request [Requestor] → Review [Manager] → Gateway: Approved? → Yes: Execute [Team] → End Event | No: Reject [Manager] → End Event`;
    }

    await client.query('UPDATE process_models SET xml_definition=$1 WHERE id=$2', [bpmnText, params.id]);
    return Response.json({ bpmn: bpmnText, modelId: params.id });
  } finally { client.release(); }
}
