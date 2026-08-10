# Pricing Engine — Integration Spec
## Wave 8 | SohamYoga Portal

---

## Module Integration Map

```
Customer
    │
    ▼
Pricing Plan Catalog ──────────────────── A/B Test (PostHog ab_test_variant_id)
    │
    ├── Silver / Gold / Platinum           → ERPNext: Sales Invoice + Pricing Rule
    ├── Family Plan (seats)                → ERPNext: Multi-seat Subscription Item
    ├── Corporate Plan                     → ERPNext: Corporate Contract + Invoice
    ├── Kids / Senior / Retreat / Workshop → ERPNext: Service Item per type
    └── Trial / Drop-in                   → ERPNext: one_time Item
    │
    ▼
Pricing Rule Engine ───────────────────── OfferKit: POST /rules sync via webhook
    │
    ├── buy_x_get_y (10 classes → 1 free)  ──┐
    ├── percentage_off (seasonal 20%)         │→ Coupon Domain (Wave 7)
    ├── birthday / first_purchase / referral ──┘
    ├── peak_off_peak / occupancy_based     → Cal.com slot occupancy API
    ├── early_bird / last_minute            → Cal.com booking timestamps
    └── membership_upgrade_credit          → Subscription.calculateProratedCredit()
    │
    ▼
Checkout / Medusa Cart ────────────────── Medusa: cart, order, payment
    │
    ├── Coupon (Wave 7)                    → OfferKit: validate + Redis reserve
    ├── Wallet / Gift Card                 → ERPNext: Customer Wallet balance
    ├── Reward Points                      → Gamification Domain (Points entity)
    ├── Proration Credit                   → Subscription.prorationCredit
    ├── Installments / Partial Payment     → Medusa Payment Provider
    ├── Tax                                → ERPNext Tax Template by region
    └── Donation                           → ERPNext Donation Item
    │
    ▼
ERPNext / Frappe ─────────────────────── Canonical source of truth for accounting
    │
    ├── Sales Invoice                      ← every subscription.activate() event
    ├── Payment Entry                      ← every Medusa order.placed event
    ├── Journal Entry (gift voucher)       ← GiftVoucher.redeem() event
    ├── Pricing Rule                       ← synced from pricing_rule_master
    └── Corporate Contract                 ← CorporateConfig.bulkInvoicing
    │
    ▼
Notifications (Novu) ──────────────────── Novu: event-driven notifications
    ├── renewal_reminder      (expires_at - 7 days)
    ├── grace_period_warning  (grace_period_ends_at - 2 days)
    ├── upgrade_confirmation  (plan upgraded)
    ├── downgrade_scheduled   (pending_downgrade_plan_id set)
    └── birthday_reward       (PricingRule type=birthday, window=-3d to +7d)
    │
    ▼
Analytics (PostHog + Metabase)
    ├── plan_viewed          (plan compare page)
    ├── plan_selected        (checkout started)
    ├── plan_upgraded        (Subscription.cancelWithCredit + new)
    ├── plan_downgraded      (scheduleDowngrade called)
    ├── plan_paused          (pause called)
    ├── plan_cancelled       (cancel called)
    └── revenue_by_plan      (Metabase: v_revenue_by_plan view)
```

---

## Booking Module Integration

| Event | Pricing Action |
|---|---|
| Cal.com booking confirmed | Deduct class credit from Bundle (useItem) |
| Cal.com booking cancelled | Return credit to Bundle |
| Class capacity > 80% | Trigger `peak_off_peak` rule (occupancy_based) |
| Class booked 7+ days ahead | Apply `early_bird` discount |
| Class booked < 2 hours before | Apply `last_minute` discount |
| Teacher marked absent → substitute | No pricing impact |

## Membership Module Integration

| Pricing Domain | Membership Domain (Wave 1) |
|---|---|
| PricingPlan (type=silver/gold/platinum) | Plan.type in existing Plan.ts |
| Subscription.status=active | MembershipStatus.active |
| Subscription.pause() | MembershipStatus.paused |
| Subscription.freeze() | MembershipStatus.frozen |
| PlanBenefits.priorityBooking | Booking priority queue |
| PlanBenefits.workshopDiscountPercent | BookingSlot discount |

## Coupon Module Integration (Wave 7)

| Pricing Event | Coupon Action |
|---|---|
| plan.upgrade detected | Coupon.type=membership_upgrade_credit applied |
| Subscription.autoRenew=true renewal | Coupon.type=auto_applied checked |
| PricingRule.type=birthday triggered | Coupon.type=birthday issued |
| PricingRule.type=referral_reward | Coupon.type=referral created |
| Bundle activated | Coupon discount recorded in ERPNext |

## HR / Teacher Module Integration

