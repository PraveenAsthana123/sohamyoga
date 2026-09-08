-- Fields flagged as a real, repeated gap this session: the business had
-- nowhere to define a welcome note, thank-you note, or payment note
-- distinct from their raw services/pricing text. Feeds
-- VapiAssistantSync.ts's business-context auto-grounding block.
ALTER TABLE business_customer ADD COLUMN IF NOT EXISTS welcome_note TEXT NOT NULL DEFAULT '';
ALTER TABLE business_customer ADD COLUMN IF NOT EXISTS thank_you_note TEXT NOT NULL DEFAULT '';
ALTER TABLE business_customer ADD COLUMN IF NOT EXISTS payment_note TEXT NOT NULL DEFAULT '';
