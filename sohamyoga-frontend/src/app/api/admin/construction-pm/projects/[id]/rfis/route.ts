import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    const pool = getPool();
    const client = await pool.connect();
    try {
      const { rows } = await client.query(`SELECT * FROM cpm_rfis WHERE project_id = $1 ORDER BY submitted_date DESC`, [params.id]);
      return Response.json(rows);
    } finally { client.release(); }
  } catch (e: unknown) {
    return Response.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    const body = await req.json();
    const pool = getPool();
    const client = await pool.connect();
    try {
      // Auto-generate RFI number: RFI-NNN
      const { rows: countRows } = await client.query(`SELECT COUNT(*) AS n FROM cpm_rfis WHERE project_id = $1`, [params.id]);
      const seq = String(parseInt(countRows[0].n, 10) + 1).padStart(3, '0');
      const rfi_number = `RFI-${seq}`;
      const { rows } = await client.query(
        `INSERT INTO cpm_rfis (project_id, rfi_number, subject, trade, submitted_by, submitted_date, directed_to, response_required_by, description, cost_impact, schedule_impact_days)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
        [params.id, rfi_number, body.subject, body.trade, body.submitted_by,
         body.submitted_date ?? new Date().toISOString().split('T')[0],
         body.directed_to, body.response_required_by, body.description,
         body.cost_impact ?? 0, body.schedule_impact_days ?? 0]
      );
      return Response.json(rows[0], { status: 201 });
    } finally { client.release(); }
  } catch (e: unknown) {
    return Response.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}
