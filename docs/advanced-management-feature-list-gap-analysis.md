# Advanced Management Feature List — Reality Check

Real code/table verification, 2026-08-24. Much more of this list is already
built than assumed — checked each against real admin pages/tables/schema
before writing "missing."

| Feature | Reality |
|---|---|
| Ads management | ✅ Real — `/admin/ads`, `domain/ads/db-schema.sql` (ad_type enum: search/display/banner/video/image/dynamic/call) |
| Banner management | ✅ Real — `/admin/banners`, registered as "Banner Studio" module, real content-type across ad/campaign schemas |
| Survey management | ✅ Real, mature — `/admin/survey`, 9 real tables (survey, survey_question, survey_response, survey_analytics, survey_invitation...) |
| Video management | ✅ Real — `/admin/videos` (sohamyoga-frontend); real espeak-ng+FFmpeg render pipeline (market-research-portal) |
| Email response/tracking management | 🟡 Partial — `notification_queue`/dispatch is real; no dedicated reply-classification or response-tracking admin page found |
| Customer tracking management | ✅ Real — `tracking_event`, `campaign_lead`, funnel/analytics jobs, test-covered this session |
| Poll management | ❌ Not found — no poll table, no admin page. (Survey ≠ poll here; survey is the built system) |
| Post management | 🟡 Partial — social scheduler (`/admin/social/scheduler`) exists; no unified generic "post" entity across all content types |
| Caption management | ❌ Not found — no caption table/field beyond video subtitle generation (`.ass` files in the render pipeline, not a managed entity) |
| Video-post management | 🟡 Partial — video rendering is real; publishing a rendered video as a "post" isn't wired (same gap as the youtube_publish/social_publish worker gap found this session) |
| Editor management | ❌ Not found — no content-editor admin surface beyond raw form fields |
| Tag management | 🟡 Partial — `meditation_tag` exists for content categorization; no general-purpose marketing tag system |
| Hooks management | ❌ Not found — no "hook" (short attention-grabbing opener) entity anywhere |
| Educational/server/dos-and-don't/risk/compliance message types | ❌ Not found as a structured message-type system — `module-boundary-quality` job produces "dos/don'ts" for *code modules*, not customer-facing compliance messaging |
| Text/image/video/audio posting as distinct types | 🟡 Partial — `ContentVariant` type includes most of these as content categories; no unified "post as X format" admin action |

## Honest tally

**9 of 15 rows are real or partially real** — this list was far more built-out
than the earlier "ads management" spot-check suggested. Genuine gaps:
poll management, caption management (as a managed entity, not just subtitle
generation), a dedicated content editor, tag management (general-purpose),
hooks management, and the structured compliance-message-type system.

## Recommended next build (if prioritized)

**Poll management** is the cleanest gap to close — the survey system
(9 real tables, mature) is a near-complete template to adapt: same
invitation/response/analytics shape, simpler question model (single choice
vs. survey's full logic branching).
