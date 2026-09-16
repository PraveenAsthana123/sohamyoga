import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/postgres';

export async function GET() {
  try {
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
      step_count: string;
    }>(`
      SELECT
        w.*,
        COUNT(s.id) AS step_count
      FROM platform_workflow w
      LEFT JOIN platform_workflow_step s ON s.workflow_id = w.id
      GROUP BY w.id
      ORDER BY w.created_at DESC
    `);
    return NextResponse.json({ workflows: result.rows });
  } catch (err) {
    console.error('GET /api/admin/platform-workflows error:', err);
    return NextResponse.json({ error: 'Failed to fetch workflows' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      name: string;
      description?: string;
      trigger_type: string;
      trigger_config?: Record<string, unknown>;
      is_active?: boolean;
    };
    const { name, description = '', trigger_type, trigger_config = {}, is_active = true } = body;

    if (!name || !trigger_type) {
      return NextResponse.json({ error: 'name and trigger_type are required' }, { status: 400 });
    }

    const result = await query<{ id: number }>(
      `INSERT INTO platform_workflow (name, description, trigger_type, trigger_config, is_active)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [name, description, trigger_type, JSON.stringify(trigger_config), is_active]
    );

    return NextResponse.json({ workflow: result.rows[0] }, { status: 201 });
  } catch (err) {
    console.error('POST /api/admin/platform-workflows error:', err);
    return NextResponse.json({ error: 'Failed to create workflow' }, { status: 500 });
  }
}
