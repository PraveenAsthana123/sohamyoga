export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';

interface HeaderSpec {
  name: string;
  expected: string;
  description: string;
  risk: 'critical' | 'high' | 'medium' | 'low';
}

const REQUIRED_HEADERS: HeaderSpec[] = [
  {
    name: 'X-Frame-Options',
    expected: 'DENY or SAMEORIGIN',
    description: 'Prevents clickjacking attacks by controlling whether the page can be embedded in a frame.',
    risk: 'high',
  },
  {
    name: 'Content-Security-Policy',
    expected: "default-src 'self'; script-src 'self'; ...",
    description: 'Mitigates XSS and data injection attacks by declaring approved content sources.',
    risk: 'critical',
  },
  {
    name: 'X-Content-Type-Options',
    expected: 'nosniff',
    description: 'Prevents MIME-type sniffing, reducing exposure to drive-by download attacks.',
    risk: 'medium',
  },
  {
    name: 'Strict-Transport-Security',
    expected: 'max-age=31536000; includeSubDomains',
    description: 'Forces HTTPS connections and prevents SSL stripping attacks.',
    risk: 'high',
  },
  {
    name: 'Referrer-Policy',
    expected: 'strict-origin-when-cross-origin',
    description: 'Controls how much referrer information is sent with requests to protect user privacy.',
    risk: 'medium',
  },
  {
    name: 'Permissions-Policy',
    expected: 'camera=(), microphone=(), geolocation=()',
    description: 'Restricts access to browser features and APIs that should not be used by the app.',
    risk: 'medium',
  },
];

// Probe the app's own home page to check which headers are actually served.
async function probeHeaders(req: NextRequest): Promise<Record<string, string>> {
  try {
    const base = new URL('/', req.url).toString();
    const res = await fetch(base, {
      method: 'HEAD',
      signal: AbortSignal.timeout(5_000),
      redirect: 'follow',
    });
    const out: Record<string, string> = {};
    res.headers.forEach((v, k) => { out[k.toLowerCase()] = v; });
    return out;
  } catch {
    return {};
  }
}

export async function GET(req: NextRequest) {
  const authErr = await requireAdmin(req);
  if (authErr) return authErr;

  const served = await probeHeaders(req);

  const headers = REQUIRED_HEADERS.map(spec => ({
    name: spec.name,
    expected: spec.expected,
    description: spec.description,
    risk: spec.risk,
    present: Boolean(served[spec.name.toLowerCase()]),
    actualValue: served[spec.name.toLowerCase()] ?? null,
  }));

  const score = Math.round(
    (headers.filter(h => h.present).length / headers.length) * 100,
  );

  return NextResponse.json({ headers, score, probed: Object.keys(served).length > 0 });
}
