import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { pool } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function ensureTable() {
  await pool.query(`CREATE TABLE IF NOT EXISTS detection_alert (
    id SERIAL PRIMARY KEY,
    alert_type TEXT NOT NULL,
    severity TEXT DEFAULT 'medium',
    title TEXT NOT NULL,
    description TEXT,
    entity_type TEXT,
    entity_id TEXT,
    detected_value NUMERIC,
    threshold_value NUMERIC,
    status TEXT DEFAULT 'open',
    resolved_at TIMESTAMPTZ,
    resolved_by TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`);
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  await ensureTable();

  let alertsCreated = 0;

  // Rule 1: Check for IPs with >100 requests in last hour (intrusion detection)
  await (async () => {
    const { rows } = await pool.query(
      `SELECT ip_address, COUNT(*) as req_count FROM api_request_log
       WHERE created_at > NOW() - INTERVAL '1 hour'
       GROUP BY ip_address HAVING COUNT(*) > 100 LIMIT 10`
    ).catch(() => ({ rows: [] as Array<{ip_address: string; req_count: string}> }));
    for (const row of rows) {
      await pool.query(
        `INSERT INTO detection_alert (alert_type, severity, title, description, entity_type, entity_id, detected_value, threshold_value)
         VALUES ('intrusion','high',$1,$2,'api_request',$3,$4,100)`,
        [
          `High request volume from ${row.ip_address}`,
          `IP ${row.ip_address} made ${row.req_count} requests in the last hour.`,
          row.ip_address,
          parseInt(row.req_count),
        ]
      ).catch(() => null);
      alertsCreated++;
    }
  })().catch(() => null);

  // Rule 2: Check for session_ids with >1000 events in last hour (bot detection)
  await (async () => {
    const { rows } = await pool.query(
      `SELECT session_id, COUNT(*) as evt_count FROM customer_event
       WHERE created_at > NOW() - INTERVAL '1 hour'
       GROUP BY session_id HAVING COUNT(*) > 1000 LIMIT 10`
    ).catch(() => ({ rows: [] as Array<{session_id: string; evt_count: string}> }));
    for (const row of rows) {
      await pool.query(
        `INSERT INTO detection_alert (alert_type, severity, title, description, entity_type, entity_id, detected_value, threshold_value)
         VALUES ('bot','high',$1,$2,'session',$3,$4,1000)`,
        [
          `Suspected bot session: ${row.session_id?.substring(0, 20)}...`,
          `Session ${row.session_id} generated ${row.evt_count} events in the last hour.`,
          row.session_id,
          parseInt(row.evt_count),
        ]
      ).catch(() => null);
      alertsCreated++;
    }
  })().catch(() => null);

  // Rule 3: Check for orders >10x average order value (fraud detection)
  await (async () => {
    const { rows: avgRows } = await pool.query(
      `SELECT AVG(total_amount) as avg_amount FROM sales_order WHERE created_at > NOW() - INTERVAL '30 days'`
    ).catch(() => ({ rows: [{ avg_amount: null }] }));
    const avg = parseFloat(avgRows[0]?.avg_amount || '0');
    if (avg > 0) {
      const threshold = avg * 10;
      const { rows: fraudRows } = await pool.query(
        `SELECT id, order_number, total_amount FROM sales_order
         WHERE total_amount > $1 AND created_at > NOW() - INTERVAL '7 days' LIMIT 10`,
        [threshold]
      ).catch(() => ({ rows: [] as Array<{id: string; order_number: string; total_amount: string}> }));
      for (const row of fraudRows) {
        await pool.query(
          `INSERT INTO detection_alert (alert_type, severity, title, description, entity_type, entity_id, detected_value, threshold_value)
           VALUES ('fraud','critical',$1,$2,'order',$3,$4,$5)`,
          [
            `Suspicious order value: ${row.order_number}`,
            `Order ${row.order_number} has value ${row.total_amount}, which is >10x the 30-day average of ${avg.toFixed(2)}.`,
            row.id,
            parseFloat(row.total_amount),
            threshold,
          ]
        ).catch(() => null);
        alertsCreated++;
      }
    }
  })().catch(() => null);

  return Response.json({ alerts_created: alertsCreated });
}
