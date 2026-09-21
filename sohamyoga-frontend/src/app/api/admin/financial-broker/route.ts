export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

async function ensureTables() {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS fb_clients (
        client_id VARCHAR(64) PRIMARY KEY,
        name VARCHAR(128) NOT NULL,
        risk_profile VARCHAR(32) NOT NULL,
        account_type VARCHAR(32) NOT NULL,
        aum_usd NUMERIC(15,2) NOT NULL DEFAULT 0,
        kyc_status VARCHAR(32) NOT NULL DEFAULT 'pending',
        portfolio_count INT NOT NULL DEFAULT 0,
        last_activity TIMESTAMP NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS fb_products (
        product_id VARCHAR(64) PRIMARY KEY,
        name VARCHAR(256) NOT NULL,
        product_type VARCHAR(64) NOT NULL,
        risk_level VARCHAR(16) NOT NULL,
        min_investment NUMERIC(12,2) NOT NULL DEFAULT 0,
        expected_return_pct NUMERIC(5,2) NOT NULL DEFAULT 0,
        is_active BOOLEAN NOT NULL DEFAULT TRUE
      );
      CREATE TABLE IF NOT EXISTS fb_trades (
        id SERIAL PRIMARY KEY,
        trade_id VARCHAR(64) UNIQUE NOT NULL,
        client_id VARCHAR(64) NOT NULL,
        product_id VARCHAR(64) NOT NULL,
        trade_type VARCHAR(32) NOT NULL,
        amount_usd NUMERIC(12,2) NOT NULL,
        status VARCHAR(32) NOT NULL DEFAULT 'pending',
        executed_at TIMESTAMP,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS fb_kyc (
        client_id VARCHAR(64) PRIMARY KEY,
        docs_submitted JSONB NOT NULL DEFAULT '{}',
        aml_status VARCHAR(32) NOT NULL DEFAULT 'pending',
        compliance_officer VARCHAR(128),
        last_review TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS fb_settings (
        key VARCHAR(64) PRIMARY KEY,
        value TEXT NOT NULL
      );
    `);

    const clients = [
      ['cli-001','Sarah Mitchell','Conservative','Individual',125000.00,'verified',2],
      ['cli-002','James Okonkwo','Moderate','Individual',342000.00,'verified',3],
      ['cli-003','Priya Sharma','Aggressive','Individual',89000.00,'pending',1],
      ['cli-004','TechVentures Inc.','Moderate','Corporate',1250000.00,'verified',5],
      ['cli-005','Robert Chen','Conservative','Joint',567000.00,'verified',4],
      ['cli-006','Fatima Al-Hassan','Moderate','Individual',231000.00,'review',2],
      ['cli-007','Daniel Tremblay','Aggressive','Individual',78000.00,'pending',1],
      ['cli-008','ABC Holdings Ltd.','Conservative','Corporate',2100000.00,'verified',6],
    ];
    for (const [id,name,rp,at,aum,ks,pc] of clients) {
      await client.query(
        `INSERT INTO fb_clients VALUES ($1,$2,$3,$4,$5,$6,$7,NOW()) ON CONFLICT DO NOTHING`,
        [id,name,rp,at,aum,ks,pc]
      );
    }

    const products = [
      ['prd-001','Canadian Equity Index Fund','Mutual Fund','Medium',1000.00,8.5,true],
      ['prd-002','Government Bond Fund','Bond','Low',500.00,3.2,true],
      ['prd-003','S&P 500 ETF','ETF','Medium',100.00,10.1,true],
      ['prd-004','Tech Growth Fund','Mutual Fund','High',2500.00,15.3,true],
      ['prd-005','Real Estate REIT','REIT','Medium',1000.00,6.8,true],
      ['prd-006','Global Dividend ETF','ETF','Low',100.00,4.5,true],
      ['prd-007','Energy Sector Fund','Mutual Fund','High',5000.00,12.7,true],
      ['prd-008','Term Life Insurance','Insurance','Low',50.00,0.0,true],
      ['prd-009','Blue Chip Stock Portfolio','Stock','Medium',10000.00,9.2,true],
      ['prd-010','Emerging Markets ETF','ETF','High',500.00,11.8,false],
    ];
    for (const [id,name,pt,rl,mi,er,ia] of products) {
      await client.query(
        `INSERT INTO fb_products VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT DO NOTHING`,
        [id,name,pt,rl,mi,er,ia]
      );
    }

    const trades = [
      ['trd-001','cli-001','prd-001','Buy',25000.00,'executed'],
      ['trd-002','cli-001','prd-002','Buy',50000.00,'executed'],
      ['trd-003','cli-002','prd-003','Buy',75000.00,'executed'],
      ['trd-004','cli-002','prd-004','Buy',40000.00,'executed'],
      ['trd-005','cli-003','prd-009','Buy',20000.00,'executed'],
      ['trd-006','cli-004','prd-001','Buy',500000.00,'executed'],
      ['trd-007','cli-004','prd-006','Buy',200000.00,'executed'],
      ['trd-008','cli-005','prd-002','Buy',150000.00,'executed'],
      ['trd-009','cli-005','prd-005','Buy',100000.00,'executed'],
      ['trd-010','cli-006','prd-003','Buy',50000.00,'executed'],
      ['trd-011','cli-007','prd-010','Buy',15000.00,'pending'],
      ['trd-012','cli-008','prd-001','Rebalance',800000.00,'executed'],
      ['trd-013','cli-002','prd-003','Sell',25000.00,'executed'],
      ['trd-014','cli-004','prd-004','Buy',300000.00,'pending'],
      ['trd-015','cli-001','prd-008','Buy',1200.00,'executed'],
    ];
    for (const [tid,cid,pid,tt,amt,st] of trades) {
      await client.query(
        `INSERT INTO fb_trades (trade_id,client_id,product_id,trade_type,amount_usd,status,executed_at)
         VALUES ($1,$2,$3,$4,$5,$6,CASE WHEN $6='executed' THEN NOW() ELSE NULL END)
         ON CONFLICT (trade_id) DO NOTHING`,
        [tid,cid,pid,tt,amt,st]
      );
    }

    const kycs = [
      ['cli-001','{"id":true,"address":true,"income":true,"sin":true}','cleared','Anna Wilson'],
      ['cli-002','{"id":true,"address":true,"income":true,"pan":true}','cleared','Robert Hughes'],
      ['cli-003','{"id":true,"address":false,"income":false}','pending',null],
      ['cli-004','{"id":true,"address":true,"income":true,"sin":true}','cleared','Anna Wilson'],
      ['cli-005','{"id":true,"address":true,"income":true,"sin":true}','cleared','Robert Hughes'],
      ['cli-006','{"id":true,"address":true,"income":false}','review','Anna Wilson'],
      ['cli-007','{"id":false,"address":false}','pending',null],
      ['cli-008','{"id":true,"address":true,"income":true,"sin":true}','cleared','Robert Hughes'],
    ];
    for (const [cid,docs,aml,co] of kycs) {
      await client.query(
        `INSERT INTO fb_kyc (client_id,docs_submitted,aml_status,compliance_officer,last_review)
         VALUES ($1,$2::jsonb,$3,$4,NOW()) ON CONFLICT DO NOTHING`,
        [cid,docs,aml,co]
      );
    }

    const settings = [
      ['management_fee_pct','1.25'],
      ['performance_fee_pct','15.0'],
      ['compliance_jurisdiction','Canada'],
      ['kyc_reverification_months','24'],
    ];
    for (const [k,v] of settings) {
      await client.query(
        `INSERT INTO fb_settings VALUES ($1,$2) ON CONFLICT DO NOTHING`,
        [k,v]
      );
    }
  } finally {
    client.release();
  }
}

export async function GET(req: NextRequest) {
  const authErr = await requireAdmin(req);
  if (authErr) return authErr;
  await ensureTables();
  const pool = getPool();
  const client = await pool.connect();
  try {
    const [clients, products, trades, kyc] = await Promise.all([
      client.query('SELECT * FROM fb_clients ORDER BY aum_usd DESC'),
      client.query('SELECT * FROM fb_products ORDER BY product_type, name'),
      client.query('SELECT * FROM fb_trades ORDER BY created_at DESC'),
      client.query('SELECT * FROM fb_kyc'),
    ]);
    const totalAum = clients.rows.reduce((s, r) => s + Number(r.aum_usd), 0);
    const buysMtd = trades.rows.filter(t => t.trade_type === 'Buy' && t.status === 'executed')
      .reduce((s, t) => s + Number(t.amount_usd), 0);
    const sellsMtd = trades.rows.filter(t => t.trade_type === 'Sell' && t.status === 'executed')
      .reduce((s, t) => s + Number(t.amount_usd), 0);
    const feeRevenue = totalAum * 0.0125 / 12;
    return NextResponse.json({
      clients: clients.rows,
      products: products.rows,
      trades: trades.rows,
      kyc: kyc.rows,
      reports: {
        total_aum: totalAum,
        net_new_money_mtd: buysMtd,
        redemptions_mtd: sellsMtd,
        fee_revenue_mtd: Math.round(feeRevenue),
      },
    });
  } finally {
    client.release();
  }
}

export async function POST(req: NextRequest) {
  const authErr = await requireAdmin(req);
  if (authErr) return authErr;
  await ensureTables();
  const body = await req.json();
  const pool = getPool();
  const client = await pool.connect();
  try {
    if (body.action === 'create_trade') {
      const id = `trd-${Date.now()}`;
      const r = await client.query(
        `INSERT INTO fb_trades (trade_id,client_id,product_id,trade_type,amount_usd,status)
         VALUES ($1,$2,$3,$4,$5,'pending') RETURNING *`,
        [id, body.client_id, body.product_id, body.trade_type, body.amount_usd]
      );
      return NextResponse.json(r.rows[0]);
    }
    if (body.action === 'create_client') {
      const id = `cli-${Date.now()}`;
      const r = await client.query(
        `INSERT INTO fb_clients (client_id,name,risk_profile,account_type,kyc_status)
         VALUES ($1,$2,$3,$4,'pending') RETURNING *`,
        [id, body.name, body.risk_profile, body.account_type]
      );
      return NextResponse.json(r.rows[0]);
    }
    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } finally {
    client.release();
  }
}

export async function PATCH(req: NextRequest) {
  const authErr = await requireAdmin(req);
  if (authErr) return authErr;
  await ensureTables();
  const body = await req.json();
  const pool = getPool();
  const client = await pool.connect();
  try {
    if (body.type === 'trade') {
      const r = await client.query(
        `UPDATE fb_trades SET status=$1, executed_at=CASE WHEN $1='executed' THEN NOW() ELSE executed_at END
         WHERE trade_id=$2 RETURNING *`,
        [body.status, body.trade_id]
      );
      return NextResponse.json(r.rows[0]);
    }
    if (body.type === 'kyc') {
      const r = await client.query(
        `UPDATE fb_kyc SET aml_status=$1, last_review=NOW() WHERE client_id=$2 RETURNING *`,
        [body.aml_status, body.client_id]
      );
      return NextResponse.json(r.rows[0]);
    }
    return NextResponse.json({ error: 'Unknown type' }, { status: 400 });
  } finally {
    client.release();
  }
}
