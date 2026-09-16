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
  const pool = getPool();
  const client = await pool.connect();
  try {
    const m = await client.query('SELECT * FROM process_models WHERE id=$1', [params.id]);
    if (!m.rowCount) return Response.json({ error: 'Not found' }, { status: 404 });
    const model = m.rows[0];
    const description = body?.description || model.description || '';
    const prompt = `You are a business process analyst. Analyze the following process and generate a swimlane breakdown.
For each identified role/department, list the tasks they own.

Process: ${model.name}
Department: ${model.department || 'General'}
Description: ${description}

Output as JSON with this structure:
{
  "lanes": [
    {
      "name": "Lane/Role Name",
      "department": "Department",
      "tasks": ["Task 1", "Task 2", "Task 3"],
      "handoffs": ["Sends to: Next Lane"]
    }
  ]
}`;

    let swimlanes: unknown = null;
    let raw = '';
    try {
      const aiRes = await fetch('http://localhost:11434/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'llama3.2', prompt, stream: false }),
        signal: AbortSignal.timeout(30000),
      });
      if (aiRes.ok) {
        const aiData = await aiRes.json();
        raw = aiData.response || '';
        const match = raw.match(/\{[\s\S]*\}/);
        if (match) swimlanes = JSON.parse(match[0]);
      }
    } catch {
      swimlanes = {
        lanes: [
          { name: 'Requester', department: model.department || 'Operations', tasks: ['Submit request', 'Provide documentation'], handoffs: ['Sends to: Reviewer'] },
          { name: 'Reviewer', department: model.department || 'Operations', tasks: ['Review submission', 'Validate data', 'Make decision'], handoffs: ['Sends to: Approver'] },
          { name: 'Approver', department: 'Management', tasks: ['Final approval', 'Sign off'], handoffs: ['Sends to: Executor'] },
          { name: 'Executor', department: 'Operations', tasks: ['Execute action', 'Confirm completion', 'Notify stakeholders'], handoffs: [] },
        ],
      };
    }

    if (swimlanes) {
      await client.query('UPDATE process_models SET swimlanes=$1 WHERE id=$2', [JSON.stringify(swimlanes), params.id]);
    }
    return Response.json({ swimlanes, raw });
  } finally { client.release(); }
}
