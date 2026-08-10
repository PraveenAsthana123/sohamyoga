-- =============================================================================
-- Identity Module — Database Schema
-- Covers: Keycloak identity link, registration tokens (QR/barcode),
--         QR login challenges, consent records, login audit, social leads
-- All tables carry tenant_id for multi-tenancy (row-level isolation).
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- Reference tables
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE ref_identity_status (
  code        TEXT PRIMARY KEY,
  label       TEXT NOT NULL,
  description TEXT
);
INSERT INTO ref_identity_status VALUES
  ('unverified', 'Unverified',  'Email/mobile not yet confirmed'),
  ('active',     'Active',      'Verified and fully operational'),
  ('locked',     'Locked',      'Temporarily locked after failed logins'),
  ('suspended',  'Suspended',   'Administratively suspended');

CREATE TABLE ref_portal_role (
  code        TEXT PRIMARY KEY,
  label       TEXT NOT NULL,
  risk_level  INT  NOT NULL CHECK (risk_level BETWEEN 1 AND 5),
  description TEXT
);
INSERT INTO ref_portal_role VALUES
  ('visitor',         'Visitor',           1, 'Public pages and registration only'),
  ('customer',        'Customer/Student',  1, 'Classes, bookings, payments, profile'),
  ('parent_guardian', 'Parent/Guardian',   1, 'Manage child bookings and consent'),
  ('teacher',         'Teacher',           2, 'Schedule, attendance scanner, student list'),
  ('reception',       'Reception Staff',   2, 'Registration, check-in desk'),
  ('marketing',       'Marketing Staff',   3, 'Campaign and lead access'),
  ('finance',         'Finance Staff',     3, 'Invoice and payment access'),
  ('portal_admin',    'Portal Admin',      4, 'Configuration and user administration'),
  ('super_admin',     'Super Admin',       5, 'Restricted platform administration');

CREATE TABLE ref_login_method (
  code TEXT PRIMARY KEY,
  label TEXT NOT NULL
);
INSERT INTO ref_login_method VALUES
  ('password',     'Email + Password'),
  ('otp',          'Email/SMS One-Time Code'),
  ('google',       'Google Sign-In'),
  ('facebook',     'Facebook Login'),
  ('apple',        'Apple Sign-In'),
  ('microsoft',    'Microsoft Sign-In'),
  ('passkey',      'Passkey / Fingerprint'),
  ('qr_challenge', 'QR Kiosk Challenge');

CREATE TABLE ref_consent_type (
  code TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  mandatory BOOLEAN NOT NULL DEFAULT FALSE
);
INSERT INTO ref_consent_type VALUES
  ('terms_of_service',  'Terms of Service',          TRUE),
  ('privacy_policy',    'Privacy Policy',             TRUE),
  ('marketing_emails',  'Marketing Emails',           FALSE),
  ('marketing_sms',     'Marketing SMS',              FALSE),
  ('data_processing',   'Data Processing Agreement',  TRUE),
  ('medical_disclaimer','Medical Disclaimer',         TRUE),
  ('recording_consent', 'Class Recording Consent',   FALSE);

CREATE TABLE ref_registration_token_type (
  code  TEXT PRIMARY KEY,
  label TEXT NOT NULL
);
INSERT INTO ref_registration_token_type VALUES
  ('customer',      'Customer Identity QR'),
  ('class_booking', 'Class Booking QR'),
  ('membership',    'Membership Validation QR'),
  ('package',       'Package Credit QR'),
  ('workshop',      'Workshop Admission QR'),
  ('retreat',       'Retreat Multi-Day QR'),
  ('teacher',       'Teacher Check-In QR'),
  ('visitor',       'Trial/Visitor QR'),
  ('family',        'Family Group QR'),
  ('equipment',     'Equipment Loan QR');

