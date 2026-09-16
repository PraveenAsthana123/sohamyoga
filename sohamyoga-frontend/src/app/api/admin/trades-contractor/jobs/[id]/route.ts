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
    const db = await pool.connect();
    try {
      const { rows } = await db.query(`SELECT j.*, c.name AS client_name FROM trade_job j LEFT JOIN trade_client c ON c.id = j.client_id WHERE j.id = $1`, [params.id]);
      if (!rows[0]) return Response.json({ error: 'Not found' }, { status: 404 });
      const materials = await db.query(`SELECT * FROM trade_material WHERE job_id = $1 ORDER BY created_at`, [params.id]);
      return Response.json({ ...rows[0], materials: materials.rows });
    } finally { db.release(); }
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    const body = await req.json();
    const pool = getPool();
    const db = await pool.connect();
    try {
      const { rows } = await db.query(
        `UPDATE trade_job SET title=$1,trade_type=$2,description=$3,scope_of_work=$4,address=$5,city=$6,status=$7,priority=$8,start_date=$9,end_date=$10,actual_start=$11,actual_end=$12,estimate_amount=$13,quoted_amount=$14,material_cost=$15,labour_cost=$16,subcontractor_cost=$17,invoiced_amount=$18,paid_amount=$19,permit_required=$20,permit_number=$21,lead_worker=$22,warranty_months=$23,notes=$24 WHERE id=$25 RETURNING *`,
        [body.title,body.trade_type,body.description,body.scope_of_work,body.address,body.city,body.status,body.priority,body.start_date||null,body.end_date||null,body.actual_start||null,body.actual_end||null,body.estimate_amount||null,body.quoted_amount||null,body.material_cost||null,body.labour_cost||null,body.subcontractor_cost||null,body.invoiced_amount||null,body.paid_amount||null,body.permit_required||false,body.permit_number,body.lead_worker,body.warranty_months||0,body.notes,params.id]
      );
      return Response.json(rows[0]);
    } finally { db.release(); }
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
