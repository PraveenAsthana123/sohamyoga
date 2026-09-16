import { NextRequest } from 'next/server';
import { getAdminPrincipal } from '@/lib/admin-auth';
import { databaseConfigured, query, transaction } from '@/lib/postgres';

export const dynamic = 'force-dynamic';

async function access(req: NextRequest) {
  const auth = await getAdminPrincipal(req);
  if (auth.denied) return auth;
  if (!databaseConfigured()) return { denied: Response.json({ error: 'Database unavailable.' }, { status: 503 }) };
  return auth;
}

export async function GET(req: NextRequest) {
  const auth = await access(req);
  if (auth.denied) return auth.denied;

  const url = new URL(req.url);
  const period = url.searchParams.get('period');
  const status = url.searchParams.get('status');

  // Outstanding balances per partner
  const outstanding = await query(`
    SELECT p.id, p.name, p.email, p.tier, p.total_earned, p.total_paid,
           (p.total_earned - p.total_paid) AS balance,
           p.commission_rate_bps
    FROM affiliate_partner p
    WHERE p.status = 'approved'
      AND (p.total_earned - p.total_paid) > 0
    ORDER BY (p.total_earned - p.total_paid) DESC
  `);

  let payoutSql = `
    SELECT ap.*, p.name AS partner_name, p.email AS partner_email
    FROM affiliate_payout ap
    LEFT JOIN affiliate_partner p ON p.id = ap.partner_id
    WHERE 1=1
  `;
  const params: unknown[] = [];
  let i = 1;

  if (period) { payoutSql += ` AND ap.period = $${i++}`; params.push(period); }
  if (status) { payoutSql += ` AND ap.status = $${i++}`; params.push(status); }
  payoutSql += ` ORDER BY ap.created_at DESC LIMIT 200`;

  const payouts = await query(payoutSql, params);

  const summary = await query(`
    SELECT
      COALESCE(SUM(amount) FILTER (WHERE status='pending'), 0) AS pending_total,
      COALESCE(SUM(amount) FILTER (WHERE status='paid'), 0) AS paid_total,
      COUNT(*) FILTER (WHERE status='pending') AS pending_count
    FROM affiliate_payout
  `);

  return Response.json({
    outstanding: outstanding.rows,
    payouts: payouts.rows,
    summary: summary.rows[0] ?? {},
  });
}

export async function POST(req: NextRequest) {
  const auth = await access(req);
  if (auth.denied) return auth.denied;

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') return Response.json({ error: 'Invalid request.' }, { status: 400 });

  if (body.action === 'generate_batch') {
    // Generate payout rows for all partners with balance > $10
    const now = new Date();
    const period = `${now.getFullYear()}-${String(now.getMonth()).padStart(2, '0')}`; // last month
    const periodLabel = period === `${now.getFullYear()}-00`
      ? `${now.getFullYear() - 1}-12`
      : period;

    const eligible = await query(`
      SELECT id, name, (total_earned - total_paid) AS balance
      FROM affiliate_partner
      WHERE status = 'approved'
        AND (total_earned - total_paid) > 10
    `);

    let created = 0;
    for (const p of eligible.rows) {
      const existing = await query(
        `SELECT id FROM affiliate_payout WHERE partner_id = $1 AND period = $2`,
        [p.id, periodLabel]
      );
      if (!existing.rowCount) {
        await query(
          `INSERT INTO affiliate_payout (partner_id, period, amount, status) VALUES ($1,$2,$3,'pending')`,
          [p.id, periodLabel, p.balance]
        );
        created++;
      }
    }

    return Response.json({ ok: true, period: periodLabel, created, eligible: eligible.rows.length });
  }

  if (body.action === 'mark_paid') {
    if (!body.payout_id || !body.payment_method || !body.payment_reference) {
      return Response.json({ error: 'Payout ID, payment method, and reference required.' }, { status: 400 });
    }

    const result = await transaction(async (client) => {
      const payout = await client.query(
        `UPDATE affiliate_payout SET status='paid', payment_method=$2, payment_reference=$3, paid_at=NOW() WHERE id=$1 RETURNING *`,
        [body.payout_id, body.payment_method, body.payment_reference]
      );
      if (!payout.rowCount) return null;

      // Update partner total_paid
      await client.query(
        `UPDATE affiliate_partner SET total_paid = total_paid + $2, updated_at=NOW() WHERE id=$1`,
        [payout.rows[0].partner_id, payout.rows[0].amount]
      );

      return payout.rows[0];
    });

    return result ? Response.json({ ok: true, payout: result }) : Response.json({ error: 'Payout not found.' }, { status: 404 });
  }

  if (body.action === 'update_notes') {
    const result = await query(
      `UPDATE affiliate_payout SET notes=$2 WHERE id=$1 RETURNING *`,
      [body.payout_id, body.notes || null]
    );
    return result.rowCount ? Response.json({ ok: true }) : Response.json({ error: 'Not found.' }, { status: 404 });
  }

  return Response.json({ error: 'Unknown action.' }, { status: 400 });
}
