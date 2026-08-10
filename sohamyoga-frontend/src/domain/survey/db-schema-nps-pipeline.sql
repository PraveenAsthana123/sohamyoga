-- Post-class NPS feedback pipeline seed data. The survey/question/response
-- schema (Wave 11) was fully migrated but had zero rows and no submission
-- mechanism — this seeds the one real survey the pipeline needs. No tenant_id
-- column exists on `survey` (single global survey list in this schema).
--
-- created_by/published_by/sent_by are NOT NULL UUID columns with no FK
-- constraint (verified against the live schema) — this fixed nil UUID marks
-- rows created by an automated/system process rather than a specific staff
-- member, consistently across this feature's inserts.

INSERT INTO survey (
  slug, title, description, type, status, visibility, language,
  allow_anonymous, require_login, allow_multiple, show_progress_bar,
  confirmation_message, created_by, published_by, published_at
)
SELECT
  'post-class-experience', 'Post-Class Experience', 'Sent after a checked-in class to measure Net Promoter Score.',
  'nps', 'active', 'public', 'en',
  TRUE, FALSE, FALSE, FALSE,
  'Thank you for your feedback!', '00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000000', now()
WHERE NOT EXISTS (SELECT 1 FROM survey WHERE slug = 'post-class-experience');

INSERT INTO survey_question (survey_id, type, text, is_required, display_order, rating_min, rating_max, rating_min_label, rating_max_label)
SELECT s.id, 'nps', 'How likely are you to recommend Soham Yoga to a friend or colleague?', TRUE, 0, 0, 10, 'Not at all likely', 'Extremely likely'
FROM survey s
WHERE s.slug = 'post-class-experience'
  AND NOT EXISTS (SELECT 1 FROM survey_question WHERE survey_id = s.id AND type = 'nps');

INSERT INTO survey_question (survey_id, type, text, is_required, display_order, max_length)
SELECT s.id, 'long_text', 'What is the main reason for your score?', FALSE, 1, 1000
FROM survey s
WHERE s.slug = 'post-class-experience'
  AND NOT EXISTS (SELECT 1 FROM survey_question WHERE survey_id = s.id AND type = 'long_text');
