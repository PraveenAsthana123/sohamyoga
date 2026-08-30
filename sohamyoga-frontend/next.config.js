const path = require('node:path');

/** @type {import('next').NextConfig} */
const apiOrigin = (() => { try { return new URL(process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:5070').origin; } catch { return ''; } })();
const nextConfig = {
  output: 'standalone',
  // @sohamyoga/shared-backend lives at ../packages/shared-backend, a
  // sibling directory outside this app's tree — confirmed this session
  // (market-research-portal) that standalone output file tracing silently
  // drops such symlinked packages without this set to the monorepo root.
  transpilePackages: ['@sohamyoga/shared-backend'],
  experimental: {
    outputFileTracingRoot: path.join(__dirname, '..'),
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'sohamyoga.ca',
      },
      {
        protocol: 'https',
        hostname: '*.sohamyoga.ca',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
    ],
  },
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
            key: 'Content-Security-Policy',
            value: `default-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' ${apiOrigin} ws: wss:;`,
          },
        ],
      },
    ];
  },
  async rewrites() {
    // `fallback` (not a plain array/`afterFiles`) — this proxy must only catch
    // requests that don't match anything in this app's own API surface. A
    // plain-array rewrite runs before dynamic App Router routes are checked,
    // which was silently swallowing every /api/**/[id] route in this project
    // (PATCH/DELETE-by-id endpoints) and sending them to the .NET backend
    // instead, where they don't exist — a 404 with no trace of ever reaching
    // the real handler. `fallback` runs only after Next's own routes
    // (static AND dynamic) have already been tried and none matched, which is
    // exactly the "these are the legacy public-site/.NET-only endpoints
    // (auth, blog, contact, jobs, newsletter, webhooks, etc.) with no Next.js
    // route of their own" case this proxy exists for.
    return {
      fallback: [
        {
          source: '/api/:path*',
          destination: `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5070'}/api/:path*`,
        },
      ],
    };
  },
};

module.exports = nextConfig;
