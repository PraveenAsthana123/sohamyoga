-- Web Push Notifications — first real build, 2026-09-03. Prior audit found
-- public/sw.js was a 4-line cache-only stub and zero repo hits for
-- PushManager / push_subscription / firebase.messaging: genuinely unbuilt,
-- not just unwired. No external account/credential dependency — self-hosted
-- Web Push via self-generated VAPID keys, no third-party push service.
INSERT INTO module_registry (app, module_key, name, description, built_status,
  user_flow, admin_flow, data_flow, flowchart, user_story, input_desc, process_desc, output_desc, final_outcome,
  job_name, report_location, dashboard_location, schema_tables, demo_use_cases, integration_platforms, missing_items,
  source_doc, last_verified_at, verified_by)
VALUES
('sohamyoga-frontend', 'web-push-notifications', 'Web Push Notifications',
 'Browser push subscribe/send via self-generated VAPID keys and the web-push package — no third-party push provider.', 'partial',
 'Customer toggles "Browser push notifications" on /customer/preferences -> browser asks for Notification permission -> service worker (public/sw.js) subscribes via PushManager -> subscription persisted to push_subscription. A future push shows via the sw.js push/notificationclick handlers, which focus or open the right app URL.',
 'No admin UI yet — sending is code-only via sendPushToUser()/sendPushNotification() in src/lib/web-push.ts. No admin console to compose/broadcast a push exists.',
 'Browser subscribe -> POST /api/customer/push-subscriptions (upsert on tenant_id+endpoint) -> push_subscription row -> a caller invokes sendPushToUser(userId, payload) -> web-push signs with VAPID and POSTs to the browser''s own push service (FCM/Mozilla autopush/etc.) -> sw.js push event -> self.registration.showNotification -> notificationclick focuses/opens the app.',
 'Toggle ON -> Notification.requestPermission -> pushManager.subscribe(VAPID key) -> POST subscription -> DB row. Send: sendPushToUser() -> web-push.sendNotification() -> browser push service -> sw.js showNotification -> click -> focus/open URL. Toggle OFF -> pushManager.unsubscribe() -> DELETE subscription.',
 'As a customer, I want to get a class reminder on my phone/laptop even when SohamYoga is not open in a tab, so I don''t miss class.',
 'Browser Notification permission grant + the browser-issued PushSubscription (endpoint + p256dh/auth keys). Server side: NEXT_PUBLIC_VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_SUBJECT.',
 'Real VAPID-signed Web Push via the web-push npm package — genuine protocol delivery to the browser''s own push endpoint, not a simulated/logged send.',
 'A real OS/browser notification the customer can click to open the right SohamYoga URL.',
 'A working self-hosted push channel with a stored, upsertable, deletable subscription per device and a callable send primitive — but not yet a running dispatch pipeline.',
 NULL, NULL, NULL,
 ARRAY['push_subscription'],
 '[{"name":"Enable push from preferences","flow":"Customer opens /customer/preferences, toggles browser push on, grants permission, subscription is saved"},{"name":"Manual test send","flow":"A developer calls sendPushToUser(userId, {title,body,url}) directly to verify end-to-end delivery"}]'::jsonb,
 '[]'::jsonb,
 'NotificationDispatchJob.ts deliberately does NOT branch on channel=''push'' yet (see its own header comment, added 2026-09-03): that job forwards raw template variables to Novu for external rendering and never renders notification_template.body locally, so a real push branch needs template interpolation added first rather than guessing a payload shape. No admin compose/broadcast UI. No badge/icon assets beyond the existing /icon.svg placeholder (no dedicated 192px push icon exists in public/). No pushsubscriptionchange re-subscribe handling in sw.js.',
 'Web Push build session, 2026-09-03 (prior audit: sw.js was a 4-line cache-only stub, zero hits for PushManager/push_subscription/firebase.messaging)', now(), 'claude-session-web-push-20260903')
ON CONFLICT (app, module_key) DO UPDATE SET
  name = EXCLUDED.name, description = EXCLUDED.description, built_status = EXCLUDED.built_status,
  user_flow = EXCLUDED.user_flow, admin_flow = EXCLUDED.admin_flow, data_flow = EXCLUDED.data_flow,
  flowchart = EXCLUDED.flowchart, user_story = EXCLUDED.user_story, input_desc = EXCLUDED.input_desc,
  process_desc = EXCLUDED.process_desc, output_desc = EXCLUDED.output_desc, final_outcome = EXCLUDED.final_outcome,
  job_name = EXCLUDED.job_name, report_location = EXCLUDED.report_location, dashboard_location = EXCLUDED.dashboard_location,
  schema_tables = EXCLUDED.schema_tables, demo_use_cases = EXCLUDED.demo_use_cases,
  integration_platforms = EXCLUDED.integration_platforms, missing_items = EXCLUDED.missing_items,
  source_doc = EXCLUDED.source_doc, last_verified_at = EXCLUDED.last_verified_at, verified_by = EXCLUDED.verified_by,
  updated_at = now();
