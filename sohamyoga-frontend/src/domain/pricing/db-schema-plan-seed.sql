-- Pricing Engine — real plan/price seed.
--
-- pricing_plan_master + pricing_plan_price (migration 050) had a complete,
-- real schema since Wave 8 but ZERO rows — the same "rich schema, nothing
-- built" gap found repeatedly elsewhere in this codebase. /admin/pricing
-- (src/app/admin/pricing/page.tsx) has been displaying these exact 8 plans
-- and prices as a hardcoded mock array (PLANS) the whole time, not real
-- data — this seed makes that same plan set real, so MarketResearchPricingDigestJob
-- (and, eventually, the admin/pricing page itself) has an actual live
-- snapshot to query instead of an empty table. Numbers are copied from the
-- page's own existing PLANS array, not invented fresh.

INSERT INTO pricing_plan_master (name, slug, plan_type, description, status, trial_days, trial_eligibility, created_by) VALUES
  ('Silver',           'silver',            'silver',    'Unlimited classes, video library, 2 meditation sessions/month, 10% workshop discount.', 'active', NULL, NULL, 'system-seed-085'),
  ('Gold',             'gold',              'gold',      'Priority booking, VIP seating, 25% workshop discount, 30-min teacher consult/month.', 'active', NULL, NULL, 'system-seed-085'),
  ('Platinum',         'platinum',          'platinum',  'All Gold benefits plus 50% retreat discount, nutrition consult, certificate, exclusive community.', 'active', NULL, NULL, 'system-seed-085'),
  ('Family (4 seats)', 'family-4-seats',    'family',    '4 seats, shared class credits, shared family wallet.', 'active', NULL, NULL, 'system-seed-085'),
  ('Corporate',        'corporate',         'corporate', 'Per-seat billing, HR integration, utilization reporting, consolidated invoice — billed externally via ERPNext, not a fixed monthly price.', 'active', NULL, NULL, 'system-seed-085'),
  ('Senior 60+',       'senior-60-plus',    'senior',    'Unlimited classes, 10% store discount, priority booking for members 60 and older.', 'active', NULL, NULL, 'system-seed-085'),
  ('14-Day Trial',     'trial-14-day',      'trial',     'Unlimited classes and video library access for 14 days, first-time members only.', 'active', 14, 'first_time_only', 'system-seed-085'),
  ('Drop-In',          'drop-in',           'drop_in',   'Single-class access, no membership required.', 'active', NULL, NULL, 'system-seed-085')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO pricing_plan_price (plan_id, amount, currency, billing_cycle)
SELECT m.id, x.amount, x.currency, x.billing_cycle
FROM pricing_plan_master m
JOIN (VALUES
  ('silver',         79.00,   'CAD', 'monthly'),
  ('silver',         799.00,  'CAD', 'annual'),
  ('gold',           149.00,  'CAD', 'monthly'),
  ('gold',           1499.00, 'CAD', 'annual'),
  ('platinum',       229.00,  'CAD', 'monthly'),
  ('platinum',       2299.00, 'CAD', 'annual'),
  ('family-4-seats', 299.00,  'CAD', 'monthly'),
  ('family-4-seats', 2999.00, 'CAD', 'annual'),
  ('corporate',      0.00,    'CAD', 'monthly'),
  ('senior-60-plus', 55.00,   'CAD', 'monthly'),
  ('senior-60-plus', 549.00,  'CAD', 'annual'),
  ('trial-14-day',   0.00,    'CAD', 'one_time'),
  ('drop-in',         25.00,  'CAD', 'one_time')
) AS x(slug, amount, currency, billing_cycle)
  ON x.slug = m.slug
ON CONFLICT (plan_id, currency, billing_cycle, is_promotional) DO NOTHING;
