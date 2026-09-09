-- Registers the 'soham-social' platform_component so the per-platform
-- 10-tab admin page (Manual/Pipeline/Agentic/Monitoring/.../Log&Tracking,
-- see /admin/social/[platform]/page.tsx) can log real operation_run rows
-- via src/lib/operation-ledger.ts. Without this row, startOperation()
-- silently falls back to an unpersisted UUID (see its own code comment:
-- "observability must not break production work") -- so a missing
-- component key doesn't error, it just quietly logs nothing. Applied
-- live 2026-09-09 via psql; kept here so it's reproducible from schema.
INSERT INTO platform_component(component_key,name,runtime,component_type) VALUES
 ('soham-social','SohamYoga Social Platform','typescript','web')
ON CONFLICT (component_key) DO UPDATE SET runtime=EXCLUDED.runtime, component_type=EXCLUDED.component_type;
