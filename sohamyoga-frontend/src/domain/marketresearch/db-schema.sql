-- Market Research — Database Schema
-- Framework -> Topic -> 3-tab hierarchy. Three real research frameworks:
--   1. 17-layer market research & forecasting (population -> forecasting) —
--      used to size and validate the Calgary/Alberta spa & wellness market
--      (docs/market-research-growth-framework.md §2).
--   2. New Entrant Market Entry Scorecard (20 components, §6) — "should I
--      enter this market?"
--   3. Existing Centre Growth Research (52 components, §7) — "why aren't
--      customers coming?"
-- Every topic has exactly 3 research_topic_tab rows (process / input /
-- output) whose content is the real, user-supplied research framework text
-- transcribed from the MD file — not filler. Job Schedule is NOT a 4th
-- tab_key value — it is computed at request time by the API route from
-- research_topic.job_name + CRON_JOBS + operation_run.

CREATE TABLE IF NOT EXISTS research_framework (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  slug          TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL,
  description   TEXT NOT NULL,
  sort_order    INTEGER NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO research_framework (slug, name, description, sort_order) VALUES
  ('17-layer-forecasting',  '17-Layer Market Research & Forecasting',
   'Population-to-forecasting sizing framework used to validate the Calgary/Alberta spa & wellness market (docs/market-research-growth-framework.md §2).', 1),
  ('new-entrant-scorecard', 'New Entrant Market Entry Scorecard',
   'For a new player planning to start a yoga centre: should I enter this market, where, whom to target, what to offer, what to charge, can it be profitable? (§6)', 2),
  ('existing-centre-growth', 'Existing Centre Growth Research',
   'For an existing, low-customer studio: why are customers not coming, where are we losing them, what can we change to increase customers, retention, revenue and profit? (§7)', 3)
ON CONFLICT (slug) DO NOTHING;

CREATE TABLE IF NOT EXISTS research_topic (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  slug          TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL,
  layer_number  INTEGER NOT NULL,
  summary       TEXT NOT NULL DEFAULT '',
  framework_id  UUID,
  job_name      TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_research_topic_layer ON research_topic (layer_number);

-- framework_id/job_name pre-date this migration's first version — ADD
-- COLUMN IF NOT EXISTS is a no-op on a fresh database (already defined
-- above) and real work on a database that already has the original 17 rows.
-- Left nullable here on purpose: NOT NULL is applied further below, AFTER
-- the 17-row seed insert, so a fresh database's own seed insert (which
-- does not specify framework_id) is never blocked by it.
ALTER TABLE research_topic ADD COLUMN IF NOT EXISTS framework_id UUID;
ALTER TABLE research_topic ADD COLUMN IF NOT EXISTS job_name TEXT;

CREATE TABLE IF NOT EXISTS research_topic_tab (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  topic_id    UUID NOT NULL REFERENCES research_topic(id) ON DELETE CASCADE,
  tab_key     TEXT NOT NULL,
  tab_label   TEXT NOT NULL,
  content     TEXT NOT NULL DEFAULT '',
  sort_order  INTEGER NOT NULL DEFAULT 0,
  UNIQUE (topic_id, tab_key)
);

CREATE INDEX IF NOT EXISTS idx_research_topic_tab_topic ON research_topic_tab (topic_id, sort_order);

-- Relabel any pre-existing rows from the original 3 tab_key values to the
-- new framework-agnostic set BEFORE adding the new CHECK constraint (the
-- old constraint, if present, is dropped first so the relabel itself is
-- never blocked by it) — pure relabel, same content, no rewriting:
-- overview -> process, data_kpis -> input, forecast_decision -> output.
ALTER TABLE research_topic_tab DROP CONSTRAINT IF EXISTS research_topic_tab_tab_key_check;

UPDATE research_topic_tab SET tab_key = 'process' WHERE tab_key = 'overview';
UPDATE research_topic_tab SET tab_key = 'input'   WHERE tab_key = 'data_kpis';
UPDATE research_topic_tab SET tab_key = 'output'  WHERE tab_key = 'forecast_decision';
UPDATE research_topic_tab SET tab_label = 'Process' WHERE tab_key = 'process' AND tab_label = 'Overview';
UPDATE research_topic_tab SET tab_label = 'Input'   WHERE tab_key = 'input'   AND tab_label = 'Data & KPIs';
UPDATE research_topic_tab SET tab_label = 'Output'  WHERE tab_key = 'output'  AND tab_label = 'Forecast & Decision';

ALTER TABLE research_topic_tab ADD CONSTRAINT research_topic_tab_tab_key_check
  CHECK (tab_key IN ('process', 'input', 'output'));

-- ─────────────────────────────────────────────
-- Seed: the 17 real research-framework layers (17-layer-forecasting)
-- ─────────────────────────────────────────────

-- framework_id is specified explicitly (not left to the later backfill
-- UPDATE) so this insert stays correct on every re-run, not just the
-- first: once framework_id is NOT NULL (below), an INSERT that omits it
-- would fail NOT NULL validation before ON CONFLICT DO NOTHING ever gets a
-- chance to skip the conflicting row.
INSERT INTO research_topic (slug, name, layer_number, summary, framework_id) VALUES
  ('population',         'Population',         1,  'Calgary/Alberta population',                            (SELECT id FROM research_framework WHERE slug = '17-layer-forecasting')),
  ('customer-segments',  'Customer segments',  2,  'Women, men, couples, seniors, professionals, tourists', (SELECT id FROM research_framework WHERE slug = '17-layer-forecasting')),
  ('income',             'Income',              3,  'Disposable income',                                     (SELECT id FROM research_framework WHERE slug = '17-layer-forecasting')),
  ('geography',          'Geography',           4,  'NW/NE/SW/SE/downtown',                                  (SELECT id FROM research_framework WHERE slug = '17-layer-forecasting')),
  ('demand',             'Demand',              5,  'Massage, facial, sauna, steam, etc.',                   (SELECT id FROM research_framework WHERE slug = '17-layer-forecasting')),
  ('supply',             'Supply',              6,  'Number of competing spas',                              (SELECT id FROM research_framework WHERE slug = '17-layer-forecasting')),
  ('competitors',        'Competitors',         7,  '50-100 centres',                                        (SELECT id FROM research_framework WHERE slug = '17-layer-forecasting')),
  ('pricing',            'Pricing',             8,  'Service/menu pricing',                                  (SELECT id FROM research_framework WHERE slug = '17-layer-forecasting')),
  ('utilization',        'Utilization',         9,  'Rooms x hours x bookings',                              (SELECT id FROM research_framework WHERE slug = '17-layer-forecasting')),
  ('revenue',            'Revenue',             10, 'Customers x visits x spend',                             (SELECT id FROM research_framework WHERE slug = '17-layer-forecasting')),
  ('membership',         'Membership',          11, 'Monthly plans',                                         (SELECT id FROM research_framework WHERE slug = '17-layer-forecasting')),
  ('corporate',          'Corporate',           12, 'Employer wellness',                                     (SELECT id FROM research_framework WHERE slug = '17-layer-forecasting')),
  ('tourism',            'Tourism',             13, 'Visitors/hotel guests',                                 (SELECT id FROM research_framework WHERE slug = '17-layer-forecasting')),
  ('reviews',            'Reviews',             14, 'Google/social reviews',                                 (SELECT id FROM research_framework WHERE slug = '17-layer-forecasting')),
  ('trends',             'Trends',              15, 'New wellness formats',                                  (SELECT id FROM research_framework WHERE slug = '17-layer-forecasting')),
  ('expansion',          'Expansion',           16, 'New services',                                          (SELECT id FROM research_framework WHERE slug = '17-layer-forecasting')),
  ('forecasting',        'Forecasting',         17, '1/3/5-year',                                            (SELECT id FROM research_framework WHERE slug = '17-layer-forecasting'))
ON CONFLICT (slug) DO NOTHING;

-- Each topic gets the same three tabs. Content is the layer's real
-- process / input / output framework text (relabeled from the original
-- overview / data-and-KPIs / forecast-and-decision names — same content).
INSERT INTO research_topic_tab (topic_id, tab_key, tab_label, content, sort_order)
SELECT t.id, x.tab_key, x.tab_label, x.content, x.sort_order
FROM research_topic t
JOIN (VALUES
  ('population',        'process',           'Process',              'Calgary/Alberta population',                     1),
  ('population',        'input',          'Input',           'Population, households, age',                    2),
  ('population',        'output',  'Output',   'Addressable population',                         3),

  ('customer-segments', 'process',           'Process',              'Women, men, couples, seniors, professionals, tourists', 1),
  ('customer-segments', 'input',          'Input',           'Segment size',                                   2),
  ('customer-segments', 'output',  'Output',   'Best target segment',                            3),

  ('income',            'process',           'Process',              'Disposable income',                              1),
  ('income',            'input',          'Input',           'Income bands',                                   2),
  ('income',            'output',  'Output',   'Premium vs value',                               3),

  ('geography',         'process',           'Process',              'NW/NE/SW/SE/downtown',                           1),
  ('geography',         'input',          'Input',           'Population + competitors',                       2),
  ('geography',         'output',  'Output',   'Location opportunity',                           3),

  ('demand',            'process',           'Process',              'Massage, facial, sauna, steam, etc.',            1),
  ('demand',            'input',          'Input',           'Search/survey/bookings',                         2),
  ('demand',            'output',  'Output',   'Demand index',                                   3),

  ('supply',            'process',           'Process',              'Number of competing spas',                       1),
  ('supply',            'input',          'Input',           'Locations/capacity',                             2),
  ('supply',            'output',  'Output',   'Supply index',                                   3),

  ('competitors',       'process',           'Process',              '50-100 centres',                                 1),
  ('competitors',       'input',          'Input',           'Price/services/reviews',                         2),
  ('competitors',       'output',  'Output',   'Competitive position',                           3),

  ('pricing',           'process',           'Process',              'Service/menu pricing',                           1),
  ('pricing',           'input',          'Input',           'Avg/min/max price',                              2),
  ('pricing',           'output',  'Output',   'Optimal pricing',                                3),

  ('utilization',       'process',           'Process',              'Rooms x hours x bookings',                       1),
  ('utilization',       'input',          'Input',           'Occupancy %',                                    2),
  ('utilization',       'output',  'Output',   'Capacity requirement',                           3),

  ('revenue',           'process',           'Process',              'Customers x visits x spend',                     1),
  ('revenue',            'input',         'Input',           'Revenue/customer',                               2),
  ('revenue',            'output', 'Output',   'Revenue forecast',                               3),

  ('membership',        'process',           'Process',              'Monthly plans',                                  1),
  ('membership',        'input',          'Input',           'Conversion/churn',                               2),
  ('membership',        'output',  'Output',   'Recurring revenue',                              3),

  ('corporate',         'process',           'Process',              'Employer wellness',                              1),
  ('corporate',         'input',          'Input',           'Contracts/employees',                            2),
  ('corporate',         'output',  'Output',   'B2B opportunity',                                3),

  ('tourism',           'process',           'Process',              'Visitors/hotel guests',                          1),
  ('tourism',            'input',         'Input',           'Tourist spend',                                  2),
  ('tourism',            'output', 'Output',   'Destination wellness',                           3),

  ('reviews',           'process',           'Process',              'Google/social reviews',                          1),
  ('reviews',            'input',         'Input',           'Sentiment/NPS',                                  2),
  ('reviews',            'output', 'Output',   'Product improvement',                            3),

  ('trends',             'process',          'Process',              'New wellness formats',                           1),
  ('trends',              'input',        'Input',           'Growth/search signals',                          2),
  ('trends',              'output','Output',   'Emerging opportunity',                           3),

  ('expansion',          'process',          'Process',              'New services',                                   1),
  ('expansion',           'input',        'Input',           'TAM/SAM/SOM',                                    2),
  ('expansion',           'output','Output',   'Product roadmap',                                3),

  ('forecasting',        'process',          'Process',              '1/3/5-year',                                     1),
  ('forecasting',         'input',        'Input',           'Customers/revenue/cost',                         2),
  ('forecasting',         'output','Output',   'Investment decision',                            3)
) AS x(slug, tab_key, tab_label, content, sort_order)
  ON x.slug = t.slug
ON CONFLICT (topic_id, tab_key) DO NOTHING;

-- Backfill the 17-layer topics onto the 17-layer-forecasting framework,
-- then constrain framework_id NOT NULL now that every existing/seeded row
-- has one. Runs AFTER both seed inserts above so it is never blocked by
-- rows the seed insert itself is about to create.
UPDATE research_topic SET framework_id = (SELECT id FROM research_framework WHERE slug = '17-layer-forecasting')
WHERE framework_id IS NULL;

ALTER TABLE research_topic ALTER COLUMN framework_id SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'research_topic_framework_id_fkey'
  ) THEN
    ALTER TABLE research_topic
      ADD CONSTRAINT research_topic_framework_id_fkey
      FOREIGN KEY (framework_id) REFERENCES research_framework(id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_research_topic_framework ON research_topic (framework_id, layer_number);

-- ─────────────────────────────────────────────
-- Seed: New Entrant Market Entry Scorecard (20 components, §6)
-- Columns transcribed: # -> layer_number, Component -> name/slug,
-- "What you need to determine" -> process tab, "Key data to collect" ->
-- input tab, "Final output" -> output tab.
-- ─────────────────────────────────────────────

INSERT INTO research_topic (slug, name, layer_number, summary, framework_id) VALUES
  ('market-definition', 'Market Definition', 1, 'Exactly what business are you entering?', (SELECT id FROM research_framework WHERE slug = 'new-entrant-scorecard')),
  ('geographic-market', 'Geographic Market', 2, 'Where should you operate?', (SELECT id FROM research_framework WHERE slug = 'new-entrant-scorecard')),
  ('population-analysis', 'Population Analysis', 3, 'How many potential customers exist?', (SELECT id FROM research_framework WHERE slug = 'new-entrant-scorecard')),
  ('demographic-analysis', 'Demographic Analysis', 4, 'Who lives there?', (SELECT id FROM research_framework WHERE slug = 'new-entrant-scorecard')),
  ('lifestyle-psychographic-analysis', 'Lifestyle/Psychographic Analysis', 5, 'Why would they practice yoga?', (SELECT id FROM research_framework WHERE slug = 'new-entrant-scorecard')),
  ('customer-segmentation', 'Customer Segmentation', 6, 'Which groups should be targeted?', (SELECT id FROM research_framework WHERE slug = 'new-entrant-scorecard')),
  ('needs-pain-point-research', 'Needs/Pain-Point Research', 7, 'What problem are customers solving?', (SELECT id FROM research_framework WHERE slug = 'new-entrant-scorecard')),
  ('demand-analysis', 'Demand Analysis', 8, 'Is there enough demand?', (SELECT id FROM research_framework WHERE slug = 'new-entrant-scorecard')),
  ('supply-analysis', 'Supply Analysis', 9, 'How much yoga supply already exists?', (SELECT id FROM research_framework WHERE slug = 'new-entrant-scorecard')),
  ('competitor-analysis', 'Competitor Analysis', 10, 'Who are you competing against?', (SELECT id FROM research_framework WHERE slug = 'new-entrant-scorecard')),
  ('product-analysis', 'Product Analysis', 11, 'What should you sell?', (SELECT id FROM research_framework WHERE slug = 'new-entrant-scorecard')),
  ('pricing-research', 'Pricing Research', 12, 'What will people pay?', (SELECT id FROM research_framework WHERE slug = 'new-entrant-scorecard')),
  ('location-analysis', 'Location Analysis', 13, 'Where should the centre physically be?', (SELECT id FROM research_framework WHERE slug = 'new-entrant-scorecard')),
  ('online-market-analysis', 'Online Market Analysis', 14, 'Should online/hybrid be offered?', (SELECT id FROM research_framework WHERE slug = 'new-entrant-scorecard')),
  ('corporate-b2b-market', 'Corporate/B2B Market', 15, 'Can employers become customers?', (SELECT id FROM research_framework WHERE slug = 'new-entrant-scorecard')),
  ('market-size', 'Market Size', 16, 'What''s the dollar opportunity?', (SELECT id FROM research_framework WHERE slug = 'new-entrant-scorecard')),
  ('tam-sam-som', 'TAM/SAM/SOM', 17, 'What portion can be realistically captured?', (SELECT id FROM research_framework WHERE slug = 'new-entrant-scorecard')),
  ('revenue-forecast', 'Revenue Forecast', 18, 'How much could you make?', (SELECT id FROM research_framework WHERE slug = 'new-entrant-scorecard')),
  ('cost-and-break-even', 'Cost & Break-even', 19, 'How many customers required?', (SELECT id FROM research_framework WHERE slug = 'new-entrant-scorecard')),
  ('entry-decision', 'Entry Decision', 20, 'Should you launch?', (SELECT id FROM research_framework WHERE slug = 'new-entrant-scorecard'))
ON CONFLICT (slug) DO NOTHING;

INSERT INTO research_topic_tab (topic_id, tab_key, tab_label, content, sort_order)
SELECT t.id, x.tab_key, x.tab_label, x.content, x.sort_order
FROM research_topic t
JOIN (VALUES
  ('market-definition', 'process', 'Process', 'Exactly what business are you entering?', 1),
  ('market-definition', 'input',   'Input',   'Yoga, meditation, wellness, online/offline', 2),
  ('market-definition', 'output',  'Output',  'Market boundary', 3),
  ('geographic-market', 'process', 'Process', 'Where should you operate?', 1),
  ('geographic-market', 'input',   'Input',   'City, communities, postal codes, commute', 2),
  ('geographic-market', 'output',  'Output',  'Geographic market', 3),
  ('population-analysis', 'process', 'Process', 'How many potential customers exist?', 1),
  ('population-analysis', 'input',   'Input',   'Population, households, growth', 2),
  ('population-analysis', 'output',  'Output',  'Population base', 3),
  ('demographic-analysis', 'process', 'Process', 'Who lives there?', 1),
  ('demographic-analysis', 'input',   'Input',   'Age, household, gender, income, family structure', 2),
  ('demographic-analysis', 'output',  'Output',  'Demographic profile', 3),
  ('lifestyle-psychographic-analysis', 'process', 'Process', 'Why would they practice yoga?', 1),
  ('lifestyle-psychographic-analysis', 'input',   'Input',   'Wellness interest, motivation, attitudes', 2),
  ('lifestyle-psychographic-analysis', 'output',  'Output',  'Personas', 3),
  ('customer-segmentation', 'process', 'Process', 'Which groups should be targeted?', 1),
  ('customer-segmentation', 'input',   'Input',   'Beginner, professional, senior, kids, families', 2),
  ('customer-segmentation', 'output',  'Output',  'Segment matrix', 3),
  ('needs-pain-point-research', 'process', 'Process', 'What problem are customers solving?', 1),
  ('needs-pain-point-research', 'input',   'Input',   'Stress, flexibility, fitness, mobility, community', 2),
  ('needs-pain-point-research', 'output',  'Output',  'Need hierarchy', 3),
  ('demand-analysis', 'process', 'Process', 'Is there enough demand?', 1),
  ('demand-analysis', 'input',   'Input',   'Surveys, search demand, inquiries, trials', 2),
  ('demand-analysis', 'output',  'Output',  'Demand score', 3),
  ('supply-analysis', 'process', 'Process', 'How much yoga supply already exists?', 1),
  ('supply-analysis', 'input',   'Input',   'Studios, gyms, instructors, online options', 2),
  ('supply-analysis', 'output',  'Output',  'Supply score', 3),
  ('competitor-analysis', 'process', 'Process', 'Who are you competing against?', 1),
  ('competitor-analysis', 'input',   'Input',   '20–50 competitors', 2),
  ('competitor-analysis', 'output',  'Output',  'Competitor database', 3),
  ('product-analysis', 'process', 'Process', 'What should you sell?', 1),
  ('product-analysis', 'input',   'Input',   'Class types, duration, frequency', 2),
  ('product-analysis', 'output',  'Output',  'Product portfolio', 3),
  ('pricing-research', 'process', 'Process', 'What will people pay?', 1),
  ('pricing-research', 'input',   'Input',   'Drop-in, memberships, packages', 2),
  ('pricing-research', 'output',  'Output',  'Pricing model', 3),
  ('location-analysis', 'process', 'Process', 'Where should the centre physically be?', 1),
  ('location-analysis', 'input',   'Input',   'Rent, parking, transit, population, competitors', 2),
  ('location-analysis', 'output',  'Output',  'Location score', 3),
  ('online-market-analysis', 'process', 'Process', 'Should online/hybrid be offered?', 1),
  ('online-market-analysis', 'input',   'Input',   'Online preference, geographic reach', 2),
  ('online-market-analysis', 'output',  'Output',  'Channel strategy', 3),
  ('corporate-b2b-market', 'process', 'Process', 'Can employers become customers?', 1),
  ('corporate-b2b-market', 'input',   'Input',   'Companies, employees, wellness needs', 2),
  ('corporate-b2b-market', 'output',  'Output',  'B2B opportunity', 3),
  ('market-size', 'process', 'Process', 'What''s the dollar opportunity?', 1),
  ('market-size', 'input',   'Input',   'Population × demand × spending', 2),
  ('market-size', 'output',  'Output',  'Market value', 3),
  ('tam-sam-som', 'process', 'Process', 'What portion can be realistically captured?', 1),
  ('tam-sam-som', 'input',   'Input',   'Eligible/accessible/acquirable customers', 2),
  ('tam-sam-som', 'output',  'Output',  'TAM/SAM/SOM', 3),
  ('revenue-forecast', 'process', 'Process', 'How much could you make?', 1),
  ('revenue-forecast', 'input',   'Input',   'Customers × price × frequency', 2),
  ('revenue-forecast', 'output',  'Output',  '1/3/5-year forecast', 3),
  ('cost-and-break-even', 'process', 'Process', 'How many customers required?', 1),
  ('cost-and-break-even', 'input',   'Input',   'Rent, instructor, utilities, marketing', 2),
  ('cost-and-break-even', 'output',  'Output',  'Break-even point', 3),
  ('entry-decision', 'process', 'Process', 'Should you launch?', 1),
  ('entry-decision', 'input',   'Input',   'All preceding evidence', 2),
  ('entry-decision', 'output',  'Output',  'Go / pilot / no-go', 3)
) AS x(slug, tab_key, tab_label, content, sort_order)
  ON x.slug = t.slug
ON CONFLICT (topic_id, tab_key) DO NOTHING;

-- ─────────────────────────────────────────────
-- Seed: Existing Yoga Centre Growth Research Framework (52 components, §7)
-- Columns transcribed: # -> layer_number, Research component -> name/slug,
-- "Main question" -> process tab, "What to measure" -> input tab,
-- "Target output" -> output tab. Two component names ("Competitor
-- Analysis", "Pricing Research") and one ("Forecasting") also appear in §6
-- and the 17-layer framework respectively — those three rows use a
-- "-growth" suffixed slug to keep the global slug UNIQUE constraint intact;
-- their name/content columns are still the exact §7 text, untouched.
-- ─────────────────────────────────────────────

INSERT INTO research_topic (slug, name, layer_number, summary, framework_id) VALUES
  ('current-business-baseline', 'Current Business Baseline', 1, 'Where are we today?', (SELECT id FROM research_framework WHERE slug = 'existing-centre-growth')),
  ('market-potential', 'Market Potential', 2, 'Is sufficient demand available?', (SELECT id FROM research_framework WHERE slug = 'existing-centre-growth')),
  ('market-penetration', 'Market Penetration', 3, 'How much market have we captured?', (SELECT id FROM research_framework WHERE slug = 'existing-centre-growth')),
  ('customer-database-analysis', 'Customer Database Analysis', 4, 'Who actually comes?', (SELECT id FROM research_framework WHERE slug = 'existing-centre-growth')),
  ('active-customer-analysis', 'Active Customer Analysis', 5, 'Who is currently engaged?', (SELECT id FROM research_framework WHERE slug = 'existing-centre-growth')),
  ('inactive-customer-analysis', 'Inactive Customer Analysis', 6, 'Who stopped coming?', (SELECT id FROM research_framework WHERE slug = 'existing-centre-growth')),
  ('lost-customer-research', 'Lost Customer Research', 7, 'Why did they leave?', (SELECT id FROM research_framework WHERE slug = 'existing-centre-growth')),
  ('non-customer-research', 'Non-Customer Research', 8, 'Why don''t prospects join?', (SELECT id FROM research_framework WHERE slug = 'existing-centre-growth')),
  ('lead-analysis', 'Lead Analysis', 9, 'Are inquiries converting?', (SELECT id FROM research_framework WHERE slug = 'existing-centre-growth')),
  ('lead-to-trial-conversion', 'Lead-to-Trial Conversion', 10, 'Are leads trying?', (SELECT id FROM research_framework WHERE slug = 'existing-centre-growth')),
  ('trial-to-paid-conversion', 'Trial-to-Paid Conversion', 11, 'Do trials become customers?', (SELECT id FROM research_framework WHERE slug = 'existing-centre-growth')),
  ('retention-analysis', 'Retention Analysis', 12, 'Do customers stay?', (SELECT id FROM research_framework WHERE slug = 'existing-centre-growth')),
  ('churn-analysis', 'Churn Analysis', 13, 'How many leave?', (SELECT id FROM research_framework WHERE slug = 'existing-centre-growth')),
  ('attendance-analysis', 'Attendance Analysis', 14, 'Which classes work?', (SELECT id FROM research_framework WHERE slug = 'existing-centre-growth')),
  ('capacity-analysis', 'Capacity Analysis', 15, 'Are classes underused?', (SELECT id FROM research_framework WHERE slug = 'existing-centre-growth')),
  ('instructor-analysis', 'Instructor Analysis', 16, 'Does instructor affect demand?', (SELECT id FROM research_framework WHERE slug = 'existing-centre-growth')),
  ('schedule-research', 'Schedule Research', 17, 'Are times wrong?', (SELECT id FROM research_framework WHERE slug = 'existing-centre-growth')),
  ('service-analysis', 'Service Analysis', 18, 'Are we offering the right yoga?', (SELECT id FROM research_framework WHERE slug = 'existing-centre-growth')),
  ('new-service-research', 'New-Service Research', 19, 'What else could customers buy?', (SELECT id FROM research_framework WHERE slug = 'existing-centre-growth')),
  ('pricing-research-growth', 'Pricing Research', 20, 'Is price helping/hurting?', (SELECT id FROM research_framework WHERE slug = 'existing-centre-growth')),
  ('package-analysis', 'Package Analysis', 21, 'Are packages appropriate?', (SELECT id FROM research_framework WHERE slug = 'existing-centre-growth')),
  ('competitor-analysis-growth', 'Competitor Analysis', 22, 'Why are people choosing others?', (SELECT id FROM research_framework WHERE slug = 'existing-centre-growth')),
  ('customer-experience', 'Customer Experience', 23, 'What happens from discovery onward?', (SELECT id FROM research_framework WHERE slug = 'existing-centre-growth')),
  ('satisfaction', 'Satisfaction', 24, 'Are customers happy?', (SELECT id FROM research_framework WHERE slug = 'existing-centre-growth')),
  ('nps', 'NPS', 25, 'Will they recommend?', (SELECT id FROM research_framework WHERE slug = 'existing-centre-growth')),
  ('review-sentiment-analysis', 'Review/Sentiment Analysis', 26, 'What are people saying?', (SELECT id FROM research_framework WHERE slug = 'existing-centre-growth')),
  ('brand-awareness', 'Brand Awareness', 27, 'Does the local market know you?', (SELECT id FROM research_framework WHERE slug = 'existing-centre-growth')),
  ('website-analysis', 'Website Analysis', 28, 'Is the website converting?', (SELECT id FROM research_framework WHERE slug = 'existing-centre-growth')),
  ('google-maps-analysis', 'Google/Maps Analysis', 29, 'Can customers find you?', (SELECT id FROM research_framework WHERE slug = 'existing-centre-growth')),
  ('social-media-analysis', 'Social Media Analysis', 30, 'Does content create customers?', (SELECT id FROM research_framework WHERE slug = 'existing-centre-growth')),
  ('marketing-channel-analysis', 'Marketing Channel Analysis', 31, 'Which channel works?', (SELECT id FROM research_framework WHERE slug = 'existing-centre-growth')),
  ('cac', 'CAC', 32, 'What does one customer cost?', (SELECT id FROM research_framework WHERE slug = 'existing-centre-growth')),
  ('referral-analysis', 'Referral Analysis', 33, 'Are customers bringing others?', (SELECT id FROM research_framework WHERE slug = 'existing-centre-growth')),
  ('loyalty-research', 'Loyalty Research', 34, 'Can customers become advocates?', (SELECT id FROM research_framework WHERE slug = 'existing-centre-growth')),
  ('community-research', 'Community Research', 35, 'Can local partnerships grow reach?', (SELECT id FROM research_framework WHERE slug = 'existing-centre-growth')),
  ('corporate-yoga', 'Corporate Yoga', 36, 'Can B2B increase revenue?', (SELECT id FROM research_framework WHERE slug = 'existing-centre-growth')),
  ('kids-family-market', 'Kids/Family Market', 37, 'Is there family demand?', (SELECT id FROM research_framework WHERE slug = 'existing-centre-growth')),
  ('senior-market', 'Senior Market', 38, 'Is there older-adult demand?', (SELECT id FROM research_framework WHERE slug = 'existing-centre-growth')),
  ('online-yoga', 'Online Yoga', 39, 'Can geography be removed?', (SELECT id FROM research_framework WHERE slug = 'existing-centre-growth')),
  ('hybrid-yoga', 'Hybrid Yoga', 40, 'Do customers want both?', (SELECT id FROM research_framework WHERE slug = 'existing-centre-growth')),
  ('private-classes', 'Private Classes', 41, 'Premium opportunity?', (SELECT id FROM research_framework WHERE slug = 'existing-centre-growth')),
  ('workshops-events', 'Workshops/Events', 42, 'Additional revenue?', (SELECT id FROM research_framework WHERE slug = 'existing-centre-growth')),
  ('cross-sell-analysis', 'Cross-Sell Analysis', 43, 'What else can customers buy?', (SELECT id FROM research_framework WHERE slug = 'existing-centre-growth')),
  ('revenue-per-customer', 'Revenue per Customer', 44, 'Are customers spending enough?', (SELECT id FROM research_framework WHERE slug = 'existing-centre-growth')),
  ('customer-lifetime-value', 'Customer Lifetime Value', 45, 'What is each customer worth?', (SELECT id FROM research_framework WHERE slug = 'existing-centre-growth')),
  ('revenue-leakage', 'Revenue Leakage', 46, 'Where is money being lost?', (SELECT id FROM research_framework WHERE slug = 'existing-centre-growth')),
  ('cost-analysis', 'Cost Analysis', 47, 'Where can cost improve?', (SELECT id FROM research_framework WHERE slug = 'existing-centre-growth')),
  ('profitability-by-service', 'Profitability by Service', 48, 'Which services make money?', (SELECT id FROM research_framework WHERE slug = 'existing-centre-growth')),
  ('forecasting-growth', 'Forecasting', 49, 'What happens after changes?', (SELECT id FROM research_framework WHERE slug = 'existing-centre-growth')),
  ('growth-experimentation', 'Growth Experimentation', 50, 'What should we test first?', (SELECT id FROM research_framework WHERE slug = 'existing-centre-growth')),
  ('dashboard-kpi', 'Dashboard/KPI', 51, 'Are changes working?', (SELECT id FROM research_framework WHERE slug = 'existing-centre-growth')),
  ('continuous-improvement', 'Continuous Improvement', 52, 'What do we change next?', (SELECT id FROM research_framework WHERE slug = 'existing-centre-growth'))
ON CONFLICT (slug) DO NOTHING;

INSERT INTO research_topic_tab (topic_id, tab_key, tab_label, content, sort_order)
SELECT t.id, x.tab_key, x.tab_label, x.content, x.sort_order
FROM research_topic t
JOIN (VALUES
  ('current-business-baseline', 'process', 'Process', 'Where are we today?', 1),
  ('current-business-baseline', 'input',   'Input',   'Customers, classes, revenue, cost', 2),
  ('current-business-baseline', 'output',  'Output',  'AS-IS baseline', 3),
  ('market-potential', 'process', 'Process', 'Is sufficient demand available?', 1),
  ('market-potential', 'input',   'Input',   'Population, target segments, yoga demand', 2),
  ('market-potential', 'output',  'Output',  'Market opportunity', 3),
  ('market-penetration', 'process', 'Process', 'How much market have we captured?', 1),
  ('market-penetration', 'input',   'Input',   'Customers ÷ addressable market', 2),
  ('market-penetration', 'output',  'Output',  'Penetration %', 3),
  ('customer-database-analysis', 'process', 'Process', 'Who actually comes?', 1),
  ('customer-database-analysis', 'input',   'Input',   'Age, location, frequency, plan', 2),
  ('customer-database-analysis', 'output',  'Output',  'Customer profile', 3),
  ('active-customer-analysis', 'process', 'Process', 'Who is currently engaged?', 1),
  ('active-customer-analysis', 'input',   'Input',   'Active 30/60/90-day customers', 2),
  ('active-customer-analysis', 'output',  'Output',  'Active base', 3),
  ('inactive-customer-analysis', 'process', 'Process', 'Who stopped coming?', 1),
  ('inactive-customer-analysis', 'input',   'Input',   'Last visit, previous frequency', 2),
  ('inactive-customer-analysis', 'output',  'Output',  'Win-back pool', 3),
  ('lost-customer-research', 'process', 'Process', 'Why did they leave?', 1),
  ('lost-customer-research', 'input',   'Input',   'Price, timing, quality, location, instructor', 2),
  ('lost-customer-research', 'output',  'Output',  'Churn reasons', 3),
  ('non-customer-research', 'process', 'Process', 'Why don''t prospects join?', 1),
  ('non-customer-research', 'input',   'Input',   'Awareness, trust, price, schedule', 2),
  ('non-customer-research', 'output',  'Output',  'Acquisition barriers', 3),
  ('lead-analysis', 'process', 'Process', 'Are inquiries converting?', 1),
  ('lead-analysis', 'input',   'Input',   'Leads, source, response', 2),
  ('lead-analysis', 'output',  'Output',  'Lead quality', 3),
  ('lead-to-trial-conversion', 'process', 'Process', 'Are leads trying?', 1),
  ('lead-to-trial-conversion', 'input',   'Input',   'Trial bookings / leads', 2),
  ('lead-to-trial-conversion', 'output',  'Output',  'Conversion %', 3),
  ('trial-to-paid-conversion', 'process', 'Process', 'Do trials become customers?', 1),
  ('trial-to-paid-conversion', 'input',   'Input',   'Paid / trial customers', 2),
  ('trial-to-paid-conversion', 'output',  'Output',  'Conversion %', 3),
  ('retention-analysis', 'process', 'Process', 'Do customers stay?', 1),
  ('retention-analysis', 'input',   'Input',   '30/60/90/180-day retention', 2),
  ('retention-analysis', 'output',  'Output',  'Retention rate', 3),
  ('churn-analysis', 'process', 'Process', 'How many leave?', 1),
  ('churn-analysis', 'input',   'Input',   'Cancellations/inactivity', 2),
  ('churn-analysis', 'output',  'Output',  'Churn rate', 3),
  ('attendance-analysis', 'process', 'Process', 'Which classes work?', 1),
  ('attendance-analysis', 'input',   'Input',   'Attendance by class/day/time', 2),
  ('attendance-analysis', 'output',  'Output',  'Schedule optimization', 3),
  ('capacity-analysis', 'process', 'Process', 'Are classes underused?', 1),
  ('capacity-analysis', 'input',   'Input',   'Seats available vs occupied', 2),
  ('capacity-analysis', 'output',  'Output',  'Utilization %', 3),
  ('instructor-analysis', 'process', 'Process', 'Does instructor affect demand?', 1),
  ('instructor-analysis', 'input',   'Input',   'Attendance/retention by instructor', 2),
  ('instructor-analysis', 'output',  'Output',  'Instructor score', 3),
  ('schedule-research', 'process', 'Process', 'Are times wrong?', 1),
  ('schedule-research', 'input',   'Input',   'Morning/evening/weekend demand', 2),
  ('schedule-research', 'output',  'Output',  'New timetable', 3),
  ('service-analysis', 'process', 'Process', 'Are we offering the right yoga?', 1),
  ('service-analysis', 'input',   'Input',   'Demand/service/class utilization', 2),
  ('service-analysis', 'output',  'Output',  'Portfolio optimization', 3),
  ('new-service-research', 'process', 'Process', 'What else could customers buy?', 1),
  ('new-service-research', 'input',   'Input',   'Meditation, kids, seniors etc.', 2),
  ('new-service-research', 'output',  'Output',  'Expansion opportunities', 3),
  ('pricing-research-growth', 'process', 'Process', 'Is price helping/hurting?', 1),
  ('pricing-research-growth', 'input',   'Input',   'Competitors + willingness-to-pay', 2),
  ('pricing-research-growth', 'output',  'Output',  'Price architecture', 3),
  ('package-analysis', 'process', 'Process', 'Are packages appropriate?', 1),
  ('package-analysis', 'input',   'Input',   'Drop-in/package/membership sales', 2),
  ('package-analysis', 'output',  'Output',  'Package redesign', 3),
  ('competitor-analysis-growth', 'process', 'Process', 'Why are people choosing others?', 1),
  ('competitor-analysis-growth', 'input',   'Input',   'Price, schedule, reviews, experience', 2),
  ('competitor-analysis-growth', 'output',  'Output',  'Competitive gaps', 3),
  ('customer-experience', 'process', 'Process', 'What happens from discovery onward?', 1),
  ('customer-experience', 'input',   'Input',   'Friction at every touchpoint', 2),
  ('customer-experience', 'output',  'Output',  'CX improvement', 3),
  ('satisfaction', 'process', 'Process', 'Are customers happy?', 1),
  ('satisfaction', 'input',   'Input',   'CSAT', 2),
  ('satisfaction', 'output',  'Output',  'Satisfaction score', 3),
  ('nps', 'process', 'Process', 'Will they recommend?', 1),
  ('nps', 'input',   'Input',   'Promoters/passives/detractors', 2),
  ('nps', 'output',  'Output',  'NPS', 3),
  ('review-sentiment-analysis', 'process', 'Process', 'What are people saying?', 1),
  ('review-sentiment-analysis', 'input',   'Input',   'Reviews/comments/themes', 2),
  ('review-sentiment-analysis', 'output',  'Output',  'Sentiment', 3),
  ('brand-awareness', 'process', 'Process', 'Does the local market know you?', 1),
  ('brand-awareness', 'input',   'Input',   'Awareness/recall', 2),
  ('brand-awareness', 'output',  'Output',  'Brand score', 3),
  ('website-analysis', 'process', 'Process', 'Is the website converting?', 1),
  ('website-analysis', 'input',   'Input',   'Visitors, booking clicks, conversion', 2),
  ('website-analysis', 'output',  'Output',  'Web funnel', 3),
  ('google-maps-analysis', 'process', 'Process', 'Can customers find you?', 1),
  ('google-maps-analysis', 'input',   'Input',   'Search visibility, reviews, actions', 2),
  ('google-maps-analysis', 'output',  'Output',  'Local visibility', 3),
  ('social-media-analysis', 'process', 'Process', 'Does content create customers?', 1),
  ('social-media-analysis', 'input',   'Input',   'Reach → leads → trials → paid', 2),
  ('social-media-analysis', 'output',  'Output',  'Social ROI', 3),
  ('marketing-channel-analysis', 'process', 'Process', 'Which channel works?', 1),
  ('marketing-channel-analysis', 'input',   'Input',   'Leads/customers by source', 2),
  ('marketing-channel-analysis', 'output',  'Output',  'Channel ROI', 3),
  ('cac', 'process', 'Process', 'What does one customer cost?', 1),
  ('cac', 'input',   'Input',   'Marketing ÷ acquired customers', 2),
  ('cac', 'output',  'Output',  'CAC', 3),
  ('referral-analysis', 'process', 'Process', 'Are customers bringing others?', 1),
  ('referral-analysis', 'input',   'Input',   'Referral leads/conversions', 2),
  ('referral-analysis', 'output',  'Output',  'Referral rate', 3),
  ('loyalty-research', 'process', 'Process', 'Can customers become advocates?', 1),
  ('loyalty-research', 'input',   'Input',   'Frequency, milestones, rewards', 2),
  ('loyalty-research', 'output',  'Output',  'Loyalty model', 3),
  ('community-research', 'process', 'Process', 'Can local partnerships grow reach?', 1),
  ('community-research', 'input',   'Input',   'Schools/businesses/communities', 2),
  ('community-research', 'output',  'Output',  'Partnership pipeline', 3),
  ('corporate-yoga', 'process', 'Process', 'Can B2B increase revenue?', 1),
  ('corporate-yoga', 'input',   'Input',   'Companies, HR demand, contracts', 2),
  ('corporate-yoga', 'output',  'Output',  'Corporate pipeline', 3),
  ('kids-family-market', 'process', 'Process', 'Is there family demand?', 1),
  ('kids-family-market', 'input',   'Input',   'Parents, children, schedules', 2),
  ('kids-family-market', 'output',  'Output',  'New segment', 3),
  ('senior-market', 'process', 'Process', 'Is there older-adult demand?', 1),
  ('senior-market', 'input',   'Input',   'Gentle/chair yoga demand', 2),
  ('senior-market', 'output',  'Output',  'Senior program', 3),
  ('online-yoga', 'process', 'Process', 'Can geography be removed?', 1),
  ('online-yoga', 'input',   'Input',   'Online interest', 2),
  ('online-yoga', 'output',  'Output',  'Digital market', 3),
  ('hybrid-yoga', 'process', 'Process', 'Do customers want both?', 1),
  ('hybrid-yoga', 'input',   'Input',   'Online + physical preference', 2),
  ('hybrid-yoga', 'output',  'Output',  'Hybrid model', 3),
  ('private-classes', 'process', 'Process', 'Premium opportunity?', 1),
  ('private-classes', 'input',   'Input',   '1:1 demand/price', 2),
  ('private-classes', 'output',  'Output',  'Premium revenue', 3),
  ('workshops-events', 'process', 'Process', 'Additional revenue?', 1),
  ('workshops-events', 'input',   'Input',   'Demand/attendance', 2),
  ('workshops-events', 'output',  'Output',  'Event revenue', 3),
  ('cross-sell-analysis', 'process', 'Process', 'What else can customers buy?', 1),
  ('cross-sell-analysis', 'input',   'Input',   'Yoga → meditation etc.', 2),
  ('cross-sell-analysis', 'output',  'Output',  'ARPU growth', 3),
  ('revenue-per-customer', 'process', 'Process', 'Are customers spending enough?', 1),
  ('revenue-per-customer', 'input',   'Input',   'Revenue ÷ customers', 2),
  ('revenue-per-customer', 'output',  'Output',  'ARPU', 3),
  ('customer-lifetime-value', 'process', 'Process', 'What is each customer worth?', 1),
  ('customer-lifetime-value', 'input',   'Input',   'ARPU × lifetime', 2),
  ('customer-lifetime-value', 'output',  'Output',  'CLV', 3),
  ('revenue-leakage', 'process', 'Process', 'Where is money being lost?', 1),
  ('revenue-leakage', 'input',   'Input',   'Empty seats, churn, discounts', 2),
  ('revenue-leakage', 'output',  'Output',  'Leakage value', 3),
  ('cost-analysis', 'process', 'Process', 'Where can cost improve?', 1),
  ('cost-analysis', 'input',   'Input',   'Rent, instructors, marketing', 2),
  ('cost-analysis', 'output',  'Output',  'Cost optimization', 3),
  ('profitability-by-service', 'process', 'Process', 'Which services make money?', 1),
  ('profitability-by-service', 'input',   'Input',   'Revenue − direct cost', 2),
  ('profitability-by-service', 'output',  'Output',  'Contribution margin', 3),
  ('forecasting-growth', 'process', 'Process', 'What happens after changes?', 1),
  ('forecasting-growth', 'input',   'Input',   'Customers/revenue/cost', 2),
  ('forecasting-growth', 'output',  'Output',  '12/36-month forecast', 3),
  ('growth-experimentation', 'process', 'Process', 'What should we test first?', 1),
  ('growth-experimentation', 'input',   'Input',   'Offer/time/price/channel', 2),
  ('growth-experimentation', 'output',  'Output',  'Experiment backlog', 3),
  ('dashboard-kpi', 'process', 'Process', 'Are changes working?', 1),
  ('dashboard-kpi', 'input',   'Input',   'Weekly/monthly metrics', 2),
  ('dashboard-kpi', 'output',  'Output',  'Management dashboard', 3),
  ('continuous-improvement', 'process', 'Process', 'What do we change next?', 1),
  ('continuous-improvement', 'input',   'Input',   'Actual vs target', 2),
  ('continuous-improvement', 'output',  'Output',  'Growth loop', 3)
) AS x(slug, tab_key, tab_label, content, sort_order)
  ON x.slug = t.slug
ON CONFLICT (topic_id, tab_key) DO NOTHING;

-- ─────────────────────────────────────────────
-- Wire the one proof-of-concept automated topic: MarketResearchPricingDigestJob
-- refreshes the 17-layer 'pricing' topic's output tab weekly (Monday 08:00
-- UTC) with a real live pricing snapshot + Ollama advisory sentence. Every
-- other topic (88 of 89) keeps job_name NULL — "Not yet automated" is the
-- honest state for all of them.
-- ─────────────────────────────────────────────

UPDATE research_topic SET job_name = 'market-research-pricing-digest'
WHERE slug = 'pricing' AND job_name IS NULL;
