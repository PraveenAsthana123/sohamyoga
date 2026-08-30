-- ============================================================
-- Real, phase-specific B2B/B2C checklist templates — 17 phases x 2
-- business models = 34 rows. Every item is grounded directly in that
-- phase's own seeded process_reference/input_reference/output_reference
-- text from seed-phases.sql (e.g. "Competitors" phase process_reference
-- is "50-100 centres", input_reference "Price/services/reviews", output
-- "Competitive position" -> items about identifying competitors,
-- collecting price/service/review data, and finding competitive gaps).
-- These are ADDED to (not a replacement for) the 4 generic workflow-gate
-- items PipelineService.seedFieldsForPhase() already writes.
-- ============================================================

-- ── 1. Population ──
INSERT INTO phase_checklist_template (phase_id, business_model, items)
VALUES (
  (SELECT id FROM phase WHERE slug = 'population'), 'b2c',
  '[
    {"text": "Pull latest Calgary/Alberta population and household counts from Statistics Canada census data"},
    {"text": "Break down population by age band (18-24, 25-34, 35-54, 55+) relevant to consumer service adoption"},
    {"text": "Calculate addressable population within a realistic service radius (e.g. 5-10km) of the target location"},
    {"text": "Check population growth trend over the last 5 years to gauge market trajectory"},
    {"text": "Segment household counts by household size/type (singles, families) relevant to consumer demand"}
  ]'::jsonb
) ON CONFLICT (phase_id, business_model) DO UPDATE SET items = EXCLUDED.items, updated_at = now();

INSERT INTO phase_checklist_template (phase_id, business_model, items)
VALUES (
  (SELECT id FROM phase WHERE slug = 'population'), 'b2b',
  '[
    {"text": "Pull the count of registered businesses in Calgary/Alberta within the target industry (NAICS/SIC lookup)"},
    {"text": "Break down the business population by employee-count band (micro, small, mid, enterprise)"},
    {"text": "Calculate addressable business population within the target service territory"},
    {"text": "Check business formation/closure trend over the last 5 years (Statistics Canada business register)"},
    {"text": "Segment businesses by industry vertical relevant to procurement of this service"}
  ]'::jsonb
) ON CONFLICT (phase_id, business_model) DO UPDATE SET items = EXCLUDED.items, updated_at = now();

-- ── 2. Customer segments ──
INSERT INTO phase_checklist_template (phase_id, business_model, items)
VALUES (
  (SELECT id FROM phase WHERE slug = 'customer-segments'), 'b2c',
  '[
    {"text": "Estimate the size of each consumer segment (women, men, couples, seniors, professionals, tourists) in the target geography"},
    {"text": "Profile each segment: age, income band, lifestyle, typical visit frequency"},
    {"text": "Survey or desk-research each segment stated interest/need for the service"},
    {"text": "Rank segments by size x propensity-to-buy to identify the best target segment"},
    {"text": "Document the selection rationale for the chosen segment over the others"}
  ]'::jsonb
) ON CONFLICT (phase_id, business_model) DO UPDATE SET items = EXCLUDED.items, updated_at = now();

INSERT INTO phase_checklist_template (phase_id, business_model, items)
VALUES (
  (SELECT id FROM phase WHERE slug = 'customer-segments'), 'b2b',
  '[
    {"text": "Identify buyer-side company segments (corporate wellness, hospitality, healthcare, education) that could purchase this service"},
    {"text": "Estimate the number of target companies per segment and typical employee count purchasing on their behalf"},
    {"text": "Identify the procurement/decision-making role within each segment (HR, facilities, benefits manager)"},
    {"text": "Rank segments by contract-size potential x likelihood-to-buy to identify the best target segment"},
    {"text": "Document the selection rationale for the chosen B2B segment (deal size, sales-cycle length, renewal likelihood)"}
  ]'::jsonb
) ON CONFLICT (phase_id, business_model) DO UPDATE SET items = EXCLUDED.items, updated_at = now();

