import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool, databaseConfigured } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function ensureTable(): Promise<void> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS retainer_invoices (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        client_name TEXT NOT NULL,
        client_email TEXT,
        invoice_number TEXT UNIQUE,
        period_month TEXT,
        retainer_amount_cad NUMERIC(10,2),
        additional_charges NUMERIC(10,2) DEFAULT 0,
        additional_charges_desc TEXT,
        total_cad NUMERIC(10,2),
        status TEXT DEFAULT 'pending',
        due_date DATE,
        paid_at TIMESTAMPTZ,
        payment_method TEXT,
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    const { rows } = await client.query(`SELECT COUNT(*) AS n FROM retainer_invoices`);
    if (parseInt(rows[0].n, 10) === 0) {
      await client.query(`
        INSERT INTO retainer_invoices
          (client_name, client_email, invoice_number, period_month, retainer_amount_cad, additional_charges, additional_charges_desc, total_cad, status, due_date, paid_at, payment_method, notes)
        VALUES
          ('Maple Leaf Retail Co.', 'sandra@mapleleafretail.ca', 'RET-2026-09-001', '2026-09', 3200.00, 0.00, NULL, 3200.00, 'paid', '2026-09-15', '2026-09-12 10:30:00+00', 'EFT', 'Paid early. Q3 retainer confirmed.'),
          ('Northern Health Solutions', 'afarooq@nhsolutions.ca', 'RET-2026-09-002', '2026-09', 4500.00, 800.00, 'Extra creative hours for brochure design', 5300.00, 'paid', '2026-09-15', '2026-09-14 15:00:00+00', 'Wire', NULL),
          ('Finvest Capital Group', 'rliu@finvestcapital.ca', 'RET-2026-09-003', '2026-09', 2800.00, 0.00, NULL, 2800.00, 'overdue', '2026-09-01', NULL, NULL, 'Client flagged dispute on campaign performance. Escalated.'),
          ('BlueSky Tech Inc.', 'jparker@blueskytech.ca', 'RET-2026-09-004', '2026-09', 2200.00, 0.00, NULL, 2200.00, 'sent', '2026-09-20', NULL, NULL, 'First invoice — new client onboarding.'),
          ('Maple Leaf Retail Co.', 'sandra@mapleleafretail.ca', 'RET-2026-10-001', '2026-10', 3200.00, 500.00, 'Thanksgiving campaign social boosting', 3700.00, 'pending', '2026-10-15', NULL, NULL, NULL),
          ('Northern Health Solutions', 'afarooq@nhsolutions.ca', 'RET-2026-10-002', '2026-10', 4500.00, 0.00, NULL, 4500.00, 'pending', '2026-10-15', NULL, NULL, NULL)
      `);
    }
  } finally {
    client.release();
  }
}

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'Database unavailable.' }, { status: 503 });
  try {
    await ensureTable();
    const pool = getPool();
    const client = await pool.connect();
    try {
      const url = new URL(req.url);
      const status = url.searchParams.get('status');
      let queryText = `SELECT * FROM retainer_invoices`;
      const values: unknown[] = [];
      if (status) {
        queryText += ` WHERE status = $1`;
        values.push(status);
      }
      queryText += ` ORDER BY created_at DESC`;
      const { rows } = await client.query(queryText, values);

      // Summary stats
      const { rows: stats } = await client.query(`
        SELECT
          COALESCE(SUM(total_cad) FILTER (WHERE status = 'paid'), 0) AS total_collected,
          COALESCE(SUM(total_cad) FILTER (WHERE status IN ('pending','sent')), 0) AS outstanding,
          COALESCE(SUM(total_cad) FILTER (WHERE status = 'overdue'), 0) AS overdue_amount,
          COUNT(*) FILTER (WHERE status = 'overdue') AS overdue_count,
          COALESCE(SUM(retainer_amount_cad) FILTER (WHERE period_month = to_char(NOW(),'YYYY-MM')), 0) AS mrr
        FROM retainer_invoices
      `);

      return Response.json({ invoices: rows, stats: stats[0] });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('retainer-billing GET error:', err);
    return Response.json({ error: 'Failed to fetch invoices.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'Database unavailable.' }, { status: 503 });
  try {
    await ensureTable();
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') return Response.json({ error: 'Invalid request body.' }, { status: 400 });
    const {
      client_name, client_email, period_month, retainer_amount_cad,
      additional_charges = 0, additional_charges_desc, due_date, notes,
    } = body;
    if (!client_name?.trim() || !period_month?.trim()) {
      return Response.json({ error: 'client_name and period_month are required.' }, { status: 400 });
    }
    if (typeof retainer_amount_cad !== 'number' || retainer_amount_cad <= 0) {
      return Response.json({ error: 'retainer_amount_cad must be a positive number.' }, { status: 400 });
    }

    const pool = getPool();
    const client = await pool.connect();
    try {
      // Generate sequential invoice number: RET-YYYY-MM-NNN
      const { rows: seqRows } = await client.query(
        `SELECT COUNT(*) AS n FROM retainer_invoices WHERE period_month = $1`, [period_month]
      );
      const seq = parseInt(seqRows[0].n, 10) + 1;
      const invoice_number = `RET-${period_month}-${String(seq).padStart(3, '0')}`;
      const total_cad = Number(retainer_amount_cad) + Number(additional_charges);

      const { rows } = await client.query(
        `INSERT INTO retainer_invoices
           (client_name, client_email, invoice_number, period_month, retainer_amount_cad,
            additional_charges, additional_charges_desc, total_cad, status, due_date, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'pending',$9,$10)
         RETURNING *`,
        [
          client_name.trim(), client_email || null, invoice_number,
          period_month.trim(), retainer_amount_cad, additional_charges,
          additional_charges_desc || null, total_cad, due_date || null, notes || null,
        ]
      );
      return Response.json({ invoice: rows[0] }, { status: 201 });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('retainer-billing POST error:', err);
    return Response.json({ error: 'Failed to create invoice.' }, { status: 500 });
  }
}
