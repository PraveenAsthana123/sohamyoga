# Business scenarios and proposed demo/test plan



These are acceptance plans, not newly executed test results. Historical suite evidence is linked separately. All write scenarios require an isolated demo tenant and authorized external sandbox.



## J01 — Customer: Register and verify identity

**Story:** A new student signs up after seeing a yoga offer.

**Input/test data:** Unique synthetic email, consent versions, valid/expired OTP

**Demo steps:** Open registration; request real OTP; verify; create identity and customer; sign in

**Expected output:** One linked identity/customer, recorded consent, usable dashboard

**Gap/evidence limit:** Live demo login works but customer business record missing; OTP send is a UI delay, no verification

**Historical test:** customer-registration.spec.ts. **Proposed cases:** J01-P,J01-N,J01-A,J01-R,J01-O. **Result:** NOT RUN.



## J02 — Customer: Recover account and manage sessions

**Story:** A student forgets a password on a different device.

**Input/test data:** Existing synthetic identity, reset token, second device

**Demo steps:** Request reset; expire/reuse token; change password; revoke prior session

**Expected output:** Account recovered without leaking account existence; revoked session denied

**Gap/evidence limit:** Fresh full recovery and session-revocation demo not evidenced

**Historical test:** No direct suite established. **Proposed cases:** J02-P,J02-N,J02-A,J02-R,J02-O. **Result:** NOT RUN.



## J03 — Customer: Complete profile and preferences

**Story:** A beginner changes goals, accessibility needs and contact preferences.

**Input/test data:** Linked customer, timezone, opt-in/opt-out choices

**Demo steps:** Edit profile; save; reload; check admin view and audit history

**Expected output:** Persisted preferences drive permitted communication

**Gap/evidence limit:** Customer fixture missing; self-service suite has3 failures and99 skips

**Historical test:** customer-self-service.spec.ts. **Proposed cases:** J03-P,J03-N,J03-A,J03-R,J03-O. **Result:** NOT RUN.



## J04 — Customer: Discover and book a class

**Story:** A working parent finds an evening class and books one seat.

**Input/test data:** Published class, timezone, active membership, one available seat

**Demo steps:** Search; inspect teacher; book; reload customer and admin rosters

**Expected output:** One booking, one seat consumed, confirmation accessible

**Gap/evidence limit:** Complete paid-booking journey not established by current evidence

**Historical test:** customer-interaction-tracking.spec.ts. **Proposed cases:** J04-P,J04-N,J04-A,J04-R,J04-O. **Result:** NOT RUN.



## J05 — Customer: Waitlist and capacity race

**Story:** Two students compete for the final seat.

**Input/test data:** Two isolated customers, capacity1, waitlist policy

**Demo steps:** Submit simultaneous bookings; cancel winner; promote waitlist

**Expected output:** No overbooking; exactly one promotion and one confirmation

**Gap/evidence limit:** Defined capacity test exists but orchestrator has zero execution results

**Historical test:** No direct suite established. **Proposed cases:** J05-P,J05-N,J05-A,J05-R,J05-O. **Result:** NOT RUN.



## J06 — Customer: Reschedule and cancel

**Story:** A student cannot attend and moves a class before the cutoff.

**Input/test data:** Booking, cutoff boundary, replacement session

**Demo steps:** Reschedule; retry; cancel inside/outside allowed window

**Expected output:** Correct seats, credits and history; no duplicate refund

**Gap/evidence limit:** Lifecycle test defined but no orchestrated execution evidence

**Historical test:** No direct suite established. **Proposed cases:** J06-P,J06-N,J06-A,J06-R,J06-O. **Result:** NOT RUN.



## J07 — Customer: Check in and attendance

**Story:** A student arrives and staff confirms attendance.

**Input/test data:** Valid booking, QR/token, expired token, second user

**Demo steps:** Scan; validate ownership; mark attendance; retry scan

**Expected output:** One attendance record, correct roster and engagement update

**Gap/evidence limit:** Kiosk QR/session handoff registry explicitly partial

**Historical test:** No direct suite established. **Proposed cases:** J07-P,J07-N,J07-A,J07-R,J07-O. **Result:** NOT RUN.



