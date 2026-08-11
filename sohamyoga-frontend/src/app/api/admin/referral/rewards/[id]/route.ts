import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { getAdminPrincipal } from '@/lib/admin-auth';
import { ReferralReward, type ReferralRewardProps, type RewardStatus, type RewardType } from '@/domain/referral/ReferralReward';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface RewardRow {
  id: string; referral_id: string; referrer_id: string; referree_id: string;
  type: RewardType; value: string; currency: string | null; status: RewardStatus;
  approved_by: string | null; rejected_by: string | null; rejection_reason: string | null;
  paid_at: string | null; expires_at: string | null; created_at: string; updated_at: string;
}

function toDomain(r: RewardRow): ReferralReward {
  const props: ReferralRewardProps = {
    id: r.id, referralId: r.referral_id, referrerId: r.referrer_id, referreeId: r.referree_id,
    type: r.type, value: Number(r.value), currency: r.currency ?? undefined, status: r.status,
    approvedBy: r.approved_by ?? undefined, rejectedBy: r.rejected_by ?? undefined,
    rejectionReason: r.rejection_reason ?? undefined,
    paidAt: r.paid_at ? new Date(r.paid_at) : undefined, expiresAt: r.expires_at ? new Date(r.expires_at) : undefined,
    createdAt: new Date(r.created_at), updatedAt: new Date(r.updated_at),
  };
  return new ReferralReward(props);
}

/**
 * Approve or reject a pending referral_reward — this is the real
 * REFERRAL_MCP_TOOLS "approve_reward"/"reject_reward" tier=staff_approval
 * action, implemented via the real ReferralReward domain class rather than
 * a hand-rolled status update, so its own invariants (only-pending-can-be-
 * approved, rejection requires a reason, etc.) are enforced.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { id } = params;
  const { principal, denied } = await getAdminPrincipal(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const body = await req.json().catch(() => ({}));
  const action = body.action as 'approve' | 'reject' | undefined;
  if (action !== 'approve' && action !== 'reject') {
    return Response.json({ error: 'action must be "approve" or "reject"' }, { status: 400 });
  }
  if (action === 'reject' && !body.reason?.trim()) {
    return Response.json({ error: 'reason is required to reject a reward' }, { status: 400 });
  }

  const existing = await query<RewardRow>(`SELECT * FROM referral_reward WHERE id = $1`, [id]);
  if (!existing.rowCount) return Response.json({ error: 'Reward not found' }, { status: 404 });

  let reward: ReferralReward;
  try {
    const current = toDomain(existing.rows[0]);
    // approved_by/rejected_by are UUID columns (staff actor id) — use the
    // admin principal's id, not its email, which would fail the column type.
    const actor = principal!.id;
    reward = action === 'approve' ? current.approve(actor) : current.reject(actor, body.reason);
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : 'Invalid state transition' }, { status: 409 });
  }

  await query(
    `UPDATE referral_reward SET status = $1, approved_by = $2, rejected_by = $3, rejection_reason = $4, updated_at = $5
     WHERE id = $6`,
    [reward.status, reward.approvedBy ?? null, reward.rejectedBy ?? null, reward.rejectionReason ?? null, reward.updatedAt, id],
  );

  if (action === 'approve') {
    await query(
      `UPDATE referral_master SET status = 'reward_approved', updated_at = now() WHERE id = $1`,
      [reward.referralId],
    );
  } else {
    await query(
      `UPDATE referral_master SET status = 'reward_rejected', rejection_reason = $1, updated_at = now() WHERE id = $2`,
      [body.reason, reward.referralId],
    );
  }

  return Response.json({ id: reward.id, status: reward.status });
}
