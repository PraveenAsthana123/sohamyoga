# Voice Agent Platform — Reference (as of 2026-09-02)

This is the single reference for what exists, what's missing, and how to verify each piece.
Everything marked ✅ has been tested against the real database and (where noted) the real Vapi API this session — not just written.

## 1. Architecture

```
┌─────────────────────┐        ┌──────────────────────┐
│   Admin Portal        │        │  Business Self-Service │
│   /admin/*             │        │  /customer/*            │
│   (admin_user login)   │        │  (business_customer     │
│                        │        │   login — separate      │
│   Can do EVERYTHING    │        │   session system)       │
│   a business can do,   │◄──────►│  Profile / Contacts /   │
│   on their behalf      │  same  │  Scripts / Calls        │
│                        │  DB    │  NO Vapi access         │
└──────────┬─────────────┘  rows  └──────────────────────┘
           │
           │ (admin-only: Vapi technical config + sync trigger)
           ▼
┌─────────────────────┐
│   Vapi (real account) │── phone number +19435009474 (already active)
│   - Assistant config   │
│   - model/voice/       │
│     transcriber        │
└─────────────────────┘

┌─────────────────────┐
│  Cal.com adapter       │  fail-closed — no CALCOM_API_KEY yet
│  (open-source calendar)│
└─────────────────────┘
```

**Two separate auth systems, same database:**
| | `admin_user` | `business_customer` |
|---|---|---|
| Who | Internal staff | A business (clinic, yoga studio, etc.) |
| Session cookie | `vap_session` | `vap_customer_session` |
| Can see | Every business | Only their own data (`owner_customer_id` scoping) |
| Vapi access | Yes (config + sync) | No, by explicit design |

## 2. What's built and verified ✅ vs. not built ⛔

| Area | Status | Evidence |
|---|---|---|
| Vapi assistant create/update | ✅ | Real assistant created and deleted live via API |
| Vapi advanced config (model/voice/transcriber/limits) | ✅ | Live test: rejected invalid voice id, accepted valid one |
| Vapi sync trace log | ✅ | Real attempt logged with timing + initiator |
| Business registration/login/profile | ✅ | Two real businesses registered, data isolated |
| Contact add + CSV bulk import | ✅ | Real import: 2 imported, 1 honestly skipped with reason |
| Content-only scripts (inbound/outbound) | ✅ | Created and listed live, both self-service and admin-on-behalf-of |
| Call history view | ✅ | Real call_log row with contact join shown correctly |
| Admin manages a business's profile/contacts/scripts | ✅ | Verified: admin-added contact appeared in that business's own portal |
| Vapi assistant name traceable to business | ✅ | `[Business Name] Script Name`, truncated to Vapi's real 40-char limit |
| Cal.com calendar (availability/book/reschedule/cancel) | ⛔ fail-closed | Code correct, needs your `CALCOM_API_KEY` + `CALCOM_EVENT_TYPE_ID` |
| **Inbound/outbound call PLACEMENT** (actually ringing a phone) | ✅ code+config real | CORRECTED 2026-09-08: `VapiCallAdapter.placeCall()` is a real POST /call implementation, `VAPI_API_KEY`/`VAPI_PHONE_NUMBER_ID` are both set, `/api/admin/calls/place` + `PlaceCallButton.tsx` exist. No live call has been placed to verify end-to-end (it rings a real phone by design) — that is the one remaining honest gap, not the code. |
| **Webhook receiver** (auto-capture real call transcript/duration/cost) | ✅ real | CORRECTED 2026-09-08: `/api/webhooks/vapi/route.ts` is a real, secret-verified end-of-call-report + status-update handler, wired onto every synced assistant since `PUBLIC_BASE_URL`/`VAPI_WEBHOOK_SECRET` are both set. This row was stale when written on 2026-09-02. |
| Billing / usage / cost dashboard | ⛔ not built | Needs real call data from the webhook above first |
| Welcome/thank-you/payment note as distinct template fields | ⛔ not built | Only one generic `servicesDescription` field exists |
| Email, WhatsApp, Google Pay/payment links | ⛔ not built | No provider credentials exist for any of these |
| n8n | ⛔ needs investigation | Container crashed 6 months ago, not blindly restarted |

## 3. What a business needs to provide — Inbound vs Outbound

**Inbound** (someone calls the business's number):
- Business profile: services offered, pricing, hours, holidays (→ Profile tab) — grounds what the AI can honestly answer
- At least one **inbound** script: opening greeting, discovery questions (what to ask the caller), objection handling, closing (→ Scripts tab, direction=inbound)
- **Real constraint to know:** there is currently only ONE Vapi phone number (`+19435009474`) for the whole platform. Routing a specific inbound number to a specific business's assistant needs either a dedicated number per business (a real cost/account item) or a real IVR/routing layer — neither exists yet. Right now inbound can only correctly serve one business at a time.

**Outbound** (the business calls a contact):
- Everything above, plus:
- Real contacts to call (→ Contacts tab: manual add or CSV upload)
- At least one **outbound** script per scenario (reminder, confirmation, thank-you, survey, etc.)
- Admin still has to trigger the actual Vapi sync + eventually `placeCall()` — not self-service yet

## 4. Demo scenario (walk this end-to-end today)

1. Register a business at `/customer/register` (e.g., a yoga studio)
2. Fill in Profile tab: services, pricing, hours
3. Add 2-3 contacts (Contacts tab) or upload a CSV
4. Add an outbound script (Scripts tab) — e.g. "Appointment Reminder"
5. Admin logs in at `/admin`, opens `/admin/scripts`, finds that script, clicks "Sync to Vapi" — creates a real assistant
6. Admin manually places a test call via the Vapi dashboard (not built into this app yet), then logs the real outcome via `/admin/calls/new`
7. Business logs back into `/customer/dashboard` → Calls tab → sees their own real call history

## 5. Testing checklist (what to re-verify after any change here)

- [ ] `npx tsc --noEmit -p tsconfig.json` clean
- [ ] Register 2 businesses, confirm neither sees the other's contacts/scripts/calls
- [ ] Confirm every `/api/customer/*` route returns 401 with no session
- [ ] Confirm every `/api/admin/*` route returns 401 with no admin session
- [ ] Sync a script to Vapi, confirm a real assistant id comes back, then delete it from Vapi to avoid clutter
- [ ] Confirm `vapi_sync_log` has a row for every sync attempt, success or failure

## 6. To-do (priority order)

1. ~~Webhook receiver for real Vapi call events~~ — DONE, corrected 2026-09-08 (see §2 above). Real next step: a billing/usage/cost dashboard over the now-auto-filling `call_log`, which was the actual point of this item.
2. ~~`placeCall()` real implementation~~ — DONE, corrected 2026-09-08 (see §2 above). Not yet exercised with a real live call (deliberately, by design).
3. Multi-business inbound routing (needs either per-business phone numbers or a real router)
4. Cal.com credentials → wire real availability/booking
5. Welcome/thank-you/payment note as distinct, business-editable template fields
6. n8n: investigate why it crashed before deciding whether to use it
7. Email/WhatsApp/payment: need real provider accounts before any code is written