## J08 — Customer: Buy or change membership

**Story:** A customer upgrades then pauses a monthly plan.

**Input/test data:** Two plans, eligibility, renewal dates, payment sandbox

**Demo steps:** Compare; subscribe; upgrade/prorate; pause/resume; cancel renewal

**Expected output:** Entitlements and invoice schedule match chosen plan

**Gap/evidence limit:** Pricing self-service has10 incomplete registry use cases

**Historical test:** customer-self-service.spec.ts. **Proposed cases:** J08-P,J08-N,J08-A,J08-R,J08-O. **Result:** NOT RUN.



## J09 — Customer: Cart to confirmed payment

**Story:** A customer purchases a yoga product through an affiliate link.

**Input/test data:** Product, cart, click token, configured affiliate rate, payment evidence

**Demo steps:** Add/edit cart; checkout; confirm actual payment; inspect order and commission

**Expected output:** Order/customer/commission reconcile; no earnings while unpaid

**Gap/evidence limit:** Local manual-payment affiliate flow implemented; automated gateway not connected

**Historical test:** No direct suite established. **Proposed cases:** J09-P,J09-N,J09-A,J09-R,J09-O. **Result:** NOT RUN.



## J10 — Customer: Invoices and receipts

**Story:** A customer downloads an invoice for reimbursement.

**Input/test data:** Paid order, invoice, another customer account

**Demo steps:** Open invoice; download; verify tax totals; attempt cross-account access

**Expected output:** Correct private invoice and payment reference

**Gap/evidence limit:** Customer order API currently404 for demo identity; complete invoice demo missing

**Historical test:** customer-self-service.spec.ts. **Proposed cases:** J10-P,J10-N,J10-A,J10-R,J10-O. **Result:** NOT RUN.



## J11 — Customer: Refund or return

**Story:** A customer returns one purchase after affiliate payout.

**Input/test data:** Paid order, partial/full refund, paid affiliate conversion

**Demo steps:** Request return; approve; record refund; reconcile commission

**Expected output:** Refund record, reversal and recovery balance with audit trail

**Gap/evidence limit:** Ledger isolated SQL passed; customer request-to-bank-refund not demonstrated

**Historical test:** No direct suite established. **Proposed cases:** J11-P,J11-N,J11-A,J11-R,J11-O. **Result:** NOT RUN.



## J12 — Customer: Referral and loyalty rewards

**Story:** A member invites a friend who buys a qualifying membership.

**Input/test data:** Two linked customers, active referral campaign, self-referral attempt

**Demo steps:** Share; click; register; qualify purchase; approve reward; redeem

**Expected output:** Exactly one valid reward; duplicate/self-referral blocked

**Gap/evidence limit:** Referral browser tests historically pass; full purchase/reward/payout journey still unproven

**Historical test:** customer-referral.spec.ts. **Proposed cases:** J12-P,J12-N,J12-A,J12-R,J12-O. **Result:** NOT RUN.



## J13 — Customer: Support and service recovery

**Story:** A student reports a missed class and follows the resolution.

**Input/test data:** Customer ticket, staff role, SLA and attachment

**Demo steps:** Create ticket; assign; reply; escalate overdue; close; rate resolution

**Expected output:** Customer sees replies, SLA evidence and final resolution

**Gap/evidence limit:** Self-service tests largely skipped; delivery/SLA evidence needed

**Historical test:** customer-self-service.spec.ts. **Proposed cases:** J13-P,J13-N,J13-A,J13-R,J13-O. **Result:** NOT RUN.



## J14 — Customer: Privacy export and deletion

**Story:** A customer requests a copy of data and closes the account.

**Input/test data:** Isolated customer with booking/history, retention rules

**Demo steps:** Export; validate ownership; request deletion; apply retention; verify access revoked

**Expected output:** Complete export, audit and correct retention/deletion

**Gap/evidence limit:** Privacy case defined but zero orchestrated executions; do not use real customer data

**Historical test:** No direct suite established. **Proposed cases:** J14-P,J14-N,J14-A,J14-R,J14-O. **Result:** NOT RUN.



## J15 — Customer: Survey and feedback

