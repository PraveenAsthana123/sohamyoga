# Security Standard — sohamyoga Platform

> **Version:** 2.0.0 · **Mandatory for all contributors**

## Application Security (OWASP Top 10 Controls)

| OWASP Risk | Control | Implementation |
|-----------|---------|---------------|
| A01 Broken Access Control | Role-based auth middleware | `app/auth.py`, Next.js middleware |
| A02 Cryptographic Failures | Secrets in env only, TLS DB | `.env` + pg SSL |
| A03 Injection | Parameterized queries everywhere | `pool.query('...', [params])` |
| A04 Insecure Design | Threat-modeled API routes | Auth gate on every admin route |
| A05 Security Misconfiguration | Security scan job daily | `SecurityScanJob.ts` |
| A06 Vulnerable Components | `uv lock` + `npm audit` | CI check on push |
| A07 Auth & Session Failures | Session tokens, expiry, rotation | Cookie-based sessions |
| A08 Software & Data Integrity | Webhook signature verify | HMAC-SHA256 per platform |
| A09 Security Logging | Full audit trail | `security_audit_log` table |
| A10 SSRF | Ollama calls local only, no user URL control | Fixed endpoint: 127.0.0.1:11434 |

## API Security Controls

```typescript
// Rate limiting — apply to all public routes
const RATE_LIMITS = {
  public: { requests: 60, windowMs: 60_000 },      // 60/min unauthenticated
  authenticated: { requests: 300, windowMs: 60_000 }, // 300/min authenticated
  ai_endpoints: { requests: 20, windowMs: 60_000 },   // 20/min AI generation
  bot_chat: { requests: 30, windowMs: 60_000 },        // 30/min bot chat
};

// CORS — explicit allowlist only
const ALLOWED_ORIGINS = ['http://127.0.0.1:8085', 'https://yourdomain.com'];

// Content-Security-Policy headers (add to next.config.js headers)
const CSP = "default-src 'self'; script-src 'self' 'unsafe-eval'; style-src 'self' 'unsafe-inline'";
```

## Encryption Standards

| Data Type | At Rest | In Transit |
|-----------|---------|------------|
| Database | OS-level (server encryption) | TLS 1.3 |
| Secrets | OS env vars only | Never transmitted |
| Sessions | Signed cookie (HttpOnly, Secure, SameSite=Strict) | HTTPS only |
| Webhooks | Verified via HMAC-SHA256 | HTTPS only |
| API logs | Payload sanitized before storage | TLS |
| AI prompts | PII stripped before Ollama | localhost only |

## Secrets Management

```
ALLOWED in DB:    env var NAMES ("FACEBOOK_PAGE_ACCESS_TOKEN")
                  app_id, system_user_id (non-secret identifiers)
                  webhook verify_token (public, not the secret)

NEVER in DB:      actual token values, API keys, passwords, secrets
NEVER in code:    hardcoded credentials, API keys
NEVER in logs:    full tokens, passwords, secrets
NEVER in commits: .env files, *.key files, credential files

IF ACCIDENTALLY COMMITTED:
1. Rotate ALL keys in that file immediately
2. Use git filter-branch or BFG Repo Cleaner to purge history
3. Notify all team members
4. Document incident in security_audit_log
```

## Model Security (AI-specific)

```
Prompt Injection Protection:
  - User input sanitized (strip <script>, javascript:, on*= attributes)
  - Max prompt length: 5,000 chars
  - System prompt not echoed in response
  - Model output sanitized before display

Data Leakage Prevention:
  - PII (email, phone, name) replaced with {customer_id} in prompts
  - Database query results stripped of sensitive fields before AI input
  - Ollama runs locally — no data egress to cloud

Model Output Validation:
  - Output length enforced (platform char limits)
  - Output sanitized through sanitizeInput() before display
  - Hallucination detection: check for URLs/citations that don't exist
  - Confidence score required for any classification task
```

## Cloud Security (when deployed)

```
Infrastructure:
  - VPC with private subnet for database
  - No direct DB access from public internet
  - Bastion host for admin SSH access
  - Security groups: only necessary ports open (443, 22 from bastion)

Container Security:
  - Non-root user in Docker containers
  - Read-only filesystem where possible
  - No privileged containers
  - Health checks configured

Secrets at Cloud Level:
  - Use cloud secret manager (AWS Secrets Manager / GCP Secret Manager)
  - Rotate secrets automatically every 90 days
  - Least-privilege IAM roles
  - Audit all secret access in cloud audit log
```
