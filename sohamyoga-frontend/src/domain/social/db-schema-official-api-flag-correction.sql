-- Data-quality correction found during a brutal audit: telegram and slack
-- (the only two OFFICIAL_API platforms) had requires_captcha/otp/2fa all
-- inherited from the schema's generic TRUE defaults rather than reflecting
-- their real developer flows. Creating a Telegram bot via @BotFather, and a
-- Slack app via api.slack.com/apps, both require zero CAPTCHA, zero
-- additional OTP, and zero 2FA setup specific to the integration itself --
-- these are well-documented, unambiguous facts, unlike the other 33 (MANUAL)
-- platforms which would each need individual real verification before their
-- flags could be corrected with the same confidence.
UPDATE social_platform_requirement
SET requires_captcha = false, requires_otp = false, requires_phone = false, requires_2fa = false, updated_at = now()
WHERE platform IN ('telegram', 'slack');