-- ── 3. Income ──
INSERT INTO phase_checklist_template (phase_id, business_model, items)
VALUES (
  (SELECT id FROM phase WHERE slug = 'income'), 'b2c',
  '[
    {"text": "Pull median/average household disposable income for the target geography (Statistics Canada income data)"},
    {"text": "Segment the population into income bands (e.g. <$50k, $50-100k, $100-150k, $150k+)"},
    {"text": "Estimate what % of the target segment falls into each income band"},
    {"text": "Compare income bands against comparable services pricing to decide premium vs value positioning"},
    {"text": "Cross-check the regional cost-of-living index to sanity-check the disposable-income estimate"}
  ]'::jsonb
) ON CONFLICT (phase_id, business_model) DO UPDATE SET items = EXCLUDED.items, updated_at = now();

INSERT INTO phase_checklist_template (phase_id, business_model, items)
VALUES (
  (SELECT id FROM phase WHERE slug = 'income'), 'b2b',
  '[
    {"text": "Pull average revenue-per-employee or annual wellness/procurement budget for target company sizes"},
    {"text": "Segment target companies by budget band (spend per employee per year)"},
    {"text": "Estimate what % of target companies fall into each budget band"},
    {"text": "Compare budget bands against comparable B2B contract values to decide premium vs value positioning"},
    {"text": "Identify whether procurement typically comes from a discretionary budget or a fixed line-item budget"}
  ]'::jsonb
) ON CONFLICT (phase_id, business_model) DO UPDATE SET items = EXCLUDED.items, updated_at = now();

-- ── 4. Geography ──
INSERT INTO phase_checklist_template (phase_id, business_model, items)
VALUES (
  (SELECT id FROM phase WHERE slug = 'geography'), 'b2c',
  '[
    {"text": "Map population density by quadrant (NW/NE/SW/SE/downtown) for the target city"},
    {"text": "Overlay existing competitor locations onto each quadrant"},
    {"text": "Calculate population-per-competitor ratio for each quadrant to find under-served areas"},
    {"text": "Identify quadrants with favorable foot-traffic/commute patterns for the target consumer segment"},
    {"text": "Rank quadrants by combined population opportunity minus competitive saturation"}
  ]'::jsonb
) ON CONFLICT (phase_id, business_model) DO UPDATE SET items = EXCLUDED.items, updated_at = now();

INSERT INTO phase_checklist_template (phase_id, business_model, items)
VALUES (
  (SELECT id FROM phase WHERE slug = 'geography'), 'b2b',
  '[
    {"text": "Map target-industry business density by quadrant/business park/industrial zone"},
    {"text": "Overlay existing competitor client locations or competitor offices onto each zone"},
    {"text": "Calculate target-business-count-per-competitor ratio for each zone"},
    {"text": "Identify zones with proximity to key business districts, transit, or client concentration"},
    {"text": "Rank zones by B2B opportunity minus competitive saturation"}
  ]'::jsonb
) ON CONFLICT (phase_id, business_model) DO UPDATE SET items = EXCLUDED.items, updated_at = now();

-- ── 5. Demand ──
INSERT INTO phase_checklist_template (phase_id, business_model, items)
VALUES (
  (SELECT id FROM phase WHERE slug = 'demand'), 'b2c',
  '[
    {"text": "Pull Google Trends / search-volume data for each service line (massage, facial, sauna, steam, etc.) in the target geography"},
    {"text": "Run or source a consumer survey on stated interest/frequency-of-use for each service line"},
    {"text": "Pull actual booking-volume data (own or comparable) for each service line if available"},
    {"text": "Combine search + survey + booking signals into a weighted demand index per service line"},
    {"text": "Identify seasonality patterns in demand (holiday, weather-driven spikes)"}
  ]'::jsonb
) ON CONFLICT (phase_id, business_model) DO UPDATE SET items = EXCLUDED.items, updated_at = now();

