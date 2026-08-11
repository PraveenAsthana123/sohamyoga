-- campaign_lead had no writer anywhere in the codebase — the public contact
-- form (ContactForm.tsx) POSTs to /api/contact, which doesn't exist as a
-- Next.js route (it targeted the now-deleted SLPSystems.Web ContactController.cs).
-- Result: the contact form has been completely non-functional, and the
-- lead-scoring pipeline (LeadNurturingJob, real Ollama-based scoring, already
-- built and correctly wired to the CRM Leads tab) has had zero real leads to
-- ever score. campaign_lead also has no column to hold the inquiry content
-- itself (subject/message/company/service interest) — added here.

ALTER TABLE campaign_lead ADD COLUMN IF NOT EXISTS subject VARCHAR(200);
ALTER TABLE campaign_lead ADD COLUMN IF NOT EXISTS message TEXT;
ALTER TABLE campaign_lead ADD COLUMN IF NOT EXISTS service_interest VARCHAR(80);
ALTER TABLE campaign_lead ADD COLUMN IF NOT EXISTS company VARCHAR(200);
