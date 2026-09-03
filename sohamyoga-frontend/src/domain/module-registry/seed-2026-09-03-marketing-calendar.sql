-- Marketing / Content Calendar -- real admin CRUD added, 2026-09-03. Prior
-- audit (2026-09-01, verified_by claude-session-2026-09-01) found
-- content_calendar_entry had a real schema (src/domain/marketing/db-schema.sql)
-- but 0 rows and no admin UI: schema existed but was never populated or
-- exercised. This session added the first real read/write surface for it:
-- GET/POST /api/admin/marketing-calendar and PATCH/DELETE
-- /api/admin/marketing-calendar/[id] (requireAdmin-gated, query() over the
-- real table), plus /admin/marketing-calendar (list + create/edit form),
-- wired into the admin left-nav. Distinct from /admin/social/calendar,
-- which only aggregates social_post rows for the social scheduler --
-- this covers every content_type the table supports (social_post, email,
-- sms, blog, banner, event, workshop, retreat), optionally linked to a
-- campaign_brief. The table is still genuinely empty: no fake "already
-- scheduled" rows were seeded, since an empty calendar with real CRUD is
-- the correct state until an admin actually plans content.
INSERT INTO module_registry (app, module_key, name, description, built_status, has_user_ui, has_admin_ui,
  user_flow, admin_flow, data_flow, flowchart, user_story, input_desc, process_desc, output_desc, final_outcome,
  job_name, report_location, dashboard_location, schema_tables, demo_use_cases, integration_platforms, missing_items,
  source_doc, last_verified_at, verified_by)
VALUES
('sohamyoga-frontend', 'content-calendar', 'Marketing / Content Calendar',
 'Cross-channel editorial and campaign scheduling calendar view.', 'partial', false, true,
 'No customer/end-user facing view -- this is an internal marketing planning tool, not a public calendar.',
 'Admin opens /admin/marketing-calendar -> sees all content_calendar_entry rows (title, content type, channel, scheduled time, status, linked campaign brief, assignee, tags) -> filters by status -> "+ New Entry" opens a form (title, content type, channel, scheduled at, status, optional campaign brief link, assignee, tags, notes) -> POST /api/admin/marketing-calendar inserts the row -> Edit/Delete on each row call PATCH/DELETE /api/admin/marketing-calendar/[id].',
 'Admin form submit -> requireAdmin auth check via getAdminPrincipal -> query() INSERT/UPDATE/DELETE against content_calendar_entry (tenant-scoped) -> LEFT JOIN campaign_brief for display name -> ref_calendar_entry_status and campaign_brief queried for form dropdowns -> JSON response -> React state refresh.',
 'Admin opens page -> GET entries+briefs+statuses -> list renders -> create/edit via modal form -> POST/PATCH -> list reloads -> delete via confirm -> DELETE -> list reloads.',
 'As a marketing admin, I want one place to see and plan all upcoming content across every channel (social, email, SMS, blog, banner, events, workshops, retreats) instead of only seeing social posts, so I can spot gaps and conflicts before they happen.',
 'Title, content type, optional channel, scheduled date/time, status, optional linked campaign brief, optional assignee, optional tags/notes.',
 'Real Postgres CRUD over content_calendar_entry -- no mock data, no client-side-only state.',
 'A persisted calendar entry visible to every admin session, joined with its campaign brief name where linked.',
 'A working admin list + create/edit/delete UI backed by the real table and a real API -- the schema is no longer unwired, but the calendar itself is still empty until admins start using it, and no automation reads from it yet.',
 NULL, NULL, '/admin/marketing-calendar',
 ARRAY['content_calendar_entry', 'campaign_brief', 'ref_calendar_entry_status'],
 '[{"name":"Plan a social post","flow":"Admin creates an entry with content type social_post, a channel, and a scheduled date -- shows up in the filtered list under status Planned"},{"name":"Link an entry to a campaign","flow":"Admin picks an existing campaign brief from the dropdown when creating/editing an entry so the calendar shows which campaign each piece of content belongs to"}]'::jsonb,
 '[]'::jsonb,
 'No month/week date-grid view (list only, unlike /admin/social/calendar''s grid) -- planned as a future iteration. No drag-and-drop reschedule. No cross-channel conflict/overlap detection. No automation reads content_calendar_entry yet (no job publishes from a "scheduled" row). content_variant_id linkage exists in the schema but has no UI to attach a specific content variant yet. campaign_brief table itself has 0 rows currently, so the brief-link dropdown is empty until briefs are created.',
 'Marketing Calendar admin UI build session, 2026-09-03 (prior audit: real schema, 0 rows, no admin UI -- registry showed UI: false, Database: true (empty), Admin Portal: false)', now(), 'claude-session-marketing-calendar-20260903')
ON CONFLICT (app, module_key) DO UPDATE SET
  name = EXCLUDED.name, description = EXCLUDED.description, built_status = EXCLUDED.built_status,
  has_user_ui = EXCLUDED.has_user_ui, has_admin_ui = EXCLUDED.has_admin_ui,
  user_flow = EXCLUDED.user_flow, admin_flow = EXCLUDED.admin_flow, data_flow = EXCLUDED.data_flow,
  flowchart = EXCLUDED.flowchart, user_story = EXCLUDED.user_story, input_desc = EXCLUDED.input_desc,
  process_desc = EXCLUDED.process_desc, output_desc = EXCLUDED.output_desc, final_outcome = EXCLUDED.final_outcome,
  job_name = EXCLUDED.job_name, report_location = EXCLUDED.report_location, dashboard_location = EXCLUDED.dashboard_location,
  schema_tables = EXCLUDED.schema_tables, demo_use_cases = EXCLUDED.demo_use_cases,
  integration_platforms = EXCLUDED.integration_platforms, missing_items = EXCLUDED.missing_items,
  source_doc = EXCLUDED.source_doc, last_verified_at = EXCLUDED.last_verified_at, verified_by = EXCLUDED.verified_by,
  updated_at = now();
