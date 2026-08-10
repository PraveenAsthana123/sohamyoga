# Referral Management — Integration Spec
## Wave 10 | SohamYoga Portal

---

## Module Integration Map

```
Customer / Teacher
        │
        ▼
Referral Code Generation
        │
        ├── referral_code.code  = "PRAVEEN2026"
        ├── referral_url        = https://sohamyoga.ca/register?ref=PRAVEEN2026
        ├── QR Code             → QR Code Styling library
        └── NFC Card            → referral_link.channel = nfc
        │
        ▼
Share (11 channels)
        │
        ├── WhatsApp / Telegram / SMS  → Novu (4001): message template
        ├── Facebook / Instagram       → Postiz (5000): social publishing
        ├── LinkedIn / X               → Postiz MCP: schedule post
        ├── Email                      → Novu: referral email template
        └── QR Code / NFC              → referral_link record + click tracking
        │
        ▼
Friend Clicks Link
        │
        ├── referral_click recorded (IP, device, agent)
        ├── Redis: click dedup (SET NX TTL 60s per IP+code)
        └── referral_master.status → clicked
        │
        ▼
Duplicate / Fraud Check
        │
        ├── Duplicate email    → referral_master.fraud_flags += "dup-email"
        ├── Duplicate IP       → fraud_flags += "dup-ip"
        ├── Duplicate device   → fraud_flags += "dup-device"
        ├── Self-referral      → fraud_flags += "self-referral"
        └── VPN detection      → fraud_flags += "vpn"
        │
        ▼
Registration (Keycloak / Authentik)
        │
        ├── referral_master.status → registered
        ├── Frappe CRM: Lead created for referree
        └── Novu: referral_registered notification to referrer
        │
        ▼
Email / Mobile Verification
        │
        └── referral_master.status → verified
        │
        ▼
Membership Purchase (Wave 9 eCommerce)
        │
        ├── referral_master.order_amount = checkout total
        ├── referral_master.status → membership_purchased
        └── referral_code.used_count++
        │
        ▼
Reward Calculation (Campaign Rules)
        │
        ├── referral_campaign.referrer_reward_value → referrer reward
        ├── referral_campaign.referree_reward_value → referree reward
        └── referral_master.status → reward_pending
        │
        ▼
Reward Approval (Human or Auto)
        │
        ├── Admin approves  → reward_approved (MCP: approve_reward)
        └── Fraud detected  → reward_rejected (MCP: reject_reward)
        │
        ▼
Reward Distribution
        │
        ├── wallet_credit    → referral_wallet.balance += value
        ├── reward_points    → Gamification domain (Wave 5): addPoints()
        ├── discount_coupon  → Wave 7 CouponMaster: create coupon
        ├── gift_card        → Wave 7 GiftVoucher: issue card
        ├── free_class       → Wave 9 eCommerce: order_item (unitPrice=0)
        ├── membership_ext   → Wave 8 Pricing: Subscription.extendBy()
        └── merchandise      → Wave 9 eCommerce: manual fulfillment order
        │
        ▼
referral_master.status → reward_paid
        │
        ▼
Analytics (PostHog + Metabase)
        │
        ├── referral_campaign_analytics: daily rollup
        ├── v_top_referrers: leaderboard view
        └── v_campaign_performance: campaign ROI
```

---

## Referral Registration Flow (12-Step)

```
1.  Customer requests referral code
         │
2.  Portal generates unique code (PRAVEEN2026) + URL + QR
         │
3.  Customer selects share channel (WhatsApp / QR / Email / SMS)
         │
4.  Friend clicks referral link
         │
5.  Redis dedup check (IP + code, 60s TTL)
         │
6.  Fraud pre-check (email, device, IP, VPN)
         │
7.  Friend completes registration (Keycloak)
         │
8.  Email / mobile verification
         │
9.  Friend purchases membership or class pack
         │
10. System calculates reward (referrer + referree, campaign rules)
         │
11. Staff approves reward (or auto-approval if fraud score = 0)
         │
12. Reward distributed → Novu notification to both parties
```

---

## Reward Type → System Mapping

| Reward Type | Domain / System | Action |
|---|---|---|
| wallet_credit | referral_wallet | balance += value |
| reward_points | Wave 5 Gamification | addPoints(customerId, value) |
| discount_coupon | Wave 7 CouponMaster | createCoupon(code, pct, expiry) |
| gift_card | Wave 7 GiftVoucher | issueCard(value, recipientId) |
| free_class | Wave 9 eCommerce | createOrder(item, unitPrice=0) |
| membership_extension | Wave 8 Pricing | Subscription.extendBy(days) |
| cash | ERPNext | Journal Entry: Dr. Referral Expense / Cr. Bank |
| merchandise | Wave 9 eCommerce | create physical order (fulfillment manual) |
| yoga_mat | Wave 9 eCommerce | product_master (type=physical) order |
| meditation_course | Moodle (8020) | enroll in course (courseId pre-configured) |
| vip_membership | Wave 8 Pricing | upgrade plan to Platinum |
| workshop_access | Wave 9 eCommerce + Cal.com | create workshop booking |

