# Affiliate operations

Admin page: `/admin/affiliates`. Restricted to the Admin role.

1. Create a vendor affiliate link through the existing Marketplace screen.
2. Configure its vendor policy in Affiliate Marketing. No policies are enabled by installation. Rate is a percentage of product subtotal after order/coupon/reward-point discounts, excluding tax and shipping; gift cards and wallet payments are payment methods, not additional discounts.
3. A valid referral visit stores an HttpOnly click-token cookie for 30 days. Last valid visit wins. Checkout verifies the database click, current link eligibility and policy, blocks same-email self-referrals, reserves one usage and freezes the rate/basis/currency. A disabled policy produces no attributed conversion; enabling later is not retroactive.
4. Checkout creates a pending order and does not charge money. Staff records a genuinely received payment through the existing order Mark Paid action. That action atomically records commission earnings.
5. Refunds reverse commission proportionally to recorded refund/total. A cancelled or returned order reverses all commission. Historical reversals remain even after a payout; negative balance means recovery is due. No bank refund or automatic recovery is performed.
6. Record a payout only after making the payment externally. Use its transaction reference and amount. A repeated identical reference/amount is idempotent; a conflicting amount is rejected. Payout recording cannot exceed that conversion's available balance.

Paid conversions and receipt history are retained. Pending-order cancellation does not restore a limited promotion usage. These are explicit initial policies, not configurable multi-touch attribution, advanced identity fraud detection or automated banking.

## Validation

232 referral/affiliate tests passed; TypeScript validation passed. `scripts/verify-affiliate-ledger.cjs` runs real ledger functions against temporary PostgreSQL tables and rolls back. Coverage includes disabled/missing policy, retries, basis/rate snapshot, paid-only earnings, partial/full refunds and post-payout recovery.

## External prerequisites

Commission rates still require business configuration. Automated payment collection, banking payouts, identity-based fraud detection and external affiliate-network synchronization are not connected. LinkedIn still requires developer credentials and company-page OAuth. No social posts or money transfers were sent during implementation.