INSERT INTO phase_checklist_template (phase_id, business_model, items)
VALUES (
  (SELECT id FROM phase WHERE slug = 'demand'), 'b2b',
  '[
    {"text": "Pull search-volume/RFP-frequency data for corporate wellness/spa-partnership services in the target geography"},
    {"text": "Run or source a survey of HR/benefits managers on stated interest in offering this service to employees"},
    {"text": "Pull actual contract/inquiry volume data (own or comparable) for B2B service bundles if available"},
    {"text": "Combine search + survey + inquiry signals into a weighted B2B demand index"},
    {"text": "Identify seasonality patterns in B2B demand (benefits open-enrollment cycles, budget-year timing)"}
  ]'::jsonb
) ON CONFLICT (phase_id, business_model) DO UPDATE SET items = EXCLUDED.items, updated_at = now();

-- ── 6. Supply ──
INSERT INTO phase_checklist_template (phase_id, business_model, items)
VALUES (
  (SELECT id FROM phase WHERE slug = 'supply'), 'b2c',
  '[
    {"text": "Count directly competing consumer-facing spas/studios in the target geography"},
    {"text": "Record each competitor number of locations and estimated treatment-room/session capacity"},
    {"text": "Calculate total market capacity (rooms x hours x competitors) as a supply index"},
    {"text": "Identify any recent openings/closures affecting current supply"},
    {"text": "Compare the supply index against the demand index to spot under- or over-supplied areas"}
  ]'::jsonb
) ON CONFLICT (phase_id, business_model) DO UPDATE SET items = EXCLUDED.items, updated_at = now();

INSERT INTO phase_checklist_template (phase_id, business_model, items)
VALUES (
  (SELECT id FROM phase WHERE slug = 'supply'), 'b2b',
  '[
    {"text": "Count competing B2B/corporate-wellness service providers serving the target geography"},
    {"text": "Record each competitor client capacity (number of contracted companies/employees served)"},
    {"text": "Calculate total market capacity (contracted employee-seats x competitors) as a supply index"},
    {"text": "Identify any recent market entrants/exits in the B2B corporate-wellness space"},
    {"text": "Compare the B2B supply index against the B2B demand index to spot under- or over-supplied segments"}
  ]'::jsonb
) ON CONFLICT (phase_id, business_model) DO UPDATE SET items = EXCLUDED.items, updated_at = now();

-- ── 7. Competitors ──
INSERT INTO phase_checklist_template (phase_id, business_model, items)
VALUES (
  (SELECT id FROM phase WHERE slug = 'competitors'), 'b2c',
  '[
    {"text": "Identify the top 10 direct competitor consumer-facing centres in the target geography"},
    {"text": "Collect published pricing for comparable services across each competitor"},
    {"text": "Collect public review ratings/volume per competitor (Google/Yelp)"},
    {"text": "Document each competitor service/menu breadth"},
    {"text": "Identify competitive gaps/whitespace (services or price points nobody currently offers)"}
  ]'::jsonb
) ON CONFLICT (phase_id, business_model) DO UPDATE SET items = EXCLUDED.items, updated_at = now();

INSERT INTO phase_checklist_template (phase_id, business_model, items)
VALUES (
  (SELECT id FROM phase WHERE slug = 'competitors'), 'b2b',
  '[
    {"text": "Identify the top 10 direct competitor B2B/corporate-wellness providers serving the target geography"},
    {"text": "Collect published or quoted contract pricing structures (per-employee/per-visit/flat-fee) across each competitor"},
    {"text": "Collect public case studies, client logos, and testimonials per competitor"},
    {"text": "Document each competitor service-bundle breadth (on-site, off-site, virtual) and contract terms"},
    {"text": "Identify competitive gaps/whitespace in the B2B offering (verticals or contract structures nobody currently serves)"}
  ]'::jsonb
) ON CONFLICT (phase_id, business_model) DO UPDATE SET items = EXCLUDED.items, updated_at = now();