CREATE TABLE ref_checkin_result (
  code        TEXT PRIMARY KEY,
  label       TEXT NOT NULL,
  action      TEXT NOT NULL  -- 'allow', 'warn', 'reject'
);
INSERT INTO ref_checkin_result VALUES
  ('valid',              'Valid — Check In',         'allow'),
  ('already_scanned',    'Already Scanned',          'warn'),
  ('wrong_class',        'Wrong Class',              'reject'),
  ('too_early',          'Too Early',                'warn'),
  ('expired_membership', 'Membership Expired',       'reject'),
  ('no_credits',         'No Remaining Credits',     'reject'),
  ('cancelled',          'Registration Cancelled',   'reject'),
  ('unknown_token',      'Unknown Token',            'reject'),
  ('offline_queued',     'Queued (Offline Mode)',     'warn'),
  ('manual_override',    'Manual Override',          'allow');

CREATE TABLE ref_social_lead_source (
  code  TEXT PRIMARY KEY,
  label TEXT NOT NULL
);
INSERT INTO ref_social_lead_source VALUES
  ('facebook_lead_form',   'Facebook Instant Form'),
  ('instagram_lead_form',  'Instagram Lead Campaign'),
  ('linkedin_lead_form',   'LinkedIn Lead Gen Form'),
  ('google_ads',           'Google Ads Lead Form'),
  ('tiktok_lead',          'TikTok Lead Generation'),
  ('organic_social',       'Organic Social Post'),
  ('portal_signup',        'Direct Portal Sign-Up'),
  ('referral',             'Customer Referral');

-- ─────────────────────────────────────────────────────────────────────────────
-- Core identity tables
-- ─────────────────────────────────────────────────────────────────────────────

