# eCommerce Engine — Integration Spec
## Wave 9 | SohamYoga Portal

---

## Module Integration Map

```
Customer
    │
    ▼
Product Catalog (product_master)
    │
    ├── Physical Products (yoga mat, blocks, clothing, ayurvedic, books)
    │       → ERPNext: Item Master + Stock Entry
    │       → MedusaJS: Product + Variant + Inventory
    ├── Digital Products (courses, videos, PDFs)
    │       → Moodle (8020): course enrollment on purchase
    │       → PhotoPrism (9002): digital asset delivery
    ├── Workshop / Retreat / Service
    │       → Cal.com (3100): event slot creation; booking → order_item
    │       → Jitsi (8443): virtual class link on order confirmation
    ├── Subscriptions / Memberships
    │       → Pricing Domain (Wave 8): PricingPlan / Subscription
    │       → ERPNext: Subscription Item + recurring invoice
    └── Gift Cards
            → GiftVoucher domain (Wave 7): stored-value tracking

    │
    ▼
Shopping Cart (in-memory + Redis TTL)
    │
    ├── Coupon validation     → OfferKit (3050): POST /apply → Wave 7 CouponRedemption
    ├── Gift card balance     → GiftVoucher domain (Wave 7)
    ├── Wallet credit         → wallet table (ERPNext: Customer Wallet)
    ├── Reward points         → Gamification domain (Wave 5)
    ├── Tax calculation       → ERPNext Tax Template (region-based HST/GST/VAT)
    └── Shipping cost         → ERPNext Delivery Note + carrier API

    │
    ▼
Checkout / Order (sales_order)
    │
    ├── MedusaJS (9003): cart → order + Stripe payment
    ├── ERPNext  (8080): Sales Invoice + Payment Entry + Credit Note (refund)
    ├── Stripe:           payment_intent → payment.status webhook
    ├── PostHog:          checkout_started, order_placed events
    └── Novu (4001):      order_confirmed notification

    │
    ▼
Fulfillment (shipment)
    │
    ├── Physical: warehouse pick/pack → shipment.tracking_number
    │       → ERPNext: Delivery Note + Stock Ledger Entry
    │       → Novu: shipment_dispatched + delivery_confirmed notifications
    ├── Digital: download_url activated on payment
    │       → Novu: download_ready notification
    └── Service/Workshop: Cal.com booking confirmed
            → Novu: booking_confirmation + 24h reminder

    │
    ▼
Marketplace (vendor)
    │
    ├── Teacher store: vendor.type=teacher → commission on order_item
    ├── Settlement: ERPNext Journal Entry for net payout
    └── Affiliate: commission on referred orders (referral_reward coupon)
```

---

## Checkout Process Flow (12-step Discount Sequence)

```
1.  Cart items subtotal
         │
2.  Apply pricing rules (Wave 8: priority-ordered, stacking behavior)
         │
3.  Apply coupon code (Wave 7: OfferKit validate → Redis 15-min reserve)
         │
4.  Apply gift card balance (Wave 7: GiftVoucher.redeem)
         │
5.  Apply wallet credit (wallet.balance deduction)
         │
6.  Apply reward points (Gamification: 100 pts = CAD 5)
         │
7.  Calculate shipping (ERPNext carrier rates by region/weight)
         │
8.  Calculate tax (ERPNext Tax Template: 13% HST Ontario, 5% GST federal)
         │
9.  Final total = subtotal + shipping + tax − all discounts (min CAD 0)
         │
10. Create MedusaJS cart → Stripe payment_intent
         │
11. Payment confirmed → sales_order.status=confirmed
         │
12. ERPNext Sales Invoice generated → Novu order_confirmed notification
```

---

## Booking Module Integration (Cal.com → eCommerce)

| Cal.com Event | eCommerce Action |
|---|---|
| Workshop created | product_master record created (type=workshop) |
| Retreat slot opened | product_master + product_variant per date |
| Private class booked | order_item created; teacher_id set for commission |
| Booking confirmed | inventory.commit() for service slot capacity |
| Booking cancelled | inventory.release() + refund_order triggered |
| Class capacity full | product_master.status → out_of_stock |

---

## Pricing Domain Integration (Wave 8 ↔ Wave 9)

