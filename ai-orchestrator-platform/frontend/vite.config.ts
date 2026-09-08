import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Fixed, non-conflicting port for this project (confirmed free before use —
// see the build report). Backend is at 127.0.0.1:8100.
//
// /api and /ws are proxied to the backend so the browser only ever talks to
// ONE origin (this dev server's own host:port). This is what makes the
// Cloudflare tunnel work: the tunnel exposes only this frontend port, and a
// remote browser hitting the tunnel's https://<random>.trycloudflare.com
// origin has no way to reach 127.0.0.1:8100 on ITS OWN machine -- routing
// API/WS calls through this same-origin proxy is what lets one tunnel serve
// the whole app instead of needing two separately-exposed ports.
export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: 8101,
    strictPort: true,
    // Vite rejects unrecognized Host headers by default (anti DNS-rebinding
    // protection) -- the Cloudflare quick tunnel's URL is a random
    // *.trycloudflare.com subdomain that changes every restart, so an exact
    // hostname can't be allowlisted. The leading dot scopes this to that one
    // domain suffix rather than disabling the check for all hosts.
    allowedHosts: ['.trycloudflare.com'],
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8100',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
      '/ws': {
        target: 'ws://127.0.0.1:8100',
        ws: true,
      },
    },
  },
})