| Pricing Plan | Teacher Benefit |
|---|---|
| plan.type=corporate | ERPNext: Corporate wellness benefit |
| PlanBenefits.teacherConsultationMinutes | TeacherProfile: consultation slots |
| PlanBenefits.certificateIssuance | Certificate domain: auto-issue on plan |
| Bundle.type=teacher_training | TeacherProfile.certifications add |

## AI Pricing Integration (Ollama)

| Feature | Implementation |
|---|---|
| Demand Prediction | Ollama reads PostHog occupancy trends |
| Plan Recommendation | MCP tool: recommend_plan (reads history) |
| Bundle Recommendation | MCP tool: recommend_bundle |
| Upsell / Cross-sell | MCP tool: calculate_discount (shows savings) |
| Churn Prediction | PostHog → Novu renewal_reminder trigger |
| Price Optimization | PricingRule.priority + occupancy_based |

---

## State Machine Reference

### Subscription Lifecycle
```
            ┌─────────────────────────────────────────────┐
            │                                             │
         trial                                            │
            │ activateTrial()                             │
            ▼                                             │
         active ──────── pause(reason) ──────────► paused │
            │                                      │     │
            │                                resume()     │
            │                                      │     │
            │ ◄────────────────────────────────────┘     │
            │                                             │
            │ freeze(from,to) ─────────────────► frozen  │
            │                                      │     │
            │ ◄────── unfreeze() ──────────────────┘     │
            │                                             │
            │ enterGracePeriod(days) ─────► grace_period  │
            │                                      │     │
            │                                      ▼     │
            │                                   expired  │
            │                                             │
            └──────── cancel(reason) ─────────► cancelled │
                                                          │
                      (from any non-cancelled state)      │
                                                          └
```

### Subscription Upgrade Flow
```
Customer requests upgrade
        │
        ▼
  Pricing Engine
  calculateProratedCredit()
        │
        ▼
  Old Sub → cancelWithCredit(reason, credit)
        │                    │
        │                    ▼
        │            ERPNext: Wallet credit posted
        │
        ▼
  New Sub created (status=active, new planId)
        │
        ▼
  Medusa: new order + invoice
        │
        ▼
  Novu: upgrade_confirmation notification
```

### Bundle Activation Flow
```
Customer purchases bundle
        │
        ▼
  Medusa: order.placed event
        │
        ▼
  Bundle.activate(customerId, at)
  → activatedAt = now
  → expiresAt = now + expiryDays
        │
        ▼
  bundle_ownership record created (PostgreSQL)
  bundle_usage records initialized per item
        │
        ▼
  ERPNext: Sales Invoice for bundle
        │
        ▼
  Each class booking → Bundle.useItem(itemId)
  → bundle_usage.used_count++
  → Cal.com booking confirmed
```

### Family Plan Flow
```
Primary member signs up for family plan
        │
        ▼
  Subscription created (planType=family)
        │
        ▼
  addFamilySeat(customerId, name, maxSeats)
  → validation: activeFamilySeatCount < maxSeats
  → FamilySeat added to subscription
        │
        ▼
  family_seat record in PostgreSQL
        │
        ▼
  Each seat member books class
  → shared class credits deducted from primary subscription
        │
        ▼
  removeFamilySeat(customerId)
  → status = 'removed' (soft delete, audit preserved)
```

---

## Pricing Rule Evaluation Order

```
1. Collect all rules with status='active' for this order
2. Filter by condition (segment, date, time, product, occupancy)
3. Sort by priority ASC (lower = higher priority)
4. Group by stackingBehavior:
   a. 'exclusive' rules: keep only the one with highest priority
   b. 'combinable' rules: apply all (sum discounts)
   c. 'best_wins' rules: keep the one with highest discount amount
5. Total discount = combinable sum + best exclusive (if any)
6. Discount cannot exceed orderAmount
7. Apply to checkout
8. incrementApplications() on each applied rule
```

---

## Dynamic Pricing Matrix

| Condition | Rule Type | Action | Example |
|---|---|---|---|
| Mon–Fri 6–9am | peak_off_peak | +15% premium | Morning rush |
| Mon–Fri 10am–4pm | peak_off_peak | −10% off | Off-peak |
| Sat–Sun | peak_off_peak | +10% premium | Weekend |
| Class < 40% full | occupancy_based | −15% | Fill the class |
| Class > 90% full | occupancy_based | +10% | High demand |
| Booked 7+ days ahead | early_bird | −10% | Plan ahead |
| Booked < 2 hours before | last_minute | −20% | Fill cancellations |
| Dec 15–Jan 1 | seasonal | −25% | Holiday promo |
| Customer birthday ±3 days | birthday | −20% | Birthday treat |
| First purchase ever | first_purchase | −15% | Acquisition |
| Referred customer | referral_reward | −CAD 10 | Referral |