-- ── 8. Pricing ──
INSERT INTO phase_checklist_template (phase_id, business_model, items)
VALUES (
  (SELECT id FROM phase WHERE slug = 'pricing'), 'b2c',
  '[
    {"text": "Collect published menu prices for each service line across identified competitors"},
    {"text": "Calculate average/min/max price per service line in the target geography"},
    {"text": "Test price sensitivity via survey or willingness-to-pay questions with the target segment"},
    {"text": "Benchmark proposed pricing against the income-band analysis (premium vs value positioning)"},
    {"text": "Document a recommended price list per service line with rationale"}
  ]'::jsonb
) ON CONFLICT (phase_id, business_model) DO UPDATE SET items = EXCLUDED.items, updated_at = now();

INSERT INTO phase_checklist_template (phase_id, business_model, items)
VALUES (
  (SELECT id FROM phase WHERE slug = 'pricing'), 'b2b',
  '[
    {"text": "Collect published or quoted per-employee/per-seat/flat-fee contract pricing across competitors"},
    {"text": "Calculate average/min/max contract value per company-size tier in the target geography"},
    {"text": "Test price sensitivity via conversations with target-segment procurement/HR contacts"},
    {"text": "Benchmark proposed contract pricing against the budget-band analysis"},
    {"text": "Document a recommended contract pricing structure (tiered/per-seat/flat) with rationale"}
  ]'::jsonb
) ON CONFLICT (phase_id, business_model) DO UPDATE SET items = EXCLUDED.items, updated_at = now();

-- ── 9. Utilization ──
INSERT INTO phase_checklist_template (phase_id, business_model, items)
VALUES (
  (SELECT id FROM phase WHERE slug = 'utilization'), 'b2c',
  '[
    {"text": "Estimate available treatment-room-hours per week for the target facility concept"},
    {"text": "Pull or estimate current occupancy % from comparable operators"},
    {"text": "Calculate bookings-per-week implied by the target occupancy"},
    {"text": "Identify peak vs off-peak utilization patterns (day-of-week, time-of-day)"},
    {"text": "Translate the demand forecast into a required room/staff capacity plan"}
  ]'::jsonb
) ON CONFLICT (phase_id, business_model) DO UPDATE SET items = EXCLUDED.items, updated_at = now();

INSERT INTO phase_checklist_template (phase_id, business_model, items)
VALUES (
  (SELECT id FROM phase WHERE slug = 'utilization'), 'b2b',
  '[
    {"text": "Estimate available service-delivery capacity (practitioner-hours, on-site visit slots) per week"},
    {"text": "Pull or estimate current utilization % from comparable B2B contracts"},
    {"text": "Calculate contracted-employee-visits-per-week implied by the target utilization"},
    {"text": "Identify peak vs off-peak utilization patterns (benefits enrollment periods, workday scheduling)"},
    {"text": "Translate the B2B demand forecast into a required staffing/capacity plan for contracted accounts"}
  ]'::jsonb
) ON CONFLICT (phase_id, business_model) DO UPDATE SET items = EXCLUDED.items, updated_at = now();

-- ── 10. Revenue ──
INSERT INTO phase_checklist_template (phase_id, business_model, items)
VALUES (
  (SELECT id FROM phase WHERE slug = 'revenue'), 'b2c',
  '[
    {"text": "Estimate target customer count from the Demand and Utilization phase findings"},
    {"text": "Estimate average visits-per-customer-per-year from comparable operators or survey data"},
    {"text": "Estimate average spend-per-visit from the Pricing phase findings"},
    {"text": "Multiply customers x visits x spend to build a bottom-up revenue forecast"},
    {"text": "Sanity-check the forecast against comparable operators published/estimated revenue"}
  ]'::jsonb
) ON CONFLICT (phase_id, business_model) DO UPDATE SET items = EXCLUDED.items, updated_at = now();

