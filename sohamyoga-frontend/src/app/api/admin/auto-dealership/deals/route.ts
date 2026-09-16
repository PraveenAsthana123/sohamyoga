import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const { searchParams } = new URL(req.url);
  const deal_type = searchParams.get('deal_type');
  const status = searchParams.get('status');
  const salesperson = searchParams.get('salesperson');
  const lender = searchParams.get('lender');
  const from = searchParams.get('from');
  const to = searchParams.get('to');
  try {
    const pool = getPool();
    const client = await pool.connect();
    try {
      const conds: string[] = [];
      const vals: unknown[] = [];
      let i = 1;
      if (deal_type) { conds.push(`d.deal_type = $${i++}`); vals.push(deal_type); }
      if (status) { conds.push(`d.status = $${i++}`); vals.push(status); }
      if (salesperson) { conds.push(`LOWER(d.salesperson) LIKE $${i++}`); vals.push(`%${salesperson.toLowerCase()}%`); }
      if (lender) { conds.push(`d.lender = $${i++}`); vals.push(lender); }
      if (from) { conds.push(`d.created_at >= $${i++}`); vals.push(from); }
      if (to) { conds.push(`d.created_at <= $${i++}`); vals.push(to); }
      const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
      const { rows } = await client.query(
        `SELECT d.*,
           c.name AS customer_name, c.phone AS customer_phone, c.credit_tier,
           v.year, v.make, v.model, v.trim, v.stock_number, v.color_exterior
         FROM auto_deal d
         LEFT JOIN auto_customer c ON c.id = d.customer_id
         LEFT JOIN auto_vehicle_inventory v ON v.id = d.vehicle_id
         ${where} ORDER BY d.created_at DESC`,
        vals
      );
      return Response.json(rows);
    } finally { client.release(); }
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    const body = await req.json();
    const sale_price = parseFloat(body.sale_price ?? 0);
    const cost_res_pool = getPool();
    const client = await cost_res_pool.connect();
    try {
      const vRes = await client.query(`SELECT cost FROM auto_vehicle_inventory WHERE id = $1`, [body.vehicle_id]);
      const cost = parseFloat(vRes.rows[0]?.cost ?? 0);
      const front_gross = sale_price - cost - parseFloat(body.trade_in_value ?? 0);
      const back_gross = parseFloat(body.extended_warranty_cost ?? 0) + parseFloat(body.gap_cost ?? 0) + parseFloat(body.protection_cost ?? 0);
      const total_gross = front_gross + back_gross;
      const gst = sale_price * 0.05;
      const { rows } = await client.query(
        `INSERT INTO auto_deal (customer_id, vehicle_id, deal_type, salesperson, finance_manager,
          sale_price, trade_in_value, trade_in_vehicle, down_payment, rebates, gst, total_financed,
          lender, interest_rate, term_months, monthly_payment,
          extended_warranty, extended_warranty_cost, gap_insurance, gap_cost,
          paint_protection, protection_cost, status, front_gross, back_gross, total_gross, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27)
         RETURNING *`,
        [body.customer_id, body.vehicle_id, body.deal_type ?? 'retail', body.salesperson, body.finance_manager,
         sale_price, body.trade_in_value, body.trade_in_vehicle, body.down_payment, body.rebates, gst,
         body.total_financed, body.lender, body.interest_rate, body.term_months, body.monthly_payment,
         body.extended_warranty ?? false, body.extended_warranty_cost,
         body.gap_insurance ?? false, body.gap_cost,
         body.paint_protection ?? false, body.protection_cost,
         body.status ?? 'pending', front_gross, back_gross, total_gross, body.notes]
      );
      return Response.json(rows[0], { status: 201 });
    } finally { client.release(); }
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
