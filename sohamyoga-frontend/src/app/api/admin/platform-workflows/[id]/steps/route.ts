import { NextRequest } from 'next/server';
import { query } from '@/lib/postgres';

import { requireAdmin } from '@/lib/admin-auth';
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {

  const denied = await requireAdmin(req);
  if (denied) return denied;
  const { id } = await params;
  try {
    const workflowId = parseInt(id, 10);
    const result = await query<{
      id: number;
      workflow_id: number;
      step_order: number;
      action_type: string;
      action_config: Record<string, unknown>;
      condition_field: string | null;
      condition_operator: string | null;
      condition_value: string | null;
      on_failure: string;
      created_at: string;
    }>(
      'SELECT * FROM platform_workflow_step WHERE workflow_id = $1 ORDER BY step_order ASC',
      [workflowId]
    );
    return Response.json({ steps: result.rows });
  } catch (err) {
    console.error('GET steps error:', err);
    return Response.json({ error: 'Failed to fetch steps' }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {

  const denied = await requireAdmin(req);
  if (denied) return denied;
  const { id } = await params;
  try {
    const workflowId = parseInt(id, 10);
    const body = await req.json() as {
      step_order: number;
      action_type: string;
      action_config?: Record<string, unknown>;
      condition_field?: string;
      condition_operator?: string;
      condition_value?: string;
      on_failure?: string;
    };

    const {
      step_order,
      action_type,
      action_config = {},
      condition_field = null,
      condition_operator = null,
      condition_value = null,
      on_failure = 'continue',
    } = body;

    if (!action_type) {
      return Response.json({ error: 'action_type is required' }, { status: 400 });
    }

    const result = await query<{ id: number }>(
      `INSERT INTO platform_workflow_step
         (workflow_id, step_order, action_type, action_config, condition_field, condition_operator, condition_value, on_failure)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
      [workflowId, step_order, action_type, JSON.stringify(action_config), condition_field, condition_operator, condition_value, on_failure]
    );

    return Response.json({ step: result.rows[0] }, { status: 201 });
  } catch (err) {
    console.error('POST step error:', err);
    return Response.json({ error: 'Failed to create step' }, { status: 500 });
  }
}