**Story:** A student receives a post-class survey and submits feedback once.

**Input/test data:** Invitation token, completed booking, replay and expired token

**Demo steps:** Open survey; respond; replay; inspect NPS/admin report

**Expected output:** One response linked to correct class and aggregate

**Gap/evidence limit:** NPS suite45 passes historically; external invitation delivery separate

**Historical test:** nps-feedback.spec.ts. **Proposed cases:** J15-P,J15-N,J15-A,J15-R,J15-O. **Result:** NOT RUN.



## J16 — Customer: Learn from educational video

**Story:** A learner requests a lesson, reviews captions and resumes playback.

**Input/test data:** Course entitlement, uploaded sample, transcript, two lessons

**Demo steps:** Open lesson; play; edit/review captions if permitted; save progress; resume

**Expected output:** Accessible lesson, correct progress and entitlement checks

**Gap/evidence limit:** Educational Video Studio has9 incomplete use cases; basic local media is separate app

**Historical test:** yoga-education-content.spec.ts. **Proposed cases:** J16-P,J16-N,J16-A,J16-R,J16-O. **Result:** NOT RUN.



## J17 — Customer: Approve a marketing deliverable

**Story:** A business customer reviews a reel or campaign before publication.

**Input/test data:** Client tenant, draft media, revision, reviewer role

**Demo steps:** Review; annotate; request revision; compare; approve exact version

**Expected output:** Approval bound to asset version; publication receipt visible only when real

**Gap/evidence limit:** Self-service ads/acquisition flows incomplete; no full client review/publish demo

**Historical test:** No direct suite established. **Proposed cases:** J17-P,J17-N,J17-A,J17-R,J17-O. **Result:** NOT RUN.



## J18 — Admin: Onboard customer and teacher

**Story:** An administrator connects identities to customer/student/teacher records.

**Input/test data:** Isolated identities, tenant, duplicate onboarding request

**Demo steps:** Invite; complete profile; approve teacher; verify all role dashboards

**Expected output:** Consistent identity links, permissions and usable demo fixtures

**Gap/evidence limit:** Teacher/student suite10 failures; demo customer lacks business record

**Historical test:** teacher-student-onboarding.spec.ts. **Proposed cases:** J18-P,J18-N,J18-A,J18-R,J18-O. **Result:** NOT RUN.



## J19 — Admin: Schedule classes and manage capacity

**Story:** A studio manager changes a recurring class across daylight saving time.

**Input/test data:** Teacher, location, timezone, recurrence, existing bookings

**Demo steps:** Create series; change one occurrence; check collisions; notify affected students

**Expected output:** Correct local times, capacity and nonduplicated notifications

**Gap/evidence limit:** Fresh recurrence/DST/outage demo evidence missing

**Historical test:** No direct suite established. **Proposed cases:** J19-P,J19-N,J19-A,J19-R,J19-O. **Result:** NOT RUN.



## J20 — Admin: Catalog and inventory

**Story:** Staff sell the final stocked item and process a return.

**Input/test data:** Product, variants, stock1, concurrent orders

**Demo steps:** Publish; order simultaneously; reserve stock; return; reconcile inventory

**Expected output:** No overselling; reversible inventory movements with audit

**Gap/evidence limit:** Product/service domain has6 incomplete registry use cases

**Historical test:** No direct suite established. **Proposed cases:** J20-P,J20-N,J20-A,J20-R,J20-O. **Result:** NOT RUN.



## J21 — Admin: Pricing and promotions

**Story:** Staff issue a limited-use coupon and approve an exceptional discount.

**Input/test data:** Coupon cap, eligibility, threshold, approver role

**Demo steps:** Configure; redeem at boundary; reject invalid; approve exception

**Expected output:** Correct totals and audit; no duplicate redemption

**Gap/evidence limit:** Pricing/promotion domain incomplete; full monetary-path test missing

**Historical test:** No direct suite established. **Proposed cases:** J21-P,J21-N,J21-A,J21-R,J21-O. **Result:** NOT RUN.



## J22 — Admin: Billing and dunning

**Story:** A renewal fails and staff recover the subscription.

