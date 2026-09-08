-- Real redirect-rule store, part of "Broken Link & Redirect Management"
-- (SEO/GEO domain). A found broken link can be paired with a real redirect
-- rule here rather than just reported and forgotten.
CREATE TABLE IF NOT EXISTS seo_redirect_rule (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  from_path    TEXT NOT NULL,
  to_path      TEXT NOT NULL,
  status_code  SMALLINT NOT NULL DEFAULT 301 CHECK (status_code IN (301, 302, 307, 308)),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, from_path)
);
