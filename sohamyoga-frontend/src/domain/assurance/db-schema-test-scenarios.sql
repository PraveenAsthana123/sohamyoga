-- Initial executable acceptance catalog. Runners resolve `action` through a
-- whitelist; scenario JSON is data, never an arbitrary shell command.
WITH cases(suite_key,case_key,name,polarity,scenario,expected) AS (VALUES
 ('customer-daily-e2e','register-valid','Customer registers with valid consent','positive','{"action":"customer.register","fixture":"new_customer_with_consent"}'::jsonb,'{"httpStatus":201,"customerCreated":true}'::jsonb),
 ('customer-daily-e2e','register-duplicate','Duplicate email is rejected idempotently','negative','{"action":"customer.register","fixture":"existing_email"}'::jsonb,'{"httpStatus":409,"duplicateRows":0}'::jsonb),
 ('customer-daily-e2e','booking-lifecycle','Book, waitlist, reschedule and cancel','positive','{"action":"booking.full_lifecycle","fixture":"customer_with_membership"}'::jsonb,'{"states":["booked","rescheduled","cancelled"],"historyComplete":true}'::jsonb),
 ('customer-daily-e2e','booking-capacity','Full class rejects booking and offers waitlist','boundary','{"action":"booking.capacity_boundary","fixture":"full_class"}'::jsonb,'{"overbooked":false,"waitlistOffered":true}'::jsonb),
 ('customer-daily-e2e','privacy-export-delete','Customer exports then requests deletion','positive','{"action":"privacy.export_delete","fixture":"customer_with_history"}'::jsonb,'{"exportReady":true,"deletionAudited":true}'::jsonb),
 ('customer-daily-e2e','unauthorized-account-access','Customer cannot read another account','negative','{"action":"security.cross_customer_access","fixture":"two_customers"}'::jsonb,'{"httpStatus":403,"piiLeaked":false}'::jsonb),
 ('marketing-positive-negative','campaign-approve-publish','Draft, approve, schedule and publish campaign','positive','{"action":"campaign.full_lifecycle","channels":["email","facebook","youtube"]}'::jsonb,'{"approved":true,"deliveryTracked":true}'::jsonb),
 ('marketing-positive-negative','campaign-no-consent','Suppress non-consenting recipients','negative','{"action":"campaign.send","fixture":"mixed_consent_segment"}'::jsonb,'{"suppressed":true,"unauthorizedSends":0}'::jsonb),
 ('marketing-positive-negative','provider-outage','Provider outage opens breaker and preserves retry','failure_injection','{"action":"campaign.provider_outage","provider":"postiz"}'::jsonb,'{"circuit":"open","duplicatePublishes":0,"retryQueued":true}'::jsonb),
 ('marketing-positive-negative','ab-winner','A/B test promotes statistically eligible winner','boundary','{"action":"campaign.ab_evaluate","fixture":"minimum_sample_boundary"}'::jsonb,'{"prematureWinner":false}'::jsonb),
 ('voice-positive-negative','inbound-known-caller','Inbound known caller loads contact and script','positive','{"action":"voice.inbound_webhook","fixture":"known_caller"}'::jsonb,'{"callCreated":true,"contactMatched":true,"scriptSelected":true}'::jsonb),
 ('voice-positive-negative','outbound-consented','Outbound consented call records full lifecycle','positive','{"action":"voice.outbound_call","fixture":"consented_contact"}'::jsonb,'{"providerCallCreated":true,"historyComplete":true}'::jsonb),
 ('voice-positive-negative','do-not-call','Outbound call is blocked for DNC contact','negative','{"action":"voice.outbound_call","fixture":"do_not_call_contact"}'::jsonb,'{"providerCalls":0,"blockedReason":"do_not_call"}'::jsonb),
 ('voice-positive-negative','duplicate-provider-webhook','Repeated provider webhook is idempotent','boundary','{"action":"voice.replay_webhook","repetitions":3}'::jsonb,'{"callRows":1,"eventRows":1}'::jsonb),
 ('voice-positive-negative','asterisk-unavailable','Asterisk outage opens breaker and schedules retry','failure_injection','{"action":"voice.provider_outage","provider":"asterisk"}'::jsonb,'{"circuit":"open","retryQueued":true}'::jsonb),
 ('platform-load-1000','customer-mixed-load','One thousand concurrent customer journeys','positive','{"action":"load.customer","targetKey":"customer-portal-1000"}'::jsonb,'{"thresholdsPass":true}'::jsonb),
 ('platform-load-1000','marketing-mixed-load','One thousand concurrent campaign operations','positive','{"action":"load.marketing","targetKey":"marketing-campaign-1000"}'::jsonb,'{"thresholdsPass":true,"duplicateOperations":0}'::jsonb),
 ('platform-load-1000','voice-control-load','One thousand concurrent voice control operations','positive','{"action":"load.voice","targetKey":"voice-operations-1000"}'::jsonb,'{"thresholdsPass":true,"lostEvents":0}'::jsonb)
)
INSERT INTO test_case_master(suite_id,case_key,name,polarity,scenario,expected_result)
SELECT s.id,c.case_key,c.name,c.polarity,c.scenario,c.expected
FROM cases c JOIN test_suite_master s ON s.suite_key=c.suite_key
ON CONFLICT(suite_id,case_key) DO UPDATE SET name=EXCLUDED.name,polarity=EXCLUDED.polarity,scenario=EXCLUDED.scenario,expected_result=EXCLUDED.expected_result,enabled=TRUE;
