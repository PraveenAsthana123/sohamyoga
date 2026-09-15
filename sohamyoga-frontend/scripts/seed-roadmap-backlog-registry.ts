/**
 * Registers the real backlog derived from the 2026-09-14 ChatGPT roadmap
 * cross-check (docs/chatgpt-extracts/2026-09-14_marketing-greeting-exchange-soham-roadmap.md)
 * into the real module_registry table -- durable, queryable tracking
 * across the many sessions this backlog will take, per user instruction
 * ("setup all", real working builds only, phased). Excludes B2B/ABM
 * (this product is B2C) and a dedicated Shopify layer (real commerce
 * stack is ERPNext/MedusaJS) -- both confirmed not applicable to this
 * codebase, not silently dropped.
 * Idempotent. Run: DATABASE_URL=... npx tsx scripts/seed-roadmap-backlog-registry.ts
 */
import { Client } from 'pg';

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://sohamyoga:change-me-before-production@127.0.0.1:5437/sohamyoga';
const SOURCE_DOC = 'docs/chatgpt-extracts/2026-09-14_marketing-greeting-exchange-soham-roadmap.md';

const BACKLOG: { key: string; name: string; description: string; missing: string; priority: number }[] = [
  { key: 'evidence_ledger', name: 'Evidence Ledger', description: 'Fact/Estimate/Inference/Hypothesis/Unknown classification with source traceability -- the roadmap\'s own architectural spine; several other engines below depend on it.', missing: 'No evidence-type schema or ledger exists anywhere in src/domain today.', priority: 1 },
  { key: 'kpi_engine', name: 'KPI Engine', description: '8 explainable executive growth dimensions, each with formula-version + evidence + confidence + explanation.', missing: 'No matching domain object. Depends on evidence_ledger.', priority: 2 },
  { key: 'opportunity_engine', name: 'Opportunity & Benchmark Engine', description: 'Candidate-generation, priority scoring (impact x confidence x feasibility), top-3 opportunity selection, and a solution mapper that never recommends a non-demo-ready feature.', missing: 'No matching domain object. Depends on evidence_ledger + kpi_engine.', priority: 3 },
  { key: 'competitor_benchmark_engine', name: 'Competitor Benchmark Engine', description: 'Extends the real competitor/ price-tracking domain into full discovery (Direct/Search/Social/Aspirational), a 10-dimension benchmark, and a Competitive Opportunity Matrix.', missing: 'Existing competitor/ domain is real but scoped to price-tracking only.', priority: 4 },
  { key: 'audience_intelligence', name: 'Audience Intelligence', description: 'Segment/persona/intent/channel-affinity models feeding campaign targeting.', missing: 'No dedicated domain object found.', priority: 5 },
  { key: 'lead_scoring_nba', name: 'Explainable Lead Scoring + Next-Best-Action', description: 'Lead scoring with a visible explanation and a recommended next action, not an opaque number.', missing: 'No dedicated engine found.', priority: 6 },
  { key: 'market_research_golden_path', name: 'Market Research Golden Path + Growth Readiness Score', description: 'business -> research pipeline -> evidence classification -> ~25-30 KPIs rolled into 8 dimensions -> Growth Readiness Score -> two-tier report.', missing: 'No Growth Score / opportunity-rank concept exists. Depends on evidence_ledger + kpi_engine.', priority: 7 },
  { key: 'business_model_classifier', name: 'Business Model Classifier + Deep Diagnostic', description: '12-category business classifier, Customer Intent Model, Demand Map, Funnel Constraint Detection (Theory-of-Constraints style).', missing: 'No matching domain objects found.', priority: 8 },
  { key: 'geo_visibility_engine', name: 'GEO Visibility Engine', description: 'Observable-evidence collection for AI-answer-engine visibility -- explicitly must never fabricate an "AI ranking score".', missing: 'No file or content found anywhere.', priority: 9 },
  { key: 'cro_engine', name: 'CRO / Website Friction Engine', description: 'Conversion-readiness scoring, form/call friction audit, trust-signal engine.', missing: 'No dedicated domain (src/domain/cro does not exist).', priority: 10 },
  { key: 'unified_lead_generation', name: 'Unified Cross-Channel Lead Generation', description: 'Identity resolution + source attribution across ~10 channels into one lead record.', missing: 'Only scattered per-domain lead concepts exist today.', priority: 11 },
  { key: 'voice_ai_growth_engine', name: 'Voice AI Growth Engine', description: 'Inbound/outbound/campaign/analytics voice AI with provider abstraction and a mandatory tool-calling list (check_availability, create_booking, etc.).', missing: 'No voice-AI/telephony code exists in this app (a separate voice-agent-platform app exists but is a distinct project).', priority: 12 },
  { key: 'video_growth_engine', name: 'Video Growth Engine', description: 'research -> brief -> script -> storyboard -> generate -> variants -> publish -> attribution pipeline with cost-per-approved-creative governance.', missing: 'src/domain/video exists as a folder but the pipeline was not found.', priority: 13 },
  { key: 'presales_intelligence_engine', name: 'Agency Pre-Sales Intelligence Engine', description: 'public evidence -> business resolution -> competitor selection -> KPI engine -> opportunity detection -> confidence -> one-page growth brief.', missing: 'No matching domain objects. Depends on evidence_ledger + competitor_benchmark_engine + kpi_engine + opportunity_engine.', priority: 14 },
  { key: 'prospect_scoring_router', name: 'Prospect Scoring + Research-Depth Router', description: 'Prospect fit score plus a 3-tier research-depth router (60s scan / 5-10min diagnostic / deep diagnostic) to control research cost.', missing: 'No prospect-scoring or research-depth-tiering logic found.', priority: 15 },
  { key: 'demo_recommendation_engine', name: 'Demo Recommendation Engine', description: 'Maps a detected opportunity to the specific demo that should be shown to a specific prospect.', missing: 'No matching domain object.', priority: 16 },
  { key: 'sales_copilot', name: 'Sales Conversation Copilot + Discovery Questionnaire', description: 'Dynamic discovery questionnaire that skips questions already answered by public research; live conversation copilot.', missing: 'No matching domain object.', priority: 17 },
  { key: 'growth_scenario_simulator', name: 'Growth Scenario Simulator', description: 'Conservative/base/optimistic funnel simulation with explicit stated assumptions.', missing: 'No matching domain object.', priority: 18 },
  { key: 'demo_catalog_portal', name: 'Demo Tenant + Demo Catalog Portal', description: 'Permanent demo tenant with one-button reset, plus a catalog portal to browse available demos.', missing: 'No dedicated demo-reset domain object found.', priority: 19 },
  { key: 'vertical_pack_framework', name: 'Vertical Pack Framework', description: 'Reusable per-industry configuration (business model, journeys, KPIs, search intents, competitor model, review topics, personas, templates, compliance rules) -- one engine, many verticals.', missing: 'Confirmed absent in 4 independent searches. Codebase is hard-coded to yoga only.', priority: 20 },
  { key: 'vertical_kpi_registry', name: 'Vertical KPI Registry', description: 'Different KPI sets per industry vertical, not one universal list.', missing: 'No matching domain object. Depends on vertical_pack_framework.', priority: 21 },
  { key: 'case_study_engine', name: 'Case Study Engine + Proof Library', description: 'Converts a completed pilot into a reusable, evidence-backed case study / proof asset.', missing: 'No matching domain object.', priority: 22 },
  { key: 'golden_path_registry', name: 'Golden Path Registry', description: 'A small set of named end-to-end demo-critical flows (GP-01 Prospect Intelligence, GP-02 Lead Acquisition, etc.) each with an input/process/output/success-criteria contract.', missing: 'No matching named artifact.', priority: 23 },
  { key: 'provider_simulation_layer', name: 'Provider Simulation Layer', description: 'MOCK/SANDBOX/LIVE three-mode adapter layer so CI/demo never burns paid API calls.', missing: 'No matching artifact; real MCP-registry pattern exists per-domain but not this specific contract.', priority: 24 },
  { key: 'repo_truth_audit_tooling', name: 'Repo-Truth / README-vs-Reality Audit Tooling', description: 'Automated audit classifying every route/service/API/job as WORKING/PARTIAL/MOCKED/BROKEN/MISSING/UNKNOWN with cited evidence.', missing: 'No dedicated tooling found (module_registry captures status but not this automated audit).', priority: 25 },
  { key: 'partner_ecosystem_engine', name: 'Partner Ecosystem Engine', description: 'Partner Taxonomy, Discovery, Fit Score, Conflict Detection, Partner CRM, Deal Registration, Reseller/White-Label, Channel Selection -- an agency-facing partner program for client businesses.', missing: 'Real referral/ and AffiliateLedger.ts mechanics exist but are scoped to sohamyoga\'s own product, not a generic partner-management capability for other businesses.', priority: 26 },
  { key: 'commerce_product_intelligence', name: 'Commerce Product Intelligence', description: 'Product Performance Matrix (Traffic x Conversion x Margin), RFM segmentation, LTV:CAC, Merchandising Engine on top of the real ecommerce/ domain.', missing: 'Real Cart/Order/Inventory objects exist; this analytical layer on top does not.', priority: 27 },
  { key: 'positioning_gtm_engine', name: 'Positioning + GTM Engine', description: 'Templated positioning statement generator with A/B testing, Message House, Value Proposition Canvas.', missing: 'Only BrandStrategy.ts touches this conceptually; no structured Positioning Engine exists.', priority: 28 },
  { key: 'pmf_activation_tracking', name: 'PMF + Activation Tracking', description: 'Product-Qualified-Lead scoring, Activation-event funnel, Sean Ellis PMF survey, Feature Adoption Matrix.', missing: 'No matching domain objects found.', priority: 29 },
  { key: 'pr_earned_media_engine', name: 'PR & Earned Media Engine', description: 'PR opportunity detection, story-angle generator, media-list intelligence, press-release + media-briefing generation (human-approval gated), share-of-voice, crisis communication, sponsorship/event marketing, offline/QR attribution.', missing: 'Zero hits for press-release/earned-media/media-mention anywhere in the codebase. Community domain exists but for a different purpose (yoga-community engagement, not PR).', priority: 30 },
];

