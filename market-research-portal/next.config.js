const path = require('node:path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  // @sohamyoga/shared-backend lives at ../packages/shared-backend — a
  // sibling directory outside this app's own tree. Next's output file
  // tracing defaults to rooting at this app's directory and silently
  // failed to follow the symlink to it, so `.next/standalone` shipped
  // without the shared package at all (confirmed: `next build` succeeded,
  // but `node .next/standalone/server.js` would have crashed on
  // `Cannot find module '@sohamyoga/shared-backend'` at runtime).
  // Rooting tracing one level up at the monorepo root fixes this.
  outputFileTracingRoot: path.join(__dirname, '..'),
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          {
            // 'unsafe-eval' is dev-only: Next.js's webpack dev server / Fast
            // Refresh runtime uses eval() for source maps, and the strict
            // CSP below silently blocked ALL client-side JS from running in
            // `next dev` — every client component stayed on "Loading…"
            // forever with no visible error except a CSP violation in the
            // browser console. Production (`next start`) keeps the strict
            // policy; only dev relaxes script-src.
            key: 'Content-Security-Policy',
            value: `default-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; script-src 'self' 'unsafe-inline'${process.env.NODE_ENV !== 'production' ? " 'unsafe-eval'" : ''}; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self';`,
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