INSERT INTO phase_checklist_template (phase_id, business_model, items)
VALUES (
  (SELECT id FROM phase WHERE slug = 'revenue'), 'b2b',
  '[
    {"text": "Estimate target contracted-company count and average contracted-employee count per company"},
    {"text": "Estimate average utilization/visits-per-employee-per-year from comparable B2B contracts"},
    {"text": "Estimate average contract value per employee or per company from the Pricing phase findings"},
    {"text": "Multiply companies x employees x contract-value to build a bottom-up B2B revenue forecast"},
    {"text": "Sanity-check the forecast against comparable B2B providers published/estimated revenue"}
  ]'::jsonb
) ON CONFLICT (phase_id, business_model) DO UPDATE SET items = EXCLUDED.items, updated_at = now();

-- ── 11. Membership ──
INSERT INTO phase_checklist_template (phase_id, business_model, items)
VALUES (
  (SELECT id FROM phase WHERE slug = 'membership'), 'b2c',
  '[
    {"text": "Design candidate monthly membership plan tiers (basic/premium visit allowances)"},
    {"text": "Estimate trial-to-membership conversion rate from comparable operators or survey intent data"},
    {"text": "Estimate expected monthly churn rate for each membership tier"},
    {"text": "Model recurring revenue: membership base size x average plan value x (1 - churn)"},
    {"text": "Identify retention levers (perks, loyalty rewards) that could reduce churn"}
  ]'::jsonb
) ON CONFLICT (phase_id, business_model) DO UPDATE SET items = EXCLUDED.items, updated_at = now();

INSERT INTO phase_checklist_template (phase_id, business_model, items)
VALUES (
  (SELECT id FROM phase WHERE slug = 'membership'), 'b2b',
  '[
    {"text": "Design candidate annual/multi-year contract tiers (per-employee-seat allowances)"},
    {"text": "Estimate proposal-to-signed-contract conversion rate from comparable B2B sales cycles"},
    {"text": "Estimate expected contract renewal/non-renewal (churn) rate at each tier"},
    {"text": "Model recurring revenue: contracted-account base x average contract value x renewal rate"},
    {"text": "Identify retention levers (account management, SLAs, multi-year discounts) that could reduce churn"}
  ]'::jsonb
) ON CONFLICT (phase_id, business_model) DO UPDATE SET items = EXCLUDED.items, updated_at = now();

-- ── 12. Corporate ──
INSERT INTO phase_checklist_template (phase_id, business_model, items)
VALUES (
  (SELECT id FROM phase WHERE slug = 'corporate'), 'b2c',
  '[
    {"text": "Identify local employers who might sponsor employee wellness benefits at your consumer-facing location"},
    {"text": "Estimate the number of employees at target-employer companies within a reasonable commute of your location"},
    {"text": "Research typical employer-sponsored wellness stipend/contract structures used by comparable consumer-facing operators"},
    {"text": "Draft a candidate corporate-partnership offer as an ancillary revenue stream alongside core consumer trade"},
    {"text": "Estimate potential ancillary corporate revenue vs the core consumer revenue projected in the Revenue phase"}
  ]'::jsonb
) ON CONFLICT (phase_id, business_model) DO UPDATE SET items = EXCLUDED.items, updated_at = now();

INSERT INTO phase_checklist_template (phase_id, business_model, items)
VALUES (
  (SELECT id FROM phase WHERE slug = 'corporate'), 'b2b',
  '[
    {"text": "Identify additional employer/company contracts within the target industry beyond the core segment sized in Customer Segments"},
    {"text": "Estimate total employees covered under existing and prospective contracts"},
    {"text": "Research contract renewal terms and expansion options within current employer accounts"},
    {"text": "Draft an account-expansion plan to upsell additional service lines to existing corporate clients"},
    {"text": "Estimate incremental corporate revenue from account expansion vs new-logo acquisition"}
  ]'::jsonb
) ON CONFLICT (phase_id, business_model) DO UPDATE SET items = EXCLUDED.items, updated_at = now();

