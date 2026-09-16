import { NextRequest } from 'next/server';
import { query } from '@/lib/postgres';

import { requireAdmin } from '@/lib/admin-auth';
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ step_id: string }> }) {

  const denied = await requireAdmin(req);
  if (denied) return denied;
  const { step_id } = await params;
  try {
    const stepId = parseInt(step_id, 10);
    const body = await req.json() as Partial<{
      step_order: number;
      action_type: string;
      action_config: Record<string, unknown>;
      condition_field: string;
      condition_operator: string;
      condition_value: string;
      on_failure: string;
    }>;

    const fields: string[] = [];
    const values: unknown[] = [];
    let paramIdx = 1;

    if (body.step_order !== undefined) { fields.push(`step_order = $${paramIdx++}`); values.push(body.step_order); }
    if (body.action_type !== undefined) { fields.push(`action_type = $${paramIdx++}`); values.push(body.action_type); }
    if (body.action_config !== undefined) { fields.push(`action_config = $${paramIdx++}`); values.push(JSON.stringify(body.action_config)); }
    if (body.condition_field !== undefined) { fields.push(`condition_field = $${paramIdx++}`); values.push(body.condition_field); }
    if (body.condition_operator !== undefined) { fields.push(`condition_operator = $${paramIdx++}`); values.push(body.condition_operator); }
    if (body.condition_value !== undefined) { fields.push(`condition_value = $${paramIdx++}`); values.push(body.condition_value); }
    if (body.on_failure !== undefined) { fields.push(`on_failure = $${paramIdx++}`); values.push(body.on_failure); }

    if (fields.length === 0) {
      return Response.json({ error: 'No fields to update' }, { status: 400 });
    }

    values.push(stepId);
    const result = await query<{ id: number }>(
      `UPDATE platform_workflow_step SET ${fields.join(', ')} WHERE id = $${paramIdx} RETURNING id`,
      values
    );

    if (result.rows.length === 0) {
      return Response.json({ error: 'Step not found' }, { status: 404 });
    }
    return Response.json({ updated: true });
  } catch (err) {
    console.error('PATCH step error:', err);
    return Response.json({ error: 'Failed to update step' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ step_id: string }> }) {

  const denied = await requireAdmin(req);
  if (denied) return denied;
  const { step_id } = await params;
  try {
    const stepId = parseInt(step_id, 10);
    await query('DELETE FROM platform_workflow_step WHERE id = $1', [stepId]);
    return Response.json({ deleted: true });
  } catch (err) {
    console.error('DELETE step error:', err);
    return Response.json({ error: 'Failed to delete step' }, { status: 500 });
  }
}
