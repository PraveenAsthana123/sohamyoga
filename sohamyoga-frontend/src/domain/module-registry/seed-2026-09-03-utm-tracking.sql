-- UTM / Campaign Parameter Tracking -- real admin CRUD added, 2026-09-03.
-- Prior audit (2026-09-01, verified_by claude-session-2026-09-01) found
-- utm_link had a real schema (src/domain/marketing/db-schema.sql) and a
-- real reader (src/app/api/analytics/attribution/route.ts joins
-- utm_campaign to conversions; AnalyticsAggregationJob sums click_count)
-- but 0 rows and no admin UI -- the write path simply didn't exist
-- anywhere (grep-verified: zero `INSERT INTO utm_link` in the codebase
-- before this session; the `build_utm_link` MCP tool in
-- src/domain/mcp/campaign-mcp-registry.ts was a tool definition with no
-- real backing implementation). This session added the first real
-- read/write surface for it:
--   * GET/POST  /api/admin/utm-tracking       -- list (with a real
--     LEFT JOIN aggregation of campaign_lead by utm_link_id: leads
--     captured and converted per link) + create
--   * DELETE    /api/admin/utm-tracking/[id]  -- links are create/delete
--     only, no edit, since source/medium/campaign are meant to stay
--     stable once a tagged link has been distributed
--   * GET       /utm/[id]                     -- a new PUBLIC
--     click-tracking redirect, same shape as this repo's existing
--     /go/[slug] (cta) and /r/[code] (referral_code) routes: increments
--     click_count on every real hit, then 302s to full_url (which
--     already carries the utm_ query params for Matomo/PostHog on the
--     landing page). This is the piece that makes click_count an
--     actually-exercised column instead of a permanent zero.
--   * /admin/utm-tracking                     -- list + create UI, wired
--     into the admin left-nav
-- base_url is restricted server-side to a portal-owned relative path
-- (either resolved from an existing landing_page.slug or a typed path
-- starting with "/") -- this can never build a tracking link to a
-- third-party site, matching the safetyNote already declared on the MCP
-- tool definition. The table is still genuinely empty: no fake "already
-- clicked" rows were seeded, since an empty list with real CRUD is the
-- correct state until an admin actually creates a link.
UPDATE module_registry SET
  description = 'Real UTM-tagged link builder + click-tracking redirect over utm_link (src/domain/marketing/db-schema.sql), joined to campaign_lead for real leads/converted counts per link.',
  built_status = 'partial',
  admin_flow = 'Admin opens /admin/utm-tracking -> sees all utm_link rows (source/medium/campaign/content/term badges, destination path, linked campaign brief, click count, leads/converted from a real campaign_lead JOIN) -> "+ New UTM Link" opens a form: pick an existing landing_page or type a portal-owned path, fill source/medium/campaign (+ optional content/term), optionally link a campaign_brief -> POST /api/admin/utm-tracking inserts the row and returns both the raw tagged URL and a /utm/[id] tracked URL -> Delete calls DELETE /api/admin/utm-tracking/[id]. Visiting a shared /utm/[id] link (public, unauthenticated) increments click_count and redirects to the tagged destination.',
  data_flow = 'Admin form submit -> getAdminPrincipal auth check -> query() INSERT against utm_link (tenant-scoped, brief_id optional FK) -> landing_page looked up server-side by id (never trusts a client-supplied external URL) -> full_url built from URLSearchParams -> list GET LEFT JOINs campaign_brief for display name and campaign_lead (via utm_link_id FK) for leads/converted aggregation -> JSON response -> React state refresh. Separately: GET /utm/[id] (public) -> UPDATE utm_link SET click_count = click_count + 1 -> 302 redirect to full_url.',
  user_flow = 'No customer/end-user facing view -- this is an internal marketing tool. The only user-facing surface is the /utm/[id] redirect itself, which a visitor experiences as an instant, invisible hop to the real destination URL.',
  user_story = 'As a marketing admin, I want to generate a UTM-tagged link for any landing page or portal path in a few clicks, and see real click/lead/conversion counts per link, instead of hand-building query strings and having no idea whether they were ever clicked.',
  input_desc = 'Destination (existing landing page or a typed portal-owned path), utm_source, utm_medium, utm_campaign (required), optional utm_content/utm_term, optional linked campaign_brief.',
  process_desc = 'Real Postgres CRUD over utm_link -- no mock data, no client-side-only state. A real public redirect route increments the same click_count column the existing attribution job already reads, so no new column or metric was fabricated.',
  output_desc = 'A persisted utm_link row with a working /utm/[id] tracked URL and a raw tagged URL, plus live leads/converted counts joined from campaign_lead.',
  final_outcome = 'A working admin create/list/delete UI and a real public click-tracking redirect backed by the real table and a real API -- the schema and the previously-unimplemented build_utm_link MCP tool description are no longer unwired, but the table is still empty until an admin creates a link, and no automation calls this from the campaign MCP gateway yet.',
  dashboard_location = '/admin/utm-tracking',
  schema_tables = ARRAY['utm_link', 'campaign_brief', 'campaign_lead', 'landing_page'],
  demo_use_cases = '[{"name":"Tag a social post","flow":"Admin creates a link with source=instagram, medium=social, campaign=spring_2026 pointed at an existing landing page -- copies the /utm/[id] tracked URL into the post caption"},{"name":"See what actually converted","flow":"Admin opens the list and sees clicks, leads, and converted counts per link, sourced from a real campaign_lead JOIN rather than a guess"}]'::jsonb,
  missing_items = 'No edit after creation (by design -- create/delete only). The build_utm_link MCP tool (campaign-mcp-registry.ts) still has no execution handler wired into the MCP gateway (src/app/api/admin/mcp-gateway/execute/route.ts) -- this session built the real HTTP CRUD surface but did not touch MCP tool dispatch, which is a separate, broader change. campaign_brief has 0 rows currently, so the brief-link dropdown is empty until briefs exist. No bot/UA-based click fraud filtering on the /utm/[id] redirect. click_count only increments for links visited via the /utm/[id] tracked URL -- pasting the raw tagged URL bypasses the counter (documented in the UI itself).',
  source_doc = 'UTM Tracking admin UI + public click-redirect build session, 2026-09-03 (prior audit: real schema, 0 rows, no admin UI -- registry showed UI: false, Database: true (empty), Admin Portal: false)',
  has_admin_ui = true,
  last_verified_at = now(),
  verified_by = 'claude-session-utm-tracking-20260903',
  updated_at = now()
WHERE app = 'sohamyoga-frontend' AND module_key = 'utm-tracking';
