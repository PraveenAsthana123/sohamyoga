import { NextRequest } from 'next/server';
import { query } from '@/lib/postgres';

import { requireAdmin } from '@/lib/admin-auth';
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {

  const denied = await requireAdmin(req);
  if (denied) return denied;
  const { id: rawId } = await params;
  try {
    const id = parseInt(rawId, 10);
    const result = await query<{
      id: number;
      name: string;
      description: string;
      trigger_type: string;
      trigger_config: Record<string, unknown>;
      is_active: boolean;
      run_count: number;
      last_run_at: string | null;
      last_run_status: string | null;
      created_at: string;
      updated_at: string;
    }>('SELECT * FROM platform_workflow WHERE id = $1', [id]);

    if (result.rows.length === 0) {
      return Response.json({ error: 'Workflow not found' }, { status: 404 });
    }
    return Response.json({ workflow: result.rows[0] });
  } catch (err) {
    console.error('GET workflow error:', err);
    return Response.json({ error: 'Failed to fetch workflow' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {

  const denied = await requireAdmin(req);
  if (denied) return denied;
  const { id: rawId } = await params;
  try {
    const id = parseInt(rawId, 10);
    const body = await req.json() as Partial<{
      name: string;
      description: string;
      trigger_type: string;
      trigger_config: Record<string, unknown>;
      is_active: boolean;
    }>;

    const fields: string[] = [];
    const values: unknown[] = [];
    let paramIdx = 1;

    if (body.name !== undefined) { fields.push(`name = $${paramIdx++}`); values.push(body.name); }
    if (body.description !== undefined) { fields.push(`description = $${paramIdx++}`); values.push(body.description); }
    if (body.trigger_type !== undefined) { fields.push(`trigger_type = $${paramIdx++}`); values.push(body.trigger_type); }
    if (body.trigger_config !== undefined) { fields.push(`trigger_config = $${paramIdx++}`); values.push(JSON.stringify(body.trigger_config)); }
    if (body.is_active !== undefined) { fields.push(`is_active = $${paramIdx++}`); values.push(body.is_active); }
    fields.push(`updated_at = NOW()`);

    if (fields.length === 1) {
      return Response.json({ error: 'No fields to update' }, { status: 400 });
    }

    values.push(id);
    const result = await query<{ id: number }>(
      `UPDATE platform_workflow SET ${fields.join(', ')} WHERE id = $${paramIdx} RETURNING id`,
      values
    );

    if (result.rows.length === 0) {
      return Response.json({ error: 'Workflow not found' }, { status: 404 });
    }
    return Response.json({ updated: true });
  } catch (err) {
    console.error('PATCH workflow error:', err);
    return Response.json({ error: 'Failed to update workflow' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {

  const denied = await requireAdmin(req);
  if (denied) return denied;
  const { id: rawId } = await params;
  try {
    const id = parseInt(rawId, 10);
    await query('DELETE FROM platform_workflow WHERE id = $1', [id]);
    return Response.json({ deleted: true });
  } catch (err) {
    console.error('DELETE workflow error:', err);
    return Response.json({ error: 'Failed to delete workflow' }, { status: 500 });
  }
}