---

## Fraud Detection Rules

| Check | Flag | Action |
|---|---|---|
| Same email as referrer | self-referral | Auto-reject |
| Same IP (registration within 24h) | dup-ip | Flag + manual review |
| Same device fingerprint | dup-device | Flag + manual review |
| Email domain matches referrer | dup-domain | Flag for review |
| VPN/proxy detected | vpn | Flag + hold reward |
| Code used > maxUses | maxed-out | Registration rejected |
| Code expired | expired | Registration rejected |
| Reward claimed > maxRewardPerReferrer | reward-cap | Auto-reject |
| Multiple accounts same phone | dup-phone | Flag + manual review |
| Blacklisted domain | blacklist | Auto-reject |

---

## Referral Type → Business Rules

| Type | Reward Trigger | Commission |
|---|---|---|
| customer_customer | Membership purchase | Fixed per campaign |
| teacher_student | Student completes 5 paid classes | % of class revenue |
| student_teacher | Student refers teacher who joins | Fixed bonus |
| corporate | Bulk registration (≥5 employees) | % off corporate plan |
| doctor / hospital | Patient registers + buys wellness plan | Fixed per referral |
| partner | Partner portal referral tracked by affiliate_id | % of lifetime value |
| influencer | UTM campaign link, tracked by PostHog | % of attributed revenue |
| affiliate | Frappe CRM affiliate module | Tiered % |
| event / workshop / retreat | Registration confirmed for the event | Fixed per event |

---

## Campaign ↔ Wave Integration

| Campaign Event | System Action |
|---|---|
| double_reward campaign active | referrer_reward_value × 2 during campaign window |
| flash campaign | time-limited (endDate = 24h from start) |
| corporate campaign | eligibleReferralTypes = ["corporate"] + bulk registration |
| seasonal campaign | e.g., "Diwali 2026" — wallet_credit reward type |
| campaign.isActive() = false | new referral codes blocked; existing referrals processed |

---

## MCP Tool Coverage

| Tool | Tier | Used By |
|---|---|---|
| create_referral_code | auto | Customer dashboard, teacher portal |
| generate_referral_link | auto | Share modal (WhatsApp / Email / QR) |
| generate_referral_qr | auto | Dashboard QR download |
| validate_referral | auto | Registration page, duplicate check |
| wallet_balance | auto | Customer self-service |
| referral_history | auto | Customer referral history tab |
| leaderboard | auto | Leaderboard widget |
| calculate_reward | staff | Admin reward calculation |
| referral_analytics | staff | Campaign analytics dashboard |
| approve_reward | staff_approval | Admin reward queue (confirmApprovalId) |
| reject_reward | staff_approval | Admin fraud rejection (confirmApprovalId) |
| fraud_check | admin_destructive | Fraud investigation (confirmText=RUN_FRAUD_CHECK + confirmApprovalId) |

---

## External System Ports

| System | Port | Referral Role | Direction |
|---|---|---|---|
| Novu | 4001 | Referral notifications (8 event types) | → Novu API |
| PostHog | — | Click, registration, conversion events | → PostHog API |
| Frappe CRM | 8080 | Lead creation when referree registers | → Frappe API |
| ERPNext | 8080 | Cash reward journal entries | → ERPNext API |
| Redis | 6379 | Click dedup (SET NX 60s), code cache | ← SET/GET |
| Metabase | 3001 | v_top_referrers + v_campaign_performance | ← DB views |
| Postiz | 5000 | Social share (Facebook, Instagram, LinkedIn) | → Postiz API |
| GrowthBook | — | A/B testing campaign variants | → GrowthBook API |
| Moodle | 8020 | meditation_course reward: course enrollment | → Moodle API |
| Cal.com | 3100 | workshop_access reward: booking creation | → Cal.com API |

---

## State Machine: Referral Lifecycle

```
draft ──► shared ──► clicked ──► registered ──► verified
                                       │              │
                                       └──────────────┤
                                                      │
                                           membership_purchased
                                                      │
                                              reward_pending
                                                      │
                                     ┌────────────────┤
                                     │                │
                               reward_rejected   reward_approved
                                                      │
                                               reward_paid (terminal)
```

## State Machine: Referral Code

```
active ──► paused ──► active
  │
  └──► revoked (terminal)
  │
  └──► expired (by date or admin action)
```
