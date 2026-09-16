import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { pool } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function ensureTables(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS performance_metric (
        id SERIAL PRIMARY KEY,
        metric_code TEXT UNIQUE NOT NULL,
        metric_type TEXT NOT NULL,
        category TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        unit TEXT DEFAULT '%',
        direction TEXT DEFAULT 'higher_better',
        current_value NUMERIC,
        target_value NUMERIC,
        baseline_value NUMERIC,
        min_threshold NUMERIC,
        max_threshold NUMERIC,
        status TEXT DEFAULT 'on_track',
        frequency TEXT DEFAULT 'monthly',
        owner TEXT,
        last_updated_at TIMESTAMPTZ DEFAULT NOW(),
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS metric_snapshot (
        id SERIAL PRIMARY KEY,
        metric_id INTEGER REFERENCES performance_metric(id) ON DELETE CASCADE,
        value NUMERIC NOT NULL,
        recorded_at DATE NOT NULL DEFAULT CURRENT_DATE,
        notes TEXT,
        source TEXT DEFAULT 'manual'
      )
    `);

    // Seed metrics
    const seeds = [
      ['KPI-MKT-001','KPI','marketing','Customer Acquisition Cost','Cost to acquire one new customer','$','lower_better',45,35,60,null,null],
      ['KPI-MKT-002','KPI','marketing','ROAS','Return on Ad Spend','ratio','higher_better',3.2,4.0,2.5,null,null],
      ['KPI-MKT-003','KPI','marketing','Email Open Rate','% of emails opened','%','higher_better',24.5,30,20,null,null],
      ['KPI-SAL-001','KPI','sales','Lead-to-Customer Rate','% of leads that convert','%','higher_better',8.5,15,5,null,null],
      ['KPI-SAL-002','KPI','sales','Sales Cycle Length','Avg days from lead to close','days','lower_better',28,21,35,null,null],
      ['KPI-FIN-001','KPI','finance','Monthly Recurring Revenue','MRR in USD','$','higher_better',12500,20000,8000,null,null],
      ['KPI-OPS-001','KPI','operations','Order Fulfillment Time','Avg hours from order to ship','hours','lower_better',18,12,24,null,null],
      ['KPI-CUS-001','KPI','customer','Net Promoter Score','Customer satisfaction score','score','higher_better',42,60,30,null,null],
      ['KRI-FIN-001','KRI','finance','Cash Runway','Months of cash remaining','months','higher_better',14,12,8,6,null],
      ['KRI-TEC-001','KRI','tech','System Uptime','% uptime last 30 days','%','higher_better',99.2,99.9,95,95,null],
      ['KRI-CUS-001','KRI','customer','Churn Rate','Monthly customer churn %','%','lower_better',2.8,2.0,5.0,null,5.0],
      ['ROI-CAM-001','ROI','marketing','Campaign ROI','Return on campaign investment','%','higher_better',185,200,100,null,null],
      ['ROI-TECH-001','ROI','tech','Platform ROI','Revenue generated per $ platform cost','ratio','higher_better',4.2,5.0,3.0,null,null],
    ];
    for (const s of seeds) {
      await client.query(
        `INSERT INTO performance_metric
           (metric_code,metric_type,category,name,description,unit,direction,current_value,target_value,baseline_value,min_threshold,max_threshold)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
         ON CONFLICT (metric_code) DO NOTHING`,
        s,
      );
    }
  } finally {
    client.release();
  }
}

function computeStatus(m: {
  metric_type: string;
  direction: string;
  current_value: number | null;
  target_value: number | null;
  min_threshold: number | null;
  max_threshold: number | null;
}): string {
  if (m.current_value === null) return 'not_measured';
  if (m.metric_type === 'KRI') {
    const belowMin = m.min_threshold !== null && m.current_value < m.min_threshold;
    const aboveMax = m.max_threshold !== null && m.current_value > m.max_threshold;
    if (belowMin || aboveMax) return 'off_track';
    // near threshold (within 10%)
    const nearMin = m.min_threshold !== null && m.current_value < m.min_threshold * 1.1;
    const nearMax = m.max_threshold !== null && m.current_value > m.max_threshold * 0.9;
    if (nearMin || nearMax) return 'at_risk';
    return 'on_track';
  }
  // KPI / ROI / OKR / NPS / SLA
  if (m.target_value === null) return 'not_measured';
  const ratio = m.current_value / m.target_value;
  if (m.direction === 'lower_better') {
    if (m.current_value <= m.target_value) return 'exceeded';
    if (m.current_value <= m.target_value * 1.2) return 'on_track';
    if (m.current_value <= m.target_value * 1.5) return 'at_risk';
    return 'off_track';
  }
  if (ratio >= 1) return 'exceeded';
  if (ratio >= 0.8) return 'on_track';
  if (ratio >= 0.6) return 'at_risk';
  return 'off_track';
}

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  await ensureTables().catch(() => {});

  const client = await pool.connect();
  try {
    const metricsResult = await client.query('SELECT * FROM performance_metric ORDER BY metric_type, category, name').catch(() => ({ rows: [] as Record<string, unknown>[] }));
    const metrics = (metricsResult.rows as Array<{
      id: number;
      metric_type: string;
      direction: string;
      current_value: number | null;
      target_value: number | null;
      min_threshold: number | null;
      max_threshold: number | null;
    }>).map(m => ({ ...m, computed_status: computeStatus(m) }));

    const snapshotsResult = await client.query(`
      SELECT ms.*, pm.metric_code
      FROM metric_snapshot ms
      JOIN performance_metric pm ON pm.id = ms.metric_id
      ORDER BY ms.metric_id, ms.recorded_at DESC
      LIMIT 500
    `).catch(() => ({ rows: [] }));

    return Response.json({ metrics, snapshots: snapshotsResult.rows });
  } finally {
    client.release();
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  await ensureTables().catch(() => {});

  const body = await req.json();
  const {
    metric_code, metric_type, category, name, description, unit,
    direction, current_value, target_value, baseline_value,
    min_threshold, max_threshold, frequency, owner,
  } = body;

  const client = await pool.connect();
  try {
    const result = await client.query(
      `INSERT INTO performance_metric
         (metric_code,metric_type,category,name,description,unit,direction,current_value,target_value,baseline_value,min_threshold,max_threshold,frequency,owner)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       RETURNING *`,
      [metric_code, metric_type, category, name, description, unit, direction,
       current_value, target_value, baseline_value, min_threshold, max_threshold, frequency, owner],
    );
    return Response.json({ metric: result.rows[0] }, { status: 201 });
  } finally {
    client.release();
  }
}

export async function PATCH(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const body = await req.json();
  const { id, current_value, notes, ...rest } = body;

  const client = await pool.connect();
  try {
    // Build dynamic SET clause for optional fields
    const fields: string[] = ['last_updated_at = NOW()'];
    const vals: unknown[] = [];
    let idx = 1;

    if (current_value !== undefined) { fields.push(`current_value = $${idx++}`); vals.push(current_value); }
    const optFields = ['target_value','baseline_value','min_threshold','max_threshold','frequency','owner','status','name','description','unit','direction'] as const;
    for (const f of optFields) {
      if (rest[f] !== undefined) { fields.push(`${f} = $${idx++}`); vals.push(rest[f]); }
    }
    vals.push(id);

    const result = await client.query(
      `UPDATE performance_metric SET ${fields.join(',')} WHERE id = $${idx} RETURNING *`,
      vals,
    );
    if (result.rows.length === 0) return Response.json({ error: 'Not found' }, { status: 404 });

    // Auto-log snapshot when current_value is updated
    if (current_value !== undefined) {
      await client.query(
        `INSERT INTO metric_snapshot (metric_id, value, notes, source) VALUES ($1,$2,$3,'admin_update')`,
        [id, current_value, notes ?? null],
      ).catch(() => {});
    }

    return Response.json({ metric: result.rows[0] });
  } finally {
    client.release();
  }
}
