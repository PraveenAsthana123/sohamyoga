import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { getAdminPrincipal } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TRANSITIONS: Record<string, string[]> = {
  draft: ['sent'],
  sent: ['accepted', 'rejected', 'expired'],
  accepted: [],
  rejected: [],
  expired: [],
};

// Discount Approval -- a proposal discounted more than this off its real
// list_price cannot be sent without a real approved_by/approved_at record.
const DISCOUNT_APPROVAL_THRESHOLD_PERCENT = 15;

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { principal, denied } = await getAdminPrincipal(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const { id } = await params;
  const body = await req.json().catch(() => null) as { status?: string; approveDiscount?: boolean } | null;
  if (!body) return Response.json({ error: 'Invalid request body.' }, { status: 400 });

  const current = await query<{ status: string; list_price: string | null; amount: string; discount_percent: string | null; approved_by: string | null }>(
    `SELECT status, list_price, amount, discount_percent, approved_by FROM proposal WHERE id = $1`, [id],
  );
  if (!current.rowCount) return Response.json({ error: 'Proposal not found.' }, { status: 404 });
  const row = current.rows[0];

  if (body.approveDiscount) {
    await query(`UPDATE proposal SET approved_by = $2, approved_at = now(), updated_at = now() WHERE id = $1`, [id, principal?.email ?? 'admin']);
    return Response.json({ ok: true });
  }

  if (body.status !== undefined) {
    const allowed = TRANSITIONS[row.status] ?? [];
    if (!allowed.includes(body.status)) {
      return Response.json({ error: `Cannot move a "${row.status}" proposal to "${body.status}".` }, { status: 409 });
    }

    if (body.status === 'sent') {
      const discountPercent = row.list_price
        ? Math.round(((Number(row.list_price) - Number(row.amount)) / Number(row.list_price)) * 10000) / 100
        : (row.discount_percent !== null ? Number(row.discount_percent) : 0);
      if (discountPercent > DISCOUNT_APPROVAL_THRESHOLD_PERCENT && !row.approved_by) {
        return Response.json({
          error: `A ${discountPercent}% discount exceeds the ${DISCOUNT_APPROVAL_THRESHOLD_PERCENT}% approval threshold and has not been approved yet.`,
          requiresApproval: true, discountPercent,
        }, { status: 409 });
      }
    }

    const timestampCol = body.status === 'sent' ? 'sent_at' : ['accepted', 'rejected'].includes(body.status) ? 'decided_at' : null;
    await query(
      `UPDATE proposal SET status = $2, updated_at = now()${timestampCol ? `, ${timestampCol} = now()` : ''} WHERE id = $1`,
      [id, body.status],
    );

    // Real Quote -> Order -- sales_order had a rich state machine but was
    // NEVER populated by any real code path anywhere (grep-confirmed, see
    // module_registry seed note "no real storefront/checkout flow exists").
    // Accepting a proposal is this app's one real "quote accepted" moment,
    // so it is the first genuine INSERT INTO sales_order trigger.
    let orderId: string | undefined;
    if (body.status === 'accepted') {
      const proposal = await query<{ title: string; amount: string; currency: string }>(
        `SELECT title, amount, currency FROM proposal WHERE id = $1`, [id],
      );
      const lead = await query<{ email: string | null }>(
        `SELECT cl.email FROM proposal p JOIN campaign_lead cl ON cl.id = p.lead_id WHERE p.id = $1`, [id],
      );
      const email = lead.rows[0]?.email;
      if (email) {
        const pr = proposal.rows[0];
        const orderNumber = `PROP-${id.slice(0, 8).toUpperCase()}`;
        const order = await query<{ id: string }>(
          `INSERT INTO sales_order (order_number, customer_email, status, subtotal, total, currency, notes)
           VALUES ($1,$2,'pending',$3,$3,$4,$5)
           ON CONFLICT (order_number) DO NOTHING RETURNING id`,
          [orderNumber, email, pr.amount, pr.currency, `Created from accepted proposal: ${pr.title}`],
        );
        orderId = order.rows[0]?.id;
      }
    }
    return Response.json({ ok: true, orderId });
  }

  return Response.json({ ok: true });
}
