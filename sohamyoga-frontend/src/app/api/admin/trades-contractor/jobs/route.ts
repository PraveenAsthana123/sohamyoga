import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    const { searchParams } = new URL(req.url);
    const trade_type = searchParams.get('trade_type');
    const status = searchParams.get('status');
    const client_id = searchParams.get('client_id');
    const priority = searchParams.get('priority');
    const pool = getPool();
    const db = await pool.connect();
    try {
      const conditions: string[] = [];
      const values: unknown[] = [];
      if (trade_type) { values.push(trade_type); conditions.push(`j.trade_type = $${values.length}`); }
      if (status) { values.push(status); conditions.push(`j.status = $${values.length}`); }
      if (client_id) { values.push(client_id); conditions.push(`j.client_id = $${values.length}`); }
      if (priority) { values.push(priority); conditions.push(`j.priority = $${values.length}`); }
      const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
      const { rows } = await db.query(
        `SELECT j.*, c.name AS client_name, c.phone AS client_phone FROM trade_job j LEFT JOIN trade_client c ON c.id = j.client_id ${where} ORDER BY j.created_at DESC`,
        values
      );
      return Response.json(rows);
    } finally { db.release(); }
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    const body = await req.json();
    const pool = getPool();
    const db = await pool.connect();
    try {
      const jobNum = `JOB-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}`;
      const { rows } = await db.query(
        `INSERT INTO trade_job (client_id,job_number,title,trade_type,description,scope_of_work,address,city,status,priority,start_date,end_date,estimate_amount,quoted_amount,material_cost,labour_cost,subcontractor_cost,overhead,permit_required,permit_number,lead_worker,warranty_months,notes)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23) RETURNING *`,
        [body.client_id,body.job_number||jobNum,body.title,body.trade_type,body.description,body.scope_of_work,body.address,body.city||'Calgary',body.status||'estimate',body.priority||'normal',body.start_date||null,body.end_date||null,body.estimate_amount||null,body.quoted_amount||null,body.material_cost||null,body.labour_cost||null,body.subcontractor_cost||null,body.overhead||null,body.permit_required||false,body.permit_number,body.lead_worker,body.warranty_months||0,body.notes]
      );
      return Response.json(rows[0], { status: 201 });
    } finally { db.release(); }
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