| Pricing Event | eCommerce Action |
|---|---|
| Subscription.activate() | product_master (type=membership) order created |
| Bundle.activate() | order_item × bundle items; bundle_ownership record |
| PricingRule applied | discount_amount added to sales_order |
| early_bird rule | order.couponDiscount applied at checkout step 3 |
| Proration credit | walletAmount in cart applied at step 5 |
| Annual plan selected | Stripe annual subscription_id linked to sales_order |

---

## Coupon Domain Integration (Wave 7 ↔ Wave 9)

| Coupon Event | eCommerce Action |
|---|---|
| CouponRedemption.createReservation() | cart.couponCode locked (Redis 15min) |
| CouponRedemption.commit() | sales_order.coupon_discount finalized |
| GiftVoucher.redeem() | sales_order.gift_card_amount applied |
| CouponRedemption.reverse() | refund_order triggers reversal |

---

## Inventory Flow

```
Purchase Order created (ERPNext PO)
        │
        ▼
Goods Receipt Note (GRN)
        │
Inventory.receive(qty, performedBy, {batchNumber, expiryDate})
        │
        ▼
stock_movement record type=receipt
        │
        ▼
Customer adds to cart
        │
Inventory.reserve(qty, cartId, "cart-service")   ← Redis lock TTL 15 min
        │
        ▼
Order confirmed → Inventory.commit(qty, orderId, "order-service")
stock_movement type=sale
        │
        ▼
Shipment dispatched → ERPNext Stock Ledger Entry
        │
        ▼
Customer return → Inventory.addReturn(qty, orderId, "returns-team")
stock_movement type=return
```

---

## Vendor Settlement Flow

```
Teacher/Vendor makes sale
        │
Marketplace.recordSale(orderAmount)
        │ commission = 20% → portal
        │ earnings = 80% → vendor pending balance
        ▼
At settlement cycle (monthly)
        │
Marketplace.addSettlement({grossAmount, commissionAmount, netAmount})
        │
        ▼
ERPNext Journal Entry: Dr. Vendor Payable / Cr. Bank Account
        │
Marketplace.markSettled(settlementId, paymentReference)
        │
Novu: settlement_processed notification to vendor
```

---

## AI / Ollama Integration

| Feature | Implementation |
|---|---|
| Product recommendations | MCP tool: recommend_product (PostHog history → Ollama) |
| AI search | product_master full-text GIN index + semantic reranking |
| Dynamic pricing | Wave 8 PricingRule: occupancy_based, peak_off_peak |
| Inventory forecast | Ollama reads stock_movement history for reorder prediction |
| Review summary | Ollama summarises top reviews for product page |
| Cross-sell | MCP tool: recommend_product with cart_context |
| Chatbot (pre-purchase) | Chatwoot + Ollama (oll route=strong) |

---

## External System Ports

| System | Port | eCommerce Role | Direction |
|---|---|---|---|
| MedusaJS | 9003/9004 | Cart, order, catalog sync | ↔ bidirectional |
| ERPNext | 8080 | Invoice, payment, inventory, PO | → ERPNext API |
| OfferKit | 3050 | Coupon validation + Redis reserve | ↔ bidirectional |
| Cal.com | 3100 | Workshop/retreat slot inventory | ← Cal.com API |
| Stripe | — | Payment gateway; webhook → payment | ← Stripe webhook |
| Redis | 6379 | Cart TTL (24h guest); reservation lock (15min) | ← SET NX |
| PostHog | — | Funnel analytics; A/B on pricing | → PostHog API |
| Novu | 4001 | Order/shipment/refund notifications | → Novu API |
| Metabase | 3001 | Sales dashboards (v_sales_summary) | ← DB views |
| Moodle | 8020 | Digital course enrollment on purchase | → Moodle API |
| Chatwoot | — | Pre/post-purchase live chat | ↔ bidirectional |

---

## State Machine: Order Lifecycle

```
draft ──► pending ──► confirmed ──► processing
                                          │
                          ┌───────────────┤
                          │               │
                    partially_shipped   shipped
                                          │
                                       delivered ──► returned
                                          │
                                    cancelled ◄──── (from any non-terminal)
                                          │
                                       refunded
```

## State Machine: Inventory

```
in_stock
    │ stock falls to reorderPoint
    ▼
low_stock  ──► (trigger: Novu low_stock_alert + ERPNext auto-PO)
    │ stock = 0
    ▼
out_of_stock ──► (product_master.status = out_of_stock)
    │ receive() called
    ▼
in_stock
```
