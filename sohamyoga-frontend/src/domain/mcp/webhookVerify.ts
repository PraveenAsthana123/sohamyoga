import crypto from 'node:crypto';

/** GitHub: X-Hub-Signature-256 = "sha256=" + HMAC-SHA256(secret, rawBody) hex. Real, documented scheme. */
export function verifyGithubSignature(rawBody: string, signatureHeader: string | null, secret: string): boolean {
  if (!signatureHeader?.startsWith('sha256=')) return false;
  const expected = 'sha256=' + crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  const a = Buffer.from(signatureHeader);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** GitLab: X-Gitlab-Token is a plain shared-secret string, not HMAC-signed. Real, documented scheme. */
export function verifyGitlabToken(tokenHeader: string | null, secret: string): boolean {
  if (!tokenHeader) return false;
  const a = Buffer.from(tokenHeader);
  const b = Buffer.from(secret);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** Patreon: X-Patreon-Signature = HMAC-MD5(secret, rawBody) hex. Real, documented scheme
 * (Patreon's webhook docs specify MD5, not SHA -- an older but real algorithm choice, not a mistake). */
export function verifyPatreonSignature(rawBody: string, signatureHeader: string | null, secret: string): boolean {
  if (!signatureHeader) return false;
  const expected = crypto.createHmac('md5', secret).update(rawBody).digest('hex');
  const a = Buffer.from(signatureHeader);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