**Input/test data:** Due subscription, invoice, failed-payment event, grace period

**Demo steps:** Generate invoice; retry safely; send reminders; recover or suspend

**Expected output:** One invoice, correct entitlement/grace state and delivery evidence

**Gap/evidence limit:** Payment domain16 and billing domain6 incomplete use cases

**Historical test:** No direct suite established. **Proposed cases:** J22-P,J22-N,J22-A,J22-R,J22-O. **Result:** NOT RUN.



## J23 — Admin: Affiliate commission and payout

**Story:** Staff reconcile referrals and record externally completed payouts.

**Input/test data:** Enabled policy, click, paid order, refund, receipt reference

**Demo steps:** Configure policy; attribute; mark paid; record receipt; replay; refund

**Expected output:** Numeric ledger reconciles; no duplicate earning/payout; negative recovery visible

**Gap/evidence limit:** 232 unit/API tests and real temp-table flow passed; authenticated production full demo pending

**Historical test:** No direct suite established. **Proposed cases:** J23-P,J23-N,J23-A,J23-R,J23-O. **Result:** NOT RUN.



## J24 — Admin: Lead capture and assignment

**Story:** An inquiry from a landing page is routed to an available salesperson.

**Input/test data:** Campaign/UTM, consent, duplicate contact, two staff members

**Demo steps:** Submit; deduplicate; assign; breach SLA; convert to proposal

**Expected output:** One lead, correct owner/SLA, source and conversion evidence

**Gap/evidence limit:** Contact capture33 passes; funnel suite6 failures

**Historical test:** contact-lead-capture.spec.ts. **Proposed cases:** J24-P,J24-N,J24-A,J24-R,J24-O. **Result:** NOT RUN.



## J25 — Admin: Campaign to delivered message

**Story:** A marketer sends a consented campaign and handles an unsubscribe.

**Input/test data:** Consent states, suppression list, seed audience, test mailbox

**Demo steps:** Segment; draft; approve; dispatch; ingest delivery/bounce; unsubscribe

**Expected output:** Recipient delivery receipt and suppression applied on retry

**Gap/evidence limit:** Email/drip delivery gated; queued is not sent

**Historical test:** consent-automation.spec.ts. **Proposed cases:** J25-P,J25-N,J25-A,J25-R,J25-O. **Result:** NOT RUN.



## J26 — Admin: Social post to live receipt

**Story:** A manager approves a LinkedIn company-page post.

**Input/test data:** Connected test page, OAuth scopes, approved version, schedule

**Demo steps:** Connect; compose; approve; publish; retrieve external post; retry failure

**Expected output:** Real platform post ID/URL and synchronized status

**Gap/evidence limit:** LinkedIn credentials absent at prior audit; verify before live publication

**Historical test:** social-scheduler.spec.ts. **Proposed cases:** J26-P,J26-N,J26-A,J26-R,J26-O. **Result:** NOT RUN.



## J27 — Admin: Classified listing and inquiry

**Story:** Staff post a Kijiji listing and track a customer response.

**Input/test data:** Approved listing, images, authorized account, manual receipt

**Demo steps:** Prepare; export; manually publish; record URL; enter inquiry; close followup

**Expected output:** Traceable listing-to-lead history; manual steps clearly labeled

**Gap/evidence limit:** No verified Kijiji posting API; Operations Center handoff is manual

**Historical test:** No direct suite established. **Proposed cases:** J27-P,J27-N,J27-A,J27-R,J27-O. **Result:** NOT RUN.



## J28 — Admin: Paid advertising and conversion

**Story:** A marketer launches a small approved ad campaign and reconciles spend.

**Input/test data:** Sandbox ad account, budget cap, creative, conversion event

**Demo steps:** Approve; create campaign; monitor spend; pause; reconcile conversion

**Expected output:** Provider IDs, bounded spend and real metrics

**Gap/evidence limit:** Provider-neutral CRUD exists; Google Ads API adapter registry not built

**Historical test:** No direct suite established. **Proposed cases:** J28-P,J28-N,J28-A,J28-R,J28-O. **Result:** NOT RUN.



## J29 — Admin: Video and reel production

