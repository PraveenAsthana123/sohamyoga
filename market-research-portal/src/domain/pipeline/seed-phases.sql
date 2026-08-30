-- Seed the 17 static phase rows — ported verbatim from the 17-layer
-- framework already implemented in sohamyoga-frontend's research_topic /
-- research_topic_tab (confirmed via live psql query against sohamyoga's
-- own Postgres DB, framework 17-layer-forecasting, 2026-08-20) and
-- cross-checked against docs/market-research-growth-framework.md §2.
-- process_reference  <- "What to investigate" column
-- input_reference    <- "Data/KPI" column
-- output_reference   <- "Forecast or decision" column
--
-- Note: sohamyoga's live 'pricing' research_topic_tab(output) has since
-- been overwritten by MarketResearchPricingDigestJob's real weekly run
-- (a live pricing snapshot + Ollama advisory) — that is runtime output,
-- not reference/definition text, so this seed uses the original static
-- "Optimal pricing" value from the MD source table for phase.output_reference,
-- matching all 16 other phases exactly. Live pricing output is provided
-- to this portal at runtime by its own PricingCrossPortalJob instead.

INSERT INTO phase (slug, name, layer_number, process_reference, input_reference, output_reference) VALUES
  ('population',         'Population',         1,  'Calgary/Alberta population',                         'Population, households, age',        'Addressable population'),
  ('customer-segments',  'Customer segments',  2,  'Women, men, couples, seniors, professionals, tourists','Segment size',                       'Best target segment'),
  ('income',             'Income',              3,  'Disposable income',                                  'Income bands',                        'Premium vs value'),
  ('geography',          'Geography',           4,  'NW/NE/SW/SE/downtown',                                'Population + competitors',            'Location opportunity'),
  ('demand',             'Demand',              5,  'Massage, facial, sauna, steam, etc.',                 'Search/survey/bookings',               'Demand index'),
  ('supply',             'Supply',              6,  'Number of competing spas',                            'Locations/capacity',                   'Supply index'),
  ('competitors',        'Competitors',         7,  '50-100 centres',                                      'Price/services/reviews',               'Competitive position'),
  ('pricing',            'Pricing',             8,  'Service/menu pricing',                                'Avg/min/max price',                    'Optimal pricing'),
  ('utilization',        'Utilization',         9,  'Rooms x hours x bookings',                             'Occupancy %',                          'Capacity requirement'),
  ('revenue',            'Revenue',             10, 'Customers x visits x spend',                           'Revenue/customer',                     'Revenue forecast'),
  ('membership',         'Membership',          11, 'Monthly plans',                                        'Conversion/churn',                     'Recurring revenue'),
  ('corporate',          'Corporate',           12, 'Employer wellness',                                    'Contracts/employees',                  'B2B opportunity'),
  ('tourism',            'Tourism',             13, 'Visitors/hotel guests',                                'Tourist spend',                        'Destination wellness'),
  ('reviews',            'Reviews',             14, 'Google/social reviews',                                'Sentiment/NPS',                        'Product improvement'),
  ('trends',             'Trends',              15, 'New wellness formats',                                 'Growth/search signals',                'Emerging opportunity'),
  ('expansion',          'Expansion',           16, 'New services',                                         'TAM/SAM/SOM',                          'Product roadmap'),
  ('forecasting',        'Forecasting',         17, '1/3/5-year',                                           'Customers/revenue/cost',               'Investment decision')
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  layer_number = EXCLUDED.layer_number,
  process_reference = EXCLUDED.process_reference,
  input_reference = EXCLUDED.input_reference,
  output_reference = EXCLUDED.output_reference;

-- Wire the 2 real cross-portal jobs + the generic per-phase Research-AI
-- draft job into job_registry. ResearchAiDraftJob is invoked once per
-- phase per study (parameterized), not on a single fixed cron line here —
-- registered once as the module; actual scheduling is per-study on
-- Run Pipeline. Pricing/Reviews run on their own real weekly cadence,
-- mirroring sohamyoga-frontend's market-research-pricing-digest job.
INSERT INTO job_registry (name, schedule, description, module, enabled, timeout_ms) VALUES
  ('research-ai-draft', 'on-demand (per phase_run, triggered by Run Pipeline)', 'Generic Ollama research draft for one (study, phase) pair — grounded in that phase''s process/input/output reference text plus the study topic; fact-checked before being written to phase_run.output_content.', 'ResearchAiDraftJob', TRUE, 120000),
  ('pricing-cross-portal', '0 8 * * 1', 'Weekly Monday 08:00 UTC — reads sohamyoga''s real pricing_plan_master/pricing_plan_price (read-only cross-DB) into the Pricing phase''s Automatic Process output.', 'PricingCrossPortalJob', TRUE, 60000),
  ('reviews-cross-portal', '0 9 * * 1', 'Weekly Monday 09:00 UTC — attempts to read sohamyoga''s real review/sentiment tables (read-only cross-DB) into the Reviews phase''s Automatic Process output; honestly reports Not yet automated if no usable rows exist.', 'ReviewsCrossPortalJob', TRUE, 60000),
  ('operations-alert-sweep', '*/10 * * * *', 'Every 10 minutes — mandatory failure tracking sweep across marketing_production_job, marketing_event_log, voice_call, content_factory_project, job_run and the Ollama circuit breaker; upserts operations_alert rows so /operations-alerts is never stale even with nobody viewing it.', 'OperationsAlertSweepJob', TRUE, 60000),
  ('self-heal', '*/15 * * * *', 'Every 15 minutes — retries failed video_render jobs (real espeak-ng+FFmpeg re-execution, max 3 attempts, then flags for human review) and honestly relabels stuck youtube_publish/social_publish queued jobs as blocked on a missing publish integration rather than leaving them silently queued forever.', 'SelfHealJob', TRUE, 300000)
ON CONFLICT (name) DO UPDATE SET
  schedule = EXCLUDED.schedule,
  description = EXCLUDED.description,
  module = EXCLUDED.module,
  enabled = EXCLUDED.enabled,
  timeout_ms = EXCLUDED.timeout_ms;