-- ── 13. Tourism ──
INSERT INTO phase_checklist_template (phase_id, business_model, items)
VALUES (
  (SELECT id FROM phase WHERE slug = 'tourism'), 'b2c',
  '[
    {"text": "Pull annual visitor/hotel-guest volume for the target geography (tourism board data)"},
    {"text": "Estimate average tourist wellness/spa spend per trip from tourism-industry benchmarks"},
    {"text": "Identify nearby hotels/attractions with concierge or partnership potential"},
    {"text": "Estimate addressable tourist revenue opportunity (visitors x spa-visit rate x average spend)"},
    {"text": "Assess seasonality of tourist volume against planned capacity"}
  ]'::jsonb
) ON CONFLICT (phase_id, business_model) DO UPDATE SET items = EXCLUDED.items, updated_at = now();

INSERT INTO phase_checklist_template (phase_id, business_model, items)
VALUES (
  (SELECT id FROM phase WHERE slug = 'tourism'), 'b2b',
  '[
    {"text": "Identify hotel/hospitality operators in the target geography who could be B2B wellness-service clients (in-house spa staffing/outsourcing)"},
    {"text": "Estimate the number of hotel rooms/properties that could be served under a B2B hospitality contract"},
    {"text": "Research typical hotel wellness-outsourcing contract structures and rates"},
    {"text": "Estimate addressable B2B hospitality-contract revenue opportunity"},
    {"text": "Assess seasonality of hotel occupancy against contract staffing requirements"}
  ]'::jsonb
) ON CONFLICT (phase_id, business_model) DO UPDATE SET items = EXCLUDED.items, updated_at = now();

-- ── 14. Reviews ──
INSERT INTO phase_checklist_template (phase_id, business_model, items)
VALUES (
  (SELECT id FROM phase WHERE slug = 'reviews'), 'b2c',
  '[
    {"text": "Collect Google/Yelp/social review text and star ratings for own and competitor consumer locations"},
    {"text": "Calculate a sentiment score / NPS-equivalent from review text"},
    {"text": "Identify the most frequently mentioned complaint themes (wait times, cleanliness, staff)"},
    {"text": "Identify the most frequently praised themes to reinforce in marketing"},
    {"text": "Translate top themes into a concrete product/service improvement list"}
  ]'::jsonb
) ON CONFLICT (phase_id, business_model) DO UPDATE SET items = EXCLUDED.items, updated_at = now();

INSERT INTO phase_checklist_template (phase_id, business_model, items)
VALUES (
  (SELECT id FROM phase WHERE slug = 'reviews'), 'b2b',
  '[
    {"text": "Collect client testimonials, case-study feedback, and contract-renewal survey results"},
    {"text": "Calculate a client-satisfaction/NPS score from available B2B feedback sources"},
    {"text": "Identify the most frequently mentioned account-management or service-delivery complaint themes"},
    {"text": "Identify the most frequently praised themes to reinforce in sales/account-management materials"},
    {"text": "Translate top themes into a concrete account-management/service-delivery improvement list"}
  ]'::jsonb
) ON CONFLICT (phase_id, business_model) DO UPDATE SET items = EXCLUDED.items, updated_at = now();

-- ── 15. Trends ──
INSERT INTO phase_checklist_template (phase_id, business_model, items)
VALUES (
  (SELECT id FROM phase WHERE slug = 'trends'), 'b2c',
  '[
    {"text": "Scan industry publications/search-trend data for emerging consumer wellness formats (cold plunge, infrared, float therapy)"},
    {"text": "Estimate search-volume growth rate for each emerging format in the target geography"},
    {"text": "Identify which emerging formats have already been adopted by comparable operators"},
    {"text": "Assess capital/space requirements to add each emerging format to the existing facility"},
    {"text": "Rank emerging formats by growth signal x feasibility to identify the top opportunity"}
  ]'::jsonb
) ON CONFLICT (phase_id, business_model) DO UPDATE SET items = EXCLUDED.items, updated_at = now();

