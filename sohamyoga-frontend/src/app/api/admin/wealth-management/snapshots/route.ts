import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<Response> {
  try {
    await requireAdmin(req);
    const { searchParams } = new URL(req.url);
    const client_id = searchParams.get('client_id');
    const pool = getPool();
    const client = await pool.connect();
    try {
      let q = `SELECT s.*, c.first_name, c.last_name FROM wm_financial_snapshot s JOIN wm_client c ON c.id=s.client_id WHERE 1=1`;
      const params: any[] = [];
      if (client_id) { params.push(parseInt(client_id)); q += ` AND s.client_id=$${params.length}`; }
      q += ` ORDER BY s.snapshot_date DESC`;
      const { rows } = await client.query(q, params);
      return NextResponse.json(rows);
    } finally {
      client.release();
    }
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  try {
    await requireAdmin(req);
    const body = await req.json();
    const pool = getPool();
    const client = await pool.connect();
    try {
      const totalAssets = (parseFloat(body.cash_savings||0)+parseFloat(body.rrsp_balance||0)+parseFloat(body.tfsa_balance||0)+
        parseFloat(body.fhsa_balance||0)+parseFloat(body.resp_balance||0)+parseFloat(body.pension_value||0)+
        parseFloat(body.investment_non_reg||0)+parseFloat(body.real_estate_value||0)+parseFloat(body.other_assets||0));
      const totalLiab = (parseFloat(body.mortgage_balance||0)+parseFloat(body.heloc_balance||0)+parseFloat(body.car_loan_balance||0)+
        parseFloat(body.student_loan_balance||0)+parseFloat(body.credit_card_balance||0)+parseFloat(body.other_debt||0));
      const net_worth = totalAssets - totalLiab;
      const monthly_savings = parseFloat(body.monthly_income||0) - parseFloat(body.monthly_expenses||0);
      const { rows } = await client.query(
        `INSERT INTO wm_financial_snapshot (client_id, snapshot_date, cash_savings, rrsp_balance, tfsa_balance, fhsa_balance,
          resp_balance, pension_value, investment_non_reg, real_estate_value, other_assets,
          mortgage_balance, heloc_balance, car_loan_balance, student_loan_balance, credit_card_balance, other_debt,
          monthly_income, monthly_expenses, monthly_savings, net_worth)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21) RETURNING *`,
        [body.client_id, body.snapshot_date || new Date().toISOString().split('T')[0],
          body.cash_savings||0, body.rrsp_balance||0, body.tfsa_balance||0, body.fhsa_balance||0,
          body.resp_balance||0, body.pension_value||0, body.investment_non_reg||0, body.real_estate_value||0, body.other_assets||0,
          body.mortgage_balance||0, body.heloc_balance||0, body.car_loan_balance||0, body.student_loan_balance||0,
          body.credit_card_balance||0, body.other_debt||0,
          body.monthly_income||0, body.monthly_expenses||0, monthly_savings, net_worth]
      );
      return NextResponse.json(rows[0], { status: 201 });
    } finally {
      client.release();
    }
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
