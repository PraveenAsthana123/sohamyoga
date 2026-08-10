// Server-side API base URL.
//
// NEXT_PUBLIC_* vars are inlined at build time by Next.js — server bundles bake
// in whatever the build saw. Inside the container, the build-time value
// (e.g. http://localhost:5070) is unreachable because `localhost` resolves to
// the container itself, not the host. INTERNAL_API_URL is a plain env var so
// Next.js does NOT inline it; server components read it at runtime and can
// reach the backend over the docker network (http://backend:5070).
//
// Browser code keeps using NEXT_PUBLIC_API_URL — that URL is host-reachable.
export const SERVER_API_URL =
  process.env.INTERNAL_API_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  'http://localhost:5070';