const EXCLUDED = [
  { key: 'b2b_abm_engine', reason: 'Entire B2B/account-based-marketing motion (ICP engine, Buying Committee, RevOps, Proposal/SOW/RFP generators). Excluded: sohamyoga-frontend is a B2C product with no B2B sales motion to attach this to -- building it would have no real business to validate against.' },
  { key: 'shopify_integration_layer', reason: 'Dedicated Shopify commerce integration. Excluded: the real, already-built commerce stack is ERPNext/MedusaJS/Cal.com/Moodle (see src/domain/ecommerce/integration-spec.md) -- a parallel Shopify layer would contradict the existing real architecture rather than extend it.' },
];

async function main() {
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();
  console.log('=== Registering roadmap backlog in module_registry ===');

  let inserted = 0, skipped = 0;
  for (const item of BACKLOG) {
    const res = await client.query(
      `INSERT INTO module_registry (app, module_key, name, description, built_status, missing_items, source_doc, last_verified_at, verified_by)
       VALUES ('sohamyoga-frontend', $1, $2, $3, 'not_built', $4, $5, now(), 'claude-session-2026-09-14')
       ON CONFLICT (app, module_key) DO NOTHING RETURNING id`,
      [item.key, item.name, item.description, `[Priority ${item.priority}] ${item.missing}`, SOURCE_DOC],
    );
    if (res.rowCount && res.rowCount > 0) inserted++; else skipped++;
  }
  console.log(`Registered: ${inserted} new, ${skipped} already present. Total backlog: ${BACKLOG.length}.`);
  console.log(`Explicitly excluded (documented, not silently dropped): ${EXCLUDED.map((e) => e.key).join(', ')}`);

  await client.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
