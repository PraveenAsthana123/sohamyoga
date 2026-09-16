import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool, databaseConfigured } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type ExportType = 'xls' | 'csv' | 'pdf';
type Dataset = 'invoices' | 'contracts' | 'leads' | 'orders' | 'analytics' | 'brochures';

interface ExportFilters {
  startDate?: string;
  endDate?: string;
  status?: string;
}

interface ExportBody {
  type: ExportType;
  dataset: Dataset;
  filters?: ExportFilters;
}

// ── Dataset query builders ────────────────────────────────────────────────────

function buildQuery(dataset: Dataset, filters: ExportFilters): { sql: string; values: unknown[]; columns: string[] } {
  const values: unknown[] = [];
  let conditions = 'WHERE 1=1';

  function addDate(col: string) {
    if (filters.startDate) {
      values.push(filters.startDate);
      conditions += ` AND ${col} >= $${values.length}::DATE`;
    }
    if (filters.endDate) {
      values.push(filters.endDate);
      conditions += ` AND ${col} <= $${values.length}::DATE`;
    }
  }

  function addStatus(col: string) {
    if (filters.status) {
      values.push(filters.status);
      conditions += ` AND ${col} = $${values.length}`;
    }
  }

  switch (dataset) {
    case 'contracts':
      addDate('created_at');
      addStatus('status');
      return {
        sql: `SELECT id, title, client_name, client_email, contract_type, status, value_cad, start_date, end_date, signed_at, created_at
              FROM contracts ${conditions} AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 5000`,
        values,
        columns: ['id', 'title', 'client_name', 'client_email', 'contract_type', 'status', 'value_cad', 'start_date', 'end_date', 'signed_at', 'created_at'],
      };

    case 'brochures':
      addDate('created_at');
      addStatus('status');
      return {
        sql: `SELECT id, title, category, version, status, download_count, file_url, created_at
              FROM brochures ${conditions} ORDER BY created_at DESC LIMIT 5000`,
        values,
        columns: ['id', 'title', 'category', 'version', 'status', 'download_count', 'file_url', 'created_at'],
      };

    case 'leads': {
      addDate('created_at');
      addStatus('lead_stage');
      // Try crm_lead first, fall back to contact_submission
      return {
        sql: `SELECT id, first_name, last_name, email, phone, company, lead_source, lead_stage, lead_score, created_at
              FROM crm_lead ${conditions} ORDER BY created_at DESC LIMIT 5000`,
        values,
        columns: ['id', 'first_name', 'last_name', 'email', 'phone', 'company', 'lead_source', 'lead_stage', 'lead_score', 'created_at'],
      };
    }

    case 'orders':
      addDate('created_at');
      addStatus('status');
      return {
        sql: `SELECT id, customer_id, status, total_amount, currency, created_at
              FROM orders ${conditions} ORDER BY created_at DESC LIMIT 5000`,
        values,
        columns: ['id', 'customer_id', 'status', 'total_amount', 'currency', 'created_at'],
      };

    case 'analytics':
      addDate('date');
      return {
        sql: `SELECT date, source, sessions, conversions, revenue_cad
              FROM analytics_daily ${conditions} ORDER BY date DESC LIMIT 5000`,
        values,
        columns: ['date', 'source', 'sessions', 'conversions', 'revenue_cad'],
      };

    case 'invoices':
    default:
      addDate('due_date');
      addStatus('status');
      return {
        sql: `SELECT im.id, im.invoice_number, c.display_name AS customer_name, im.status,
                     im.amount_cad, im.tax_cad, im.total_cad, im.description, im.due_date, im.paid_at
              FROM invoice_mirror im JOIN customer c ON c.id = im.customer_id
              ${conditions} ORDER BY im.due_date DESC NULLS LAST LIMIT 5000`,
        values,
        columns: ['id', 'invoice_number', 'customer_name', 'status', 'amount_cad', 'tax_cad', 'total_cad', 'description', 'due_date', 'paid_at'],
      };
  }
}

// ── CSV builder ───────────────────────────────────────────────────────────────

function toCSV(columns: string[], rows: Record<string, unknown>[]): string {
  const escape = (v: unknown): string => {
    if (v === null || v === undefined) return '';
    const s = String(v instanceof Date ? v.toISOString() : v);
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };

  const header = columns.join(',');
  const body = rows.map(row => columns.map(col => escape(row[col])).join(',')).join('\n');
  return header + '\n' + body;
}

// ── Handler ───────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const body = await req.json().catch(() => null) as ExportBody | null;
  if (!body?.type || !body?.dataset) {
    return Response.json({ error: 'type and dataset are required.' }, { status: 400 });
  }

  const VALID_TYPES: ExportType[] = ['xls', 'csv', 'pdf'];
  const VALID_DATASETS: Dataset[] = ['invoices', 'contracts', 'leads', 'orders', 'analytics', 'brochures'];
  if (!VALID_TYPES.includes(body.type)) return Response.json({ error: 'Invalid export type.' }, { status: 400 });
  if (!VALID_DATASETS.includes(body.dataset)) return Response.json({ error: 'Invalid dataset.' }, { status: 400 });

  const filters = body.filters ?? {};
  const { sql, values, columns } = buildQuery(body.dataset, filters);

  const pool = getPool();
  const client = await pool.connect();
  try {
    const { rows } = await client.query(sql, values);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

    if (body.type === 'csv' || body.type === 'xls') {
      const csv = toCSV(columns, rows as Record<string, unknown>[]);
      return new Response(csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="export-${body.dataset}-${timestamp}.csv"`,
        },
      });
    }

    // PDF → return structured JSON for client-side print
    return Response.json({
      title: `${body.dataset.charAt(0).toUpperCase() + body.dataset.slice(1)} Export`,
      dataset: body.dataset,
      columns,
      rows,
      generatedAt: new Date().toISOString(),
      filters,
      rowCount: rows.length,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Query failed';
    // Return empty result if table doesn't exist yet
    if (msg.includes('does not exist') || msg.includes('relation')) {
      if (body.type === 'csv' || body.type === 'xls') {
        const csv = columns.join(',') + '\n';
        return new Response(csv, {
          headers: {
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': `attachment; filename="export-${body.dataset}-${timestamp_safe()}.csv"`,
          },
        });
      }
      return Response.json({ title: body.dataset, columns, rows: [], generatedAt: new Date().toISOString(), filters, rowCount: 0 });
    }
    return Response.json({ error: msg }, { status: 500 });
  } finally {
    client.release();
  }
}

function timestamp_safe() {
  return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
}
