-- Adds 'yoga' as a real service type alongside the original clinic types
-- (dental/chiropractic/physiotherapy/ent/massage_therapy), per explicit user
-- request to reuse this project's contact/script/Vapi-sync infrastructure
-- for a yoga-studio outbound calling use case rather than building a
-- separate system from scratch.
ALTER TYPE clinic_service_type ADD VALUE IF NOT EXISTS 'yoga';