-- Links each customer to their Keycloak account.
-- customer_id FK references the yoga portal's customer table (external schema).
CREATE TABLE identity_account (
  id                    TEXT        PRIMARY KEY,
  keycloak_id           TEXT        NOT NULL UNIQUE,
  customer_id           TEXT        NOT NULL,         -- FK to customer.id
  tenant_id             TEXT        NOT NULL,
  email                 TEXT        NOT NULL,
  status                TEXT        NOT NULL REFERENCES ref_identity_status(code),
  mfa_enabled           BOOLEAN     NOT NULL DEFAULT FALSE,
  last_login_at         TIMESTAMPTZ,
  last_login_method     TEXT        REFERENCES ref_login_method(code),
  login_failure_count   INT         NOT NULL DEFAULT 0 CHECK (login_failure_count >= 0),
  locked_until          TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_identity_account_tenant        ON identity_account(tenant_id);
CREATE INDEX idx_identity_account_email         ON identity_account(tenant_id, email);
CREATE INDEX idx_identity_account_keycloak      ON identity_account(keycloak_id);
CREATE INDEX idx_identity_account_customer      ON identity_account(customer_id);

-- Role assignments (many roles per account)
CREATE TABLE identity_role_assignment (
  id           TEXT        PRIMARY KEY,
  identity_id  TEXT        NOT NULL REFERENCES identity_account(id) ON DELETE CASCADE,
  role         TEXT        NOT NULL REFERENCES ref_portal_role(code),
  assigned_by  TEXT        NOT NULL,  -- admin identity_id
  assigned_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at   TIMESTAMPTZ,
  UNIQUE (identity_id, role)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- QR / barcode registration tokens
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE registration_token (
  id              TEXT        PRIMARY KEY,
  token_value     TEXT        NOT NULL UNIQUE,  -- random "tk_<32hex>"
  type            TEXT        NOT NULL REFERENCES ref_registration_token_type(code),
  status          TEXT        NOT NULL DEFAULT 'active' CHECK (status IN ('active','used','expired','revoked','cancelled')),
  reference_id    TEXT        NOT NULL,          -- bookingId / membershipId / workshopId
  customer_id     TEXT        NOT NULL,
  tenant_id       TEXT        NOT NULL,
  valid_from      TIMESTAMPTZ NOT NULL,
  valid_until     TIMESTAMPTZ NOT NULL,
  last_scanned_at TIMESTAMPTZ,
  scan_count      INT         NOT NULL DEFAULT 0 CHECK (scan_count >= 0),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (valid_until > valid_from)
);

CREATE INDEX idx_reg_token_tenant     ON registration_token(tenant_id);
CREATE INDEX idx_reg_token_customer   ON registration_token(customer_id);
CREATE INDEX idx_reg_token_reference  ON registration_token(reference_id);
CREATE INDEX idx_reg_token_status     ON registration_token(status);

-- Each individual scan event
CREATE TABLE registration_token_scan (
  id               TEXT        PRIMARY KEY,
  token_id         TEXT        NOT NULL REFERENCES registration_token(id) ON DELETE CASCADE,
  scanned_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  scanned_by       TEXT        NOT NULL,    -- staff/teacher identity_id
  device_id        TEXT        NOT NULL,
  result           TEXT        NOT NULL REFERENCES ref_checkin_result(code),
  note             TEXT,
  override_by      TEXT,                    -- supervisor identity_id for manual_override
  tenant_id        TEXT        NOT NULL
);

CREATE INDEX idx_scan_token    ON registration_token_scan(token_id);
CREATE INDEX idx_scan_result   ON registration_token_scan(result);
CREATE INDEX idx_scan_scanned  ON registration_token_scan(scanned_at);

-- ─────────────────────────────────────────────────────────────────────────────
-- QR login challenge (kiosk / TV login)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE qr_login_challenge (
  id                    TEXT        PRIMARY KEY,
  challenge_token       TEXT        NOT NULL UNIQUE,  -- embedded in QR image
  browser_session_id    TEXT        NOT NULL,
  device_hint           TEXT        NOT NULL,
  approved_by_session_id TEXT,
  status                TEXT        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','expired','used')),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at            TIMESTAMPTZ NOT NULL,
  used_at               TIMESTAMPTZ,
  tenant_id             TEXT        NOT NULL,
  CHECK (expires_at > created_at)
);

CREATE INDEX idx_qr_challenge_token  ON qr_login_challenge(challenge_token);
CREATE INDEX idx_qr_challenge_status ON qr_login_challenge(status, expires_at);

-- ─────────────────────────────────────────────────────────────────────────────
-- Consent records (immutable — only append; revoke creates new row)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE consent_record (
  id            TEXT        PRIMARY KEY,
  customer_id   TEXT        NOT NULL,
  consent_type  TEXT        NOT NULL REFERENCES ref_consent_type(code),
  granted       BOOLEAN     NOT NULL,
  version       TEXT        NOT NULL,  -- document version date "2026-08-01"
  granted_at    TIMESTAMPTZ NOT NULL,
  revoked_at    TIMESTAMPTZ,
  ip_address    INET        NOT NULL,
  user_agent    TEXT        NOT NULL,
  tenant_id     TEXT        NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_consent_customer ON consent_record(customer_id);
CREATE INDEX idx_consent_type     ON consent_record(customer_id, consent_type);

-- ─────────────────────────────────────────────────────────────────────────────
-- Login audit events
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE login_audit_event (
  id             TEXT        PRIMARY KEY,
  identity_id    TEXT        REFERENCES identity_account(id) ON DELETE SET NULL,  -- null = unknown user
  tenant_id      TEXT        NOT NULL,
  event_type     TEXT        NOT NULL,
  login_method   TEXT        REFERENCES ref_login_method(code),
  ip_address     INET,
  user_agent     TEXT,
  success        BOOLEAN     NOT NULL,
  failure_reason TEXT,
  metadata       JSONB       NOT NULL DEFAULT '{}',
  occurred_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_identity   ON login_audit_event(identity_id);
CREATE INDEX idx_audit_occurred   ON login_audit_event(occurred_at DESC);
CREATE INDEX idx_audit_type       ON login_audit_event(event_type);
CREATE INDEX idx_audit_tenant     ON login_audit_event(tenant_id, occurred_at DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- Social leads (Facebook / LinkedIn / Google Ads lead forms)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE social_lead (
  id                TEXT        PRIMARY KEY,
  source            TEXT        NOT NULL REFERENCES ref_social_lead_source(code),
  external_lead_id  TEXT,       -- Facebook/LinkedIn lead ID
  name              TEXT        NOT NULL,
  email             TEXT        NOT NULL,
  mobile            TEXT,
  interest          TEXT,
  ad_campaign_id    TEXT,
  status            TEXT        NOT NULL DEFAULT 'new' CHECK (status IN ('new','contacted','verified','converted','disqualified','duplicate')),
  duplicate_of_id   TEXT        REFERENCES social_lead(id),
  converted_to_id   TEXT,       -- FK to customer.id after conversion
  marketing_consent BOOLEAN     NOT NULL DEFAULT FALSE,
  verified_at       TIMESTAMPTZ,
  contacted_at      TIMESTAMPTZ,
  converted_at      TIMESTAMPTZ,
  raw_payload       JSONB       NOT NULL DEFAULT '{}',
  tenant_id         TEXT        NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_social_lead_email    ON social_lead(tenant_id, email);
CREATE INDEX idx_social_lead_status   ON social_lead(status);
CREATE INDEX idx_social_lead_campaign ON social_lead(ad_campaign_id);
CREATE INDEX idx_social_lead_source   ON social_lead(source, status);

-- ─────────────────────────────────────────────────────────────────────────────
-- Useful views
-- ─────────────────────────────────────────────────────────────────────────────

-- Active identity accounts with their roles
CREATE VIEW v_identity_with_roles AS
SELECT
  ia.id,
  ia.tenant_id,
  ia.email,
  ia.status,
  ia.mfa_enabled,
  ia.last_login_at,
  ia.last_login_method,
  ia.locked_until,
  ARRAY_AGG(ira.role ORDER BY ira.role) FILTER (WHERE ira.revoked_at IS NULL) AS active_roles
FROM identity_account ia
LEFT JOIN identity_role_assignment ira ON ira.identity_id = ia.id
GROUP BY ia.id, ia.tenant_id, ia.email, ia.status, ia.mfa_enabled,
         ia.last_login_at, ia.last_login_method, ia.locked_until;

-- Pending QR login challenges (not expired or used)
CREATE VIEW v_active_qr_challenges AS
SELECT *
FROM qr_login_challenge
WHERE status = 'pending'
  AND expires_at > NOW();

-- Registration tokens ready for scanning
CREATE VIEW v_active_registration_tokens AS
SELECT
  rt.*,
  rtt.label AS type_label
FROM registration_token rt
JOIN ref_registration_token_type rtt ON rtt.code = rt.type
WHERE rt.status = 'active'
  AND rt.valid_from <= NOW()
  AND rt.valid_until > NOW();

-- Today's check-in summary per class (useful for teacher dashboard)
CREATE VIEW v_today_checkin_summary AS
SELECT
  rts.device_id,
  rt.reference_id        AS class_id,
  rt.tenant_id,
  COUNT(*)               AS total_scans,
  COUNT(*) FILTER (WHERE rts.result = 'valid')          AS arrived,
  COUNT(*) FILTER (WHERE rts.result = 'already_scanned') AS duplicate_scans,
  COUNT(*) FILTER (WHERE rts.result IN ('expired_membership','no_credits','cancelled')) AS rejected
FROM registration_token_scan rts
JOIN registration_token rt ON rt.id = rts.token_id
WHERE rts.scanned_at >= CURRENT_DATE
GROUP BY rts.device_id, rt.reference_id, rt.tenant_id;

-- Active lead pipeline
CREATE VIEW v_social_lead_pipeline AS
SELECT
  tenant_id,
  source,
  status,
  COUNT(*)                                  AS count,
  COUNT(*) FILTER (WHERE marketing_consent) AS with_consent,
  MIN(created_at)                           AS oldest_lead_at,
  MAX(created_at)                           AS newest_lead_at
FROM social_lead
WHERE status NOT IN ('disqualified', 'duplicate')
GROUP BY tenant_id, source, status;
