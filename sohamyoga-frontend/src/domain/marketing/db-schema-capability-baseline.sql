-- Evidence-based initial maturity. `installed` means code/schema/service exists;
-- it never means configured, receiving data, or producing verified outcomes.
UPDATE tenant_marketing_capability SET maturity='installed',provider='SohamYoga SEO reports',updated_at=now() WHERE capability_key='seo_technical';
UPDATE tenant_marketing_capability SET maturity='installed',provider='marketing_search_visibility_snapshot',updated_at=now() WHERE capability_key='geo_answer_visibility';
UPDATE tenant_marketing_capability SET maturity='installed',provider='SohamYoga Ads',updated_at=now() WHERE capability_key='paid_media';
UPDATE tenant_marketing_capability SET maturity='installed',provider='tracking_event',updated_at=now() WHERE capability_key='conversion_tracking';
UPDATE tenant_marketing_capability SET maturity='installed',provider='campaign_analytics',updated_at=now() WHERE capability_key='attribution';
UPDATE tenant_marketing_capability SET maturity='installed',provider='marketing_content_learning',updated_at=now() WHERE capability_key='content_learning';
UPDATE tenant_marketing_capability SET maturity='installed',provider='Postiz',blocker='Provider OAuth and API key required',updated_at=now() WHERE capability_key='social_publishing';
UPDATE tenant_marketing_capability SET maturity='installed',provider='sentiment and viral signal jobs',updated_at=now() WHERE capability_key='social_listening';
UPDATE tenant_marketing_capability SET maturity='installed',provider='Mautic',blocker='SMTP, HTTPS tracking and tenant synchronization required',updated_at=now() WHERE capability_key='lifecycle_journeys';
UPDATE tenant_marketing_capability SET maturity='installed',provider='campaign segmentation',updated_at=now() WHERE capability_key='audience_management';
UPDATE tenant_marketing_capability SET maturity='installed',provider='survey and NPS pipeline',blocker='Legacy NPS schema lacks tenant attribution',updated_at=now() WHERE capability_key='reputation';
UPDATE tenant_marketing_capability SET maturity='installed',provider='lead scoring and consent records',updated_at=now() WHERE capability_key='data_quality';
UPDATE tenant_marketing_capability SET maturity='installed',provider='marketing_budget_guardrail',updated_at=now() WHERE capability_key='budget_governance';
UPDATE tenant_marketing_capability SET maturity='installed',provider='consent and suppression schema',updated_at=now() WHERE capability_key='privacy_compliance';
UPDATE tenant_marketing_capability SET maturity='data_flowing',provider='Marketing Operations Center',updated_at=now() WHERE capability_key='multi_tenant_ops';
