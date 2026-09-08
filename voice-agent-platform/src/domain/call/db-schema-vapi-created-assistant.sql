-- Real fix for a real incident (2026-09-02): the tenant-isolation guard in
-- VapiClient.ts previously checked isOwnedAssistantId() against
-- call_script_version.vapi_assistant_id -- a column any application code
-- (or, as happened during verification testing, a direct UPDATE) can freely
-- set to any value. That made the guard self-referential: writing a foreign
-- assistant ID into our own tracking column made the guard treat it as
-- "owned," and a real PATCH against IBM's actual "Domino's Pizza-Inbound
-- Call" assistant went through and overwrote its content before being
-- restored from an earlier full capture.
--
-- This table is append-only and populated ONLY at the moment
-- syncScriptVersionToVapi() successfully CREATES a brand-new assistant via a
-- real POST to Vapi (never on PATCH, never on manual/direct DB writes). The
-- ownership guard now checks this table instead -- an assistant ID can only
-- ever be "ours" if this application's own code actually created it.
CREATE TABLE vapi_created_assistant (
  assistant_id      TEXT PRIMARY KEY,
  script_version_id UUID NOT NULL REFERENCES call_script_version(id) ON DELETE CASCADE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
