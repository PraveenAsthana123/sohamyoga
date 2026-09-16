import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool, databaseConfigured } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CONTROLS = [
  // Auth & Identity (8)
  { control_id: 'AUTH-001', category: 'Auth & Identity', name: 'Secure Registration', description: 'Password complexity, uniqueness checks, secure storage with bcrypt/argon2', implementation_status: 'implemented', priority: 'critical', risk_if_missing: 'Weak passwords and credential reuse lead to account takeover' },
  { control_id: 'AUTH-002', category: 'Auth & Identity', name: 'Email Verification', description: 'Verify email ownership before granting full account access', implementation_status: 'implemented', priority: 'high', risk_if_missing: 'Fake accounts, spam, and phishing via unverified addresses' },
  { control_id: 'AUTH-003', category: 'Auth & Identity', name: 'Password Security', description: 'Secure password reset flow, token expiry, one-time use tokens', implementation_status: 'implemented', priority: 'critical', risk_if_missing: 'Account takeover via password reset abuse' },
  { control_id: 'AUTH-004', category: 'Auth & Identity', name: 'Brute-Force Protection', description: 'Rate limiting, account lockout, exponential backoff on failed logins', implementation_status: 'partial', priority: 'critical', risk_if_missing: 'Brute-force attacks crack weak passwords rapidly' },
  { control_id: 'AUTH-005', category: 'Auth & Identity', name: 'Credential-Stuffing Detection', description: 'Detect reuse of leaked credentials from breach databases', implementation_status: 'planned', priority: 'high', risk_if_missing: 'Automated attacks using billions of leaked username/password combos' },
  { control_id: 'AUTH-006', category: 'Auth & Identity', name: 'CAPTCHA/Bot Protection', description: 'Invisible CAPTCHA or hCaptcha on registration, login, and contact forms', implementation_status: 'partial', priority: 'high', risk_if_missing: 'Bot-driven account creation, spam, and scraping' },
  { control_id: 'AUTH-007', category: 'Auth & Identity', name: 'Session Security', description: 'Secure session tokens, HttpOnly/Secure cookies, session rotation on login', implementation_status: 'implemented', priority: 'critical', risk_if_missing: 'Session hijacking and fixation attacks' },
  { control_id: 'AUTH-008', category: 'Auth & Identity', name: 'Device Detection', description: 'Track device fingerprints, alert on new device logins', implementation_status: 'planned', priority: 'medium', risk_if_missing: 'Undetected unauthorized access from new devices' },
  // Access Control (7)
  { control_id: 'ACC-001', category: 'Access Control', name: 'Impossible Travel', description: 'Flag logins from geographically impossible locations within short time windows', implementation_status: 'planned', priority: 'high', risk_if_missing: 'Credential-sharing and compromised account access go undetected' },
  { control_id: 'ACC-002', category: 'Access Control', name: 'Risk-Based Authentication', description: 'Step-up authentication (MFA challenge) based on risk signals', implementation_status: 'planned', priority: 'high', risk_if_missing: 'High-risk actions succeed without additional verification' },
  { control_id: 'ACC-003', category: 'Access Control', name: 'Tenant Isolation', description: 'Strict data segregation between tenants in multi-tenant architecture', implementation_status: 'implemented', priority: 'critical', risk_if_missing: 'Cross-tenant data leakage — catastrophic for SaaS products' },
  { control_id: 'ACC-004', category: 'Access Control', name: 'IDOR Protection', description: 'Object-level authorization checks on every resource access', implementation_status: 'partial', priority: 'critical', risk_if_missing: 'Insecure Direct Object Reference allows access to other users data' },
  { control_id: 'ACC-005', category: 'Access Control', name: 'Privilege Escalation Prevention', description: 'Enforce least-privilege, validate roles server-side, no client-side role trust', implementation_status: 'implemented', priority: 'critical', risk_if_missing: 'Users gaining admin access via manipulated requests' },
  { control_id: 'ACC-006', category: 'Access Control', name: 'Admin Privileged Access', description: 'Separate admin accounts, MFA required, audit logging for all admin actions', implementation_status: 'partial', priority: 'critical', risk_if_missing: 'Admin compromise is a full system compromise' },
  { control_id: 'ACC-007', category: 'Access Control', name: 'Just-In-Time Access', description: 'Temporary elevated permissions with automatic expiry for sensitive operations', implementation_status: 'planned', priority: 'medium', risk_if_missing: 'Permanent elevated access increases blast radius of compromised accounts' },
  // API Security (7)
  { control_id: 'API-001', category: 'API Security', name: 'Maker-Checker Approval', description: 'Two-person approval for high-value operations (payouts, bulk deletes)', implementation_status: 'partial', priority: 'high', risk_if_missing: 'Single compromised account can trigger large irreversible actions' },
  { control_id: 'API-002', category: 'API Security', name: 'API Authentication', description: 'Bearer tokens, API keys with scopes, OAuth 2.0 for third-party integrations', implementation_status: 'implemented', priority: 'critical', risk_if_missing: 'Unauthenticated API access exposes all data' },
  { control_id: 'API-003', category: 'API Security', name: 'API Authorization', description: 'Route-level and resource-level permission checks on every endpoint', implementation_status: 'implemented', priority: 'critical', risk_if_missing: 'Authenticated users access data and actions beyond their permissions' },
  { control_id: 'API-004', category: 'API Security', name: 'API Rate Limiting', description: 'Per-IP and per-user rate limits on all API endpoints', implementation_status: 'partial', priority: 'high', risk_if_missing: 'DDoS, data harvesting, and brute-force via API' },
  { control_id: 'API-005', category: 'API Security', name: 'API Schema Validation', description: 'Input validation using JSON Schema or Zod on all request bodies', implementation_status: 'partial', priority: 'high', risk_if_missing: 'Malformed inputs cause unexpected behavior and injection paths' },
  { control_id: 'API-006', category: 'API Security', name: 'Injection Prevention', description: 'Parameterized queries, ORM usage, no string concatenation in SQL', implementation_status: 'implemented', priority: 'critical', risk_if_missing: 'SQL injection can dump, modify, or destroy the entire database' },
  { control_id: 'API-007', category: 'API Security', name: 'XSS Protection', description: 'Output encoding, Content Security Policy headers, DOMPurify for user content', implementation_status: 'partial', priority: 'high', risk_if_missing: 'Cross-site scripting allows session hijacking and credential theft' },
  // Infrastructure (5)
  { control_id: 'INF-001', category: 'Infrastructure', name: 'CSRF Protection', description: 'SameSite cookies, CSRF tokens on state-changing requests', implementation_status: 'implemented', priority: 'high', risk_if_missing: 'Forged requests submitted on behalf of authenticated users' },
  { control_id: 'INF-002', category: 'Infrastructure', name: 'SSRF Protection', description: 'Allowlist for outbound requests, block metadata endpoints (169.254.x.x)', implementation_status: 'planned', priority: 'high', risk_if_missing: 'Server-side request forgery to internal services and cloud metadata' },
  { control_id: 'INF-003', category: 'Infrastructure', name: 'File Upload Security', description: 'Type validation, size limits, virus scanning, isolated storage', implementation_status: 'partial', priority: 'high', risk_if_missing: 'Malicious file uploads lead to RCE or stored XSS' },
  { control_id: 'INF-004', category: 'Infrastructure', name: 'Antivirus/Malware Scan', description: 'ClamAV or cloud AV scanning on all uploaded files', implementation_status: 'planned', priority: 'high', risk_if_missing: 'Malware distributed through the platform to other users' },
  { control_id: 'INF-005', category: 'Infrastructure', name: 'File-Type Validation', description: 'Magic bytes validation, not just extension or MIME type', implementation_status: 'partial', priority: 'high', risk_if_missing: 'Disguised executable files bypass extension-only checks' },
  // Data Security (6)
  { control_id: 'DAT-001', category: 'Data Security', name: 'PII Detection', description: 'Automated scanning of logs and storage for inadvertent PII exposure', implementation_status: 'planned', priority: 'high', risk_if_missing: 'PII leaked in logs, error messages, or public endpoints' },
  { control_id: 'DAT-002', category: 'Data Security', name: 'Data Classification', description: 'Tag data by sensitivity: public, internal, confidential, restricted', implementation_status: 'planned', priority: 'medium', risk_if_missing: 'Sensitive data treated with insufficient protection controls' },
  { control_id: 'DAT-003', category: 'Data Security', name: 'Encryption at Rest', description: 'Database-level encryption, encrypted backups, key management', implementation_status: 'implemented', priority: 'critical', risk_if_missing: 'Physical database access results in full data exposure' },
  { control_id: 'DAT-004', category: 'Data Security', name: 'Secrets Protection', description: 'No secrets in code, environment-variable injection, secret scanning in CI', implementation_status: 'partial', priority: 'critical', risk_if_missing: 'Leaked API keys and credentials in git history or logs' },
  { control_id: 'DAT-005', category: 'Data Security', name: 'Data Masking', description: 'Mask PII in logs, test environments, and non-production data copies', implementation_status: 'planned', priority: 'high', risk_if_missing: 'Production data exposure in dev/test environments' },
  { control_id: 'DAT-006', category: 'Data Security', name: 'Secure Download', description: 'Signed URLs with expiry for file downloads, access logging', implementation_status: 'partial', priority: 'medium', risk_if_missing: 'Direct file URL sharing bypasses access controls' },
];

