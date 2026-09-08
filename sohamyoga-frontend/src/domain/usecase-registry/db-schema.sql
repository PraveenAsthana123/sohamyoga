-- Master Use Case Registry: finer-grained than module_registry (which tracks
-- ~30 shipped features). This tracks every individual use case pulled from
-- the two ChatGPT platform-blueprint conversations (52 Control Towers +
-- 12 transactional-backbone domains + digital-marketing module list), each
-- honestly statused against real code -- never marked real without a
-- module_registry cross-reference or direct evidence.

CREATE TABLE IF NOT EXISTS use_case_registry (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NOT NULL REFERENCES tenant (id) ON DELETE CASCADE,
  source              TEXT NOT NULL,      -- 'chatgpt:6a97442b' | 'chatgpt:6a974505' | 'internal'
  category            TEXT NOT NULL CHECK (category IN ('marketing_module','domain_control_tower','ai_governance','transactional_backbone','career_content')),
  domain              TEXT NOT NULL,      -- e.g. 'Lead Management', 'Responsible AI Control Tower'
  use_case_key        TEXT NOT NULL,
  title               TEXT NOT NULL,
  description         TEXT NOT NULL DEFAULT '',
  status              TEXT NOT NULL DEFAULT 'not_built' CHECK (status IN ('real','partial','not_built','blocked','n_a')),
  evidence            TEXT,               -- file:line, row counts, or reason for status
  module_registry_key TEXT,               -- optional link to module_registry.module_key
  priority            TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('high','normal','low')),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (tenant_id, source, use_case_key)
);

CREATE INDEX IF NOT EXISTS idx_usecase_status   ON use_case_registry (status);
CREATE INDEX IF NOT EXISTS idx_usecase_category ON use_case_registry (category);
CREATE INDEX IF NOT EXISTS idx_usecase_domain   ON use_case_registry (domain);