**Story:** An editor turns source media into an approved educational reel.

**Input/test data:** Authorized audio/video, script, portrait/landscape specs, captions

**Demo steps:** Ingest; transcribe; review; render; retry worker; approve version; export

**Expected output:** Playable MP4, aligned/reviewed captions, provenance and version history

**Gap/evidence limit:** Local basic transcription/text-card rendering works; full timeline/editor/publish pipeline incomplete

**Historical test:** No direct suite established. **Proposed cases:** J29-P,J29-N,J29-A,J29-R,J29-O. **Result:** NOT RUN.



## J30 — Admin: SEO and attribution reporting

**Story:** A manager sees which campaign led to a purchase.

**Input/test data:** UTM link, visit, lead, paid conversion, reporting window

**Demo steps:** Create link; visit; convert; aggregate; compare raw events and report

**Expected output:** Consistent source attribution and auditable revenue totals

**Gap/evidence limit:** On-page/UTM claimed real; multi-touch and external rankings unproven

**Historical test:** No direct suite established. **Proposed cases:** J30-P,J30-N,J30-A,J30-R,J30-O. **Result:** NOT RUN.



## J31 — Admin: Customer reputation and crisis response

**Story:** Negative feedback creates an owned action before SLA expiry.

**Input/test data:** Negative survey, sentiment signal, assigned responder

**Demo steps:** Detect; triage; draft response; approve; deliver; close incident

**Expected output:** Customer response and incident history linked to source

**Gap/evidence limit:** Complaint3 failures; external review channels need credentials

**Historical test:** complaint-alert.spec.ts. **Proposed cases:** J31-P,J31-N,J31-A,J31-R,J31-O. **Result:** NOT RUN.



## J32 — Admin: Tenant and role isolation

**Story:** A customer or editor tries to change another business's data.

**Input/test data:** Two tenants, owner/admin/editor/customer identities

**Demo steps:** Exercise read/write/export endpoints across roles; revoke role; retry

**Expected output:** No cross-tenant exposure, forbidden actions audited

**Gap/evidence limit:** Global registry flags are not security certification; explicit cross-tenant tests required

**Historical test:** No direct suite established. **Proposed cases:** J32-P,J32-N,J32-A,J32-R,J32-O. **Result:** NOT RUN.



## J33 — Admin: Import, export and rollback

**Story:** An administrator imports duplicate and malformed records.

**Input/test data:** CSV with valid, invalid and duplicate rows; rollback marker

**Demo steps:** Preview; validate; import; retry; export; rollback only test rows

**Expected output:** Deterministic row outcomes with no silent corruption

**Gap/evidence limit:** Fresh import validation/rollback demo evidence absent

**Historical test:** No direct suite established. **Proposed cases:** J33-P,J33-N,J33-A,J33-R,J33-O. **Result:** NOT RUN.



## J34 — Pipeline: Scheduled-job outage recovery

**Story:** A worker stops between writing data and acknowledging a job.

**Input/test data:** Queued job, forced timeout, duplicate webhook, dead-letter policy

**Demo steps:** Start; interrupt; restart; retry; reconcile; inspect dead-letter handling

**Expected output:** Exactly-once business effect, bounded retries and useful alert

**Gap/evidence limit:** Job existence is not recovery proof; most modules lack documented job/evidence

**Historical test:** No direct suite established. **Proposed cases:** J34-P,J34-N,J34-A,J34-R,J34-O. **Result:** NOT RUN.



## J35 — Pipeline: Demo data and test orchestration

**Story:** A presenter resets a demo tenant before a customer meeting.

**Input/test data:** Versioned fixture pack, isolated tenant, declared18 cases

**Demo steps:** Seed; verify links; run suite; capture evidence; reset; rerun

**Expected output:** Repeatable demo and retained tests/results/logs/cleanup receipt

**Gap/evidence limit:** Four orchestration suites and18 cases exist but zero executions/results

**Historical test:** demo-showcase-hub.spec.ts. **Proposed cases:** J35-P,J35-N,J35-A,J35-R,J35-O. **Result:** NOT RUN.



## J36 — Agentic: Local coding after cloud quota

**Story:** A developer continues a code task using local Ollama.