async function ensureTables(client: import('pg').PoolClient): Promise<void> {
  await client.query(`
    CREATE TABLE IF NOT EXISTS security_controls_registry (
      id SERIAL PRIMARY KEY,
      control_id TEXT UNIQUE NOT NULL,
      category TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      implementation_status TEXT DEFAULT 'planned',
      risk_if_missing TEXT,
      priority TEXT DEFAULT 'high',
      evidence TEXT,
      last_tested DATE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS security_incidents (
      id SERIAL PRIMARY KEY,
      control_id TEXT,
      incident_type TEXT,
      severity TEXT DEFAULT 'medium',
      description TEXT,
      detected_at TIMESTAMPTZ DEFAULT NOW(),
      resolved_at TIMESTAMPTZ,
      resolution TEXT,
      status TEXT DEFAULT 'open'
    );
    CREATE TABLE IF NOT EXISTS security_scans (
      id SERIAL PRIMARY KEY,
      scan_type TEXT,
      target TEXT,
      findings JSONB,
      critical_count INTEGER DEFAULT 0,
      high_count INTEGER DEFAULT 0,
      medium_count INTEGER DEFAULT 0,
      passed_count INTEGER DEFAULT 0,
      scanned_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
  const { rows } = await client.query(`SELECT COUNT(*) AS n FROM security_controls_registry`);
  if (parseInt(rows[0].n, 10) === 0) {
    for (const c of CONTROLS) {
      await client.query(
        `INSERT INTO security_controls_registry (control_id, category, name, description, implementation_status, priority, risk_if_missing)
         VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (control_id) DO NOTHING`,
        [c.control_id, c.category, c.name, c.description, c.implementation_status, c.priority, c.risk_if_missing]
      );
    }
  }
}

export async function GET(req: NextRequest): Promise<Response> {
  const authErr = await requireAdmin(req);
  if (authErr) return authErr;
  if (!databaseConfigured()) return Response.json({ error: 'DB not configured' }, { status: 503 });
  const pool = getPool();
  const client = await pool.connect();
  try {
    await ensureTables(client);
    const { rows: controls } = await client.query(
      `SELECT * FROM security_controls_registry ORDER BY category, control_id`
    );
    const { rows: stats } = await client.query(`
      SELECT
        COUNT(*) FILTER (WHERE implementation_status = 'implemented') AS implemented,
        COUNT(*) FILTER (WHERE implementation_status = 'partial') AS partial,
        COUNT(*) FILTER (WHERE implementation_status = 'planned') AS planned,
        COUNT(*) AS total
      FROM security_controls_registry
    `);
    const { rows: incidents } = await client.query(
      `SELECT * FROM security_incidents ORDER BY detected_at DESC LIMIT 10`
    );
    const s = stats[0];
    const score = Math.round(
      ((parseInt(s.implemented) + parseInt(s.partial) * 0.5) / parseInt(s.total)) * 100
    );
    return Response.json({ controls, stats: { ...s, score }, incidents });
  } finally {
    client.release();
  }
}
