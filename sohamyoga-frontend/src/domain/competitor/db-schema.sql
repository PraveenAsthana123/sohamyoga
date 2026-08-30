-- =============================================================================
-- Market Research, Competitor Intelligence & Pricing — Competitor Price
-- Tracker. New domain folder deliberately NOT named `marketresearch`:
-- `src/domain/marketresearch/db-schema.sql` already exists and serves a
-- different purpose (a research_framework/research_topic/research_topic_tab
-- knowledge hierarchy for the market-research-portal integration — a
-- documentation/methodology system, not competitor pricing data). Reusing
-- that name would conflate two unrelated concerns, so this lives in its own
-- `competitor` domain to avoid that confusion.
--
-- No external API can honestly fetch a competitor's real pricing — that is
-- not publicly exposed data with a stable feed. The real, buildable feature
-- is the data-entry + history + comparison tool: an admin manually enters
-- real competitor pricing they've researched, tracked over time so price
-- changes are visible. "Our pricing" side of the comparison reuses the real
-- existing pricing_plan_master/pricing_plan_price tables (src/domain/pricing)
-- rather than inventing parallel pricing data.
-- =============================================================================

CREATE TABLE competitor (
  id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID         NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  name         TEXT         NOT NULL CHECK (name <> ''),
  website      TEXT,
  notes        TEXT         NOT NULL DEFAULT '',
  created_by   TEXT         NOT NULL,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, name)
);

CREATE INDEX idx_competitor_tenant ON competitor(tenant_id);

CREATE TABLE competitor_price_point (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  competitor_id   UUID         NOT NULL REFERENCES competitor(id) ON DELETE CASCADE,
  service_name    TEXT         NOT NULL CHECK (service_name <> ''),
  price           NUMERIC(10,2) NOT NULL CHECK (price >= 0),
  currency        CHAR(3)      NOT NULL DEFAULT 'CAD',
  effective_date  DATE         NOT NULL,
  notes           TEXT         NOT NULL DEFAULT '',
  created_by      TEXT         NOT NULL,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX idx_competitor_price_point_competitor ON competitor_price_point(competitor_id, effective_date DESC);
CREATE INDEX idx_competitor_price_point_service ON competitor_price_point(service_name);