**Input/test data:** Small isolated repository, failing test, local model, cloud unavailable

**Demo steps:** Select local endpoint; propose patch; edit; run test; review diff

**Expected output:** Actual file change and passing test without a cloud request

**Gap/evidence limit:** Local Aider edit previously verified; automatic cloud-to-local session migration not established

**Historical test:** No direct suite established. **Proposed cases:** J36-P,J36-N,J36-A,J36-R,J36-O. **Result:** NOT RUN.



## J37 — Agentic: Approved marketing assistant

**Story:** An assistant drafts content and requests approval before sending.

**Input/test data:** Brief, approved brand facts, permitted tools, rejection scenario

**Demo steps:** Retrieve facts; draft; validate; request approval; execute exact approved action

**Expected output:** Trace links prompt/model/tool/approval/version/result; rejected sends never occur

**Gap/evidence limit:** Full cross-module autonomous workflow not demonstrated; external tools gated

**Historical test:** No direct suite established. **Proposed cases:** J37-P,J37-N,J37-A,J37-R,J37-O. **Result:** NOT RUN.



## J38 — Agentic: Voice booking assistant

**Story:** A caller asks to reschedule a class through a voice assistant.

**Input/test data:** Authorized test number, consent, calendar sandbox, booking

**Demo steps:** Receive call; identify; confirm intent; check availability; act; summarize

**Expected output:** Recording/transcript, confirmed calendar mutation and consent/audit

**Gap/evidence limit:** Voice/calendar integration partly configured/blocked; no authorized live call executed in this audit

**Historical test:** No direct suite established. **Proposed cases:** J38-P,J38-N,J38-A,J38-R,J38-O. **Result:** NOT RUN.



## J39 — Agentic: Tool failure and prompt injection

**Story:** An imported page tells an agent to expose secrets or bypass approval.

**Input/test data:** Untrusted document, denied tool, budget limit, malformed result

**Demo steps:** Ingest; preserve instruction boundary; deny forbidden call; recover or escalate

**Expected output:** No data exfiltration or unauthorized action; explicit failure trace

**Gap/evidence limit:** Governance suite9 historical passes does not prove every agent/tool boundary

**Historical test:** ai-governance.spec.ts. **Proposed cases:** J39-P,J39-N,J39-A,J39-R,J39-O. **Result:** NOT RUN.



## J40 — Integration: OAuth expiry and reconnect

**Story:** A channel token expires during a scheduled publication.

**Input/test data:** Test account, expired/revoked token, approved queued post

**Demo steps:** Detect failure; pause safely; reconnect; resume idempotently

**Expected output:** No duplicate post; credential health and owner alert correct

**Gap/evidence limit:** Per-provider expiry/reconnect/receipt tests needed

**Historical test:** social-provisioning.spec.ts. **Proposed cases:** J40-P,J40-N,J40-A,J40-R,J40-O. **Result:** NOT RUN.



## J41 — Integration: Monitoring and incident response

**Story:** An operator investigates a failed customer workflow from one window.

**Input/test data:** Correlated API/job/provider error, alert owner, SLA

**Demo steps:** Open dashboard; trace request to job; diagnose; replay safely; close alert

**Expected output:** One linked trace across UI/API/worker/provider and measurable recovery

**Gap/evidence limit:** Synthetic HTTP probes and registry status cannot establish integrated business monitoring

**Historical test:** No direct suite established. **Proposed cases:** J41-P,J41-N,J41-A,J41-R,J41-O. **Result:** NOT RUN.



## J42 — Experience: Mobile and accessible daily use

**Story:** A customer books and pays using keyboard or a phone.

**Input/test data:** Mobile viewport, keyboard-only user, screen reader, poor network

**Demo steps:** Navigate; submit; recover validation; reconnect; inspect focus/labels

**Expected output:** No blocked operation, accessible errors and consistent saved state

**Gap/evidence limit:** Unified quality suite14 failures/timeouts; color-blind project label alone is not emulation

**Historical test:** unified-quality.spec.ts. **Proposed cases:** J42-P,J42-N,J42-A,J42-R,J42-O. **Result:** NOT RUN.

