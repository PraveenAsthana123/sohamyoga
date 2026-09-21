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
      CREATE TABLE IF NOT EXISTS hb_providers (
        provider_id VARCHAR(64) PRIMARY KEY,
        name VARCHAR(128) NOT NULL,
        provider_type VARCHAR(64) NOT NULL,
        network VARCHAR(32) NOT NULL,
        coverage_region VARCHAR(128) NOT NULL,
        status VARCHAR(32) NOT NULL DEFAULT 'active',
        contact_email VARCHAR(128)
      );
      CREATE TABLE IF NOT EXISTS hb_products (
        product_id VARCHAR(64) PRIMARY KEY,
        name VARCHAR(256) NOT NULL,
        product_type VARCHAR(64) NOT NULL,
        provider_id VARCHAR(64) NOT NULL,
        monthly_premium NUMERIC(10,2) NOT NULL DEFAULT 0,
        deductible NUMERIC(10,2) NOT NULL DEFAULT 0,
        inpatient_coverage_pct INT NOT NULL DEFAULT 80,
        outpatient_coverage_pct INT NOT NULL DEFAULT 80,
        status VARCHAR(32) NOT NULL DEFAULT 'active'
      );
      CREATE TABLE IF NOT EXISTS hb_referrals (
        id SERIAL PRIMARY KEY,
        referral_id VARCHAR(64) UNIQUE NOT NULL,
        client_name_masked VARCHAR(64) NOT NULL,
        product_id VARCHAR(64) NOT NULL,
        provider_id VARCHAR(64) NOT NULL,
        referred_by VARCHAR(128) NOT NULL,
        status VARCHAR(32) NOT NULL DEFAULT 'pending',
        commission_usd NUMERIC(10,2) NOT NULL DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS hb_claims (
        id SERIAL PRIMARY KEY,
        claim_id VARCHAR(64) UNIQUE NOT NULL,
        client_masked VARCHAR(64) NOT NULL,
        product_id VARCHAR(64) NOT NULL,
        claim_type VARCHAR(64) NOT NULL,
        amount_usd NUMERIC(10,2) NOT NULL,
        status VARCHAR(32) NOT NULL DEFAULT 'submitted',
        submitted_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS hb_settings (
        key VARCHAR(64) PRIMARY KEY,
        value TEXT NOT NULL
      );
    `);

    const providers = [
      ['prv-001','SunLife Canada','Insurance','Private','Canada-wide','active','broker@sunlife.ca'],
      ['prv-002','Alberta Health Services','Hospital','Public','Alberta','active','partners@ahs.ca'],
      ['prv-003','London Drugs Pharmacy','Pharmacy','Private','Western Canada','active','b2b@londondrugs.com'],
      ['prv-004','LifeLabs Medical','Lab','Private','Canada-wide','active','providers@lifelabs.com'],
      ['prv-005','Maple Telemedicine','Telemedicine','Private','Canada-wide','active','partners@getmaple.ca'],
      ['prv-006','GoodLife Wellness','Wellness','Private','Alberta','inactive','corporate@goodlifefitness.com'],
    ];
    for (const [id,name,pt,net,reg,st,email] of providers) {
      await client.query(
        `INSERT INTO hb_providers VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT DO NOTHING`,
        [id,name,pt,net,reg,st,email]
      );
    }

    const products = [
      ['hprd-001','Essential Health Plan','Health Insurance','prv-001',89.99,500.00,80,70,'active'],
      ['hprd-002','Comprehensive Health+','Health Insurance','prv-001',149.99,250.00,90,85,'active'],
      ['hprd-003','Dental Care Plus','Dental','prv-001',45.00,0.00,0,80,'active'],
      ['hprd-004','Vision Care Plan','Vision','prv-001',25.00,0.00,0,100,'active'],
      ['hprd-005','Term Life 500K','Life','prv-001',65.00,0.00,0,0,'active'],
      ['hprd-006','Short-Term Disability','Disability','prv-001',38.00,0.00,60,0,'active'],
      ['hprd-007','Telemedicine Basic','Wellness Plan','prv-005',19.99,0.00,0,100,'active'],
      ['hprd-008','Telemedicine Family','Wellness Plan','prv-005',34.99,0.00,0,100,'active'],
      ['hprd-009','Lab Diagnostics Package','Health Insurance','prv-004',0.00,0.00,0,75,'active'],
      ['hprd-010','Corporate Wellness Bundle','Wellness Plan','prv-006',55.00,0.00,0,80,'inactive'],
    ];
    for (const [id,name,pt,pvid,mp,ded,ip,op,st] of products) {
      await client.query(
        `INSERT INTO hb_products VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT DO NOTHING`,
        [id,name,pt,pvid,mp,ded,ip,op,st]
      );
    }

    const referrals = [
      ['ref-001','J. M*****','hprd-001','prv-001','Dr. Patel','converted',180.00],
      ['ref-002','S. K*****','hprd-002','prv-001','Agent Smith','pending',0],
      ['ref-003','A. C*****','hprd-007','prv-005','Dr. Patel','converted',40.00],
      ['ref-004','M. R*****','hprd-003','prv-001','Agent Brown','converted',90.00],
      ['ref-005','T. N*****','hprd-005','prv-001','Agent Smith','contacted',0],
      ['ref-006','L. W*****','hprd-001','prv-001','Agent Brown','declined',0],
      ['ref-007','P. G*****','hprd-008','prv-005','Dr. Patel','converted',70.00],
      ['ref-008','R. D*****','hprd-002','prv-001','Agent Smith','converted',300.00],
      ['ref-009','N. T*****','hprd-006','prv-001','Agent Brown','pending',0],
      ['ref-010','K. P*****','hprd-004','prv-001','Dr. Patel','converted',50.00],
      ['ref-011','H. J*****','hprd-001','prv-001','Agent Smith','contacted',0],
      ['ref-012','V. M*****','hprd-009','prv-004','Agent Brown','converted',25.00],
    ];
    for (const [id,cm,pid,pvid,rb,st,com] of referrals) {
      await client.query(
        `INSERT INTO hb_referrals (referral_id,client_name_masked,product_id,provider_id,referred_by,status,commission_usd)
         VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (referral_id) DO NOTHING`,
        [id,cm,pid,pvid,rb,st,com]
      );
    }

    const claims = [
      ['clm-001','J. M*****','hprd-001','hospitalization',3200.00,'approved'],
      ['clm-002','M. R*****','hprd-003','dental',450.00,'approved'],
      ['clm-003','P. G*****','hprd-008','prescription',85.00,'submitted'],
      ['clm-004','R. D*****','hprd-002','outpatient',620.00,'under_review'],
      ['clm-005','K. P*****','hprd-004','vision',280.00,'approved'],
      ['clm-006','A. C*****','hprd-007','prescription',45.00,'approved'],
      ['clm-007','J. M*****','hprd-001','hospitalization',8500.00,'under_review'],
      ['clm-008','S. K*****','hprd-002','dental',320.00,'rejected'],
      ['clm-009','V. M*****','hprd-009','lab','220.00','approved'],
      ['clm-010','R. D*****','hprd-002','hospitalization',5100.00,'submitted'],
    ];
    for (const [id,cm,pid,ct,amt,st] of claims) {
      await client.query(
        `INSERT INTO hb_claims (claim_id,client_masked,product_id,claim_type,amount_usd,status)
         VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (claim_id) DO NOTHING`,
        [id,cm,pid,ct,Number(amt),st]
      );
    }

    const settings = [
      ['commission_health_pct','15'],
      ['commission_dental_pct','10'],
      ['commission_life_pct','20'],
      ['referral_tracking_days','90'],
      ['hipaa_mode','true'],
    ];
    for (const [k,v] of settings) {
      await client.query(
        `INSERT INTO hb_settings VALUES ($1,$2) ON CONFLICT DO NOTHING`,
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
    const [providers, products, referrals, claims] = await Promise.all([
      client.query('SELECT * FROM hb_providers ORDER BY name'),
      client.query('SELECT * FROM hb_products ORDER BY product_type, name'),
      client.query('SELECT * FROM hb_referrals ORDER BY created_at DESC'),
      client.query('SELECT * FROM hb_claims ORDER BY submitted_at DESC'),
    ]);
    const converted = referrals.rows.filter(r => r.status === 'converted').length;
    const total = referrals.rows.length;
    const conversionRate = total > 0 ? ((converted / total) * 100).toFixed(1) : '0';
    const totalCommission = referrals.rows.reduce((s, r) => s + Number(r.commission_usd), 0);
    const topProducts = products.rows.slice(0, 5).map(p => ({
      name: p.name, type: p.product_type, premium: p.monthly_premium,
    }));
    return NextResponse.json({
      providers: providers.rows,
      products: products.rows,
      referrals: referrals.rows,
      claims: claims.rows,
      analytics: {
        conversion_rate: conversionRate,
        top_products: topProducts,
        monthly_commission: totalCommission,
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
    if (body.action === 'create_referral') {
      const id = `ref-${Date.now()}`;
      const r = await client.query(
        `INSERT INTO hb_referrals (referral_id,client_name_masked,product_id,provider_id,referred_by)
         VALUES ($1,$2,$3,$4,$5) RETURNING *`,
        [id, body.client_name_masked, body.product_id, body.provider_id, body.referred_by]
      );
      return NextResponse.json(r.rows[0]);
    }
    if (body.action === 'create_provider') {
      const id = `prv-${Date.now()}`;
      const r = await client.query(
        `INSERT INTO hb_providers (provider_id,name,provider_type,network,coverage_region,contact_email)
         VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
        [id, body.name, body.provider_type, body.network, body.coverage_region, body.contact_email]
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
    if (body.type === 'referral') {
      const r = await client.query(
        `UPDATE hb_referrals SET status=$1 WHERE referral_id=$2 RETURNING *`,
        [body.status, body.referral_id]
      );
      return NextResponse.json(r.rows[0]);
    }
    if (body.type === 'claim') {
      const r = await client.query(
        `UPDATE hb_claims SET status=$1 WHERE claim_id=$2 RETURNING *`,
        [body.status, body.claim_id]
      );
      return NextResponse.json(r.rows[0]);
    }
    return NextResponse.json({ error: 'Unknown type' }, { status: 400 });
  } finally {
    client.release();
  }
}
