-- Migration 093: evidence-backed cross-system workflow orchestration maturity.
INSERT INTO marketing_capability_definition
  (capability_key, domain, display_name, description, required_for_launch, sort_order)
VALUES
  ('workflow_orchestration', 'Operations', 'Workflow orchestration',
   'Tenant-scoped workflows connecting campaign, social, AI, CRM and analytics systems with approvals and run history.',
   true, 195)
ON CONFLICT (capability_key) DO UPDATE SET
  domain = EXCLUDED.domain,
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  required_for_launch = EXCLUDED.required_for_launch,
  sort_order = EXCLUDED.sort_order;

INSERT INTO tenant_marketing_capability
  (tenant_id, capability_key, maturity, provider, blocker, last_health_at)
SELECT id, 'workflow_orchestration', 'configured', 'Activepieces Community Edition',
       'Runtime is healthy; no tenant flow is data-flowing until an owner creates and tests an approval-gated workflow.',
       now()
FROM tenant
ON CONFLICT (tenant_id, capability_key) DO UPDATE SET
  maturity = EXCLUDED.maturity,
  provider = EXCLUDED.provider,
  blocker = EXCLUDED.blocker,
  last_health_at = EXCLUDED.last_health_at,
  updated_at = now();
