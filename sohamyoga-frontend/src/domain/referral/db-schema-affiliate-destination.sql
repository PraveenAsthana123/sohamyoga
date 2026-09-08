-- Migration 160 (2026-09-08): real affiliate tracking-link destination.
-- Closes the documented gap: "attribution flows through vendor-owned
-- storefront/products, not a unique external tracking link with click
-- attribution -- the actual affiliate-link model is absent." referral_url
-- already stores the SHAREABLE /r/[code] link itself (see generate-code
-- route); this adds the actual REDIRECT TARGET for affiliate links, since
-- /r/[code] previously ignored it and always sent every code to
-- /customer/register -- fine for a customer-referral code, wrong for an
-- affiliate link meant to point at a specific vendor product/service page.
ALTER TABLE referral_code
  ADD COLUMN IF NOT EXISTS destination_path TEXT;