INSERT INTO phase_checklist_template (phase_id, business_model, items)
VALUES (
  (SELECT id FROM phase WHERE slug = 'trends'), 'b2b',
  '[
    {"text": "Scan industry publications/search-trend data for emerging corporate-wellness benefit trends (mental-health stipends, on-site recovery rooms)"},
    {"text": "Estimate growth in employer RFP/procurement activity for each emerging benefit format"},
    {"text": "Identify which emerging formats have already been adopted by comparable B2B providers"},
    {"text": "Assess delivery/staffing requirements to add each emerging format to the existing service catalog"},
    {"text": "Rank emerging formats by growth signal x feasibility to identify the top B2B opportunity"}
  ]'::jsonb
) ON CONFLICT (phase_id, business_model) DO UPDATE SET items = EXCLUDED.items, updated_at = now();

-- ── 16. Expansion ──
INSERT INTO phase_checklist_template (phase_id, business_model, items)
VALUES (
  (SELECT id FROM phase WHERE slug = 'expansion'), 'b2c',
  '[
    {"text": "Define candidate new consumer service lines based on the Trends and Demand phase findings"},
    {"text": "Estimate Total Addressable Market (TAM) for each candidate service in the target geography"},
    {"text": "Estimate Serviceable Addressable Market (SAM) based on realistic reach/location constraints"},
    {"text": "Estimate Serviceable Obtainable Market (SOM) based on realistic market-share capture"},
    {"text": "Sequence candidate services into a prioritized product roadmap"}
  ]'::jsonb
) ON CONFLICT (phase_id, business_model) DO UPDATE SET items = EXCLUDED.items, updated_at = now();

INSERT INTO phase_checklist_template (phase_id, business_model, items)
VALUES (
  (SELECT id FROM phase WHERE slug = 'expansion'), 'b2b',
  '[
    {"text": "Define candidate new B2B service/contract offerings based on the Trends and Demand phase findings"},
    {"text": "Estimate Total Addressable Market (TAM) of target companies for each candidate offering"},
    {"text": "Estimate Serviceable Addressable Market (SAM) based on realistic sales-team reach/territory"},
    {"text": "Estimate Serviceable Obtainable Market (SOM) based on realistic win-rate and sales-cycle capacity"},
    {"text": "Sequence candidate offerings into a prioritized product roadmap"}
  ]'::jsonb
) ON CONFLICT (phase_id, business_model) DO UPDATE SET items = EXCLUDED.items, updated_at = now();

-- ── 17. Forecasting ──
INSERT INTO phase_checklist_template (phase_id, business_model, items)
VALUES (
  (SELECT id FROM phase WHERE slug = 'forecasting'), 'b2c',
  '[
    {"text": "Build a 1/3/5-year customer-growth forecast using the Revenue and Membership phase findings"},
    {"text": "Build a 1/3/5-year revenue forecast combining core service revenue, membership recurring revenue, and ancillary corporate/tourism revenue"},
    {"text": "Build a 1/3/5-year cost forecast (rent, staffing, supplies) for the consumer-facing facility"},
    {"text": "Calculate projected margin/ROI and payback period from the combined forecast"},
    {"text": "Document the investment decision recommendation (go/no-go/scale) with supporting assumptions"}
  ]'::jsonb
) ON CONFLICT (phase_id, business_model) DO UPDATE SET items = EXCLUDED.items, updated_at = now();

INSERT INTO phase_checklist_template (phase_id, business_model, items)
VALUES (
  (SELECT id FROM phase WHERE slug = 'forecasting'), 'b2b',
  '[
    {"text": "Build a 1/3/5-year contracted-account growth forecast using the Revenue and Membership (contract-renewal) phase findings"},
    {"text": "Build a 1/3/5-year revenue forecast combining core contract revenue, expansion/upsell revenue, and hospitality/B2B tourism contract revenue"},
    {"text": "Build a 1/3/5-year cost forecast (sales team, service-delivery staffing, account management) for the B2B operation"},
    {"text": "Calculate projected margin/ROI and payback period from the combined forecast"},
    {"text": "Document the investment decision recommendation (go/no-go/scale) with supporting assumptions"}
  ]'::jsonb
) ON CONFLICT (phase_id, business_model) DO UPDATE SET items = EXCLUDED.items, updated_at = now();
