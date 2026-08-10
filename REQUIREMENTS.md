# Requirements — SohamYoga Portal

---

## System Requirements

### Development Environment

| Requirement | Minimum | Recommended |
|------------|---------|-------------|
| OS | Windows 10 / macOS 12 / Ubuntu 22.04 | Ubuntu 24.04 LTS |
| RAM | 4 GB | 8 GB |
| Disk | 10 GB free | 20 GB free |
| CPU | 2 cores | 4 cores |

### Runtime Prerequisites

| Tool | Version | Required | Purpose |
|------|---------|----------|---------|
| .NET SDK | 8.0+ | Yes | Backend build and runtime |
| Node.js | 20+ | Yes | Frontend build and runtime |
| npm | 10+ | Yes | Frontend package management |
| Git | 2.40+ | Yes | Version control |
| Docker | 24+ | Production | Container runtime |
| Docker Compose | 2.20+ | Production | Multi-container orchestration |
| cloudflared | Latest | Optional | Cloudflare tunnel for remote sharing |

---

## Backend Dependencies (.NET 8)

### NuGet Packages

| Package | Version | Purpose |
|---------|---------|---------|
| `Microsoft.AspNetCore.Identity.EntityFrameworkCore` | 8.0.* | User authentication & role management |
| `Microsoft.EntityFrameworkCore.Sqlite` | 8.0.* | SQLite database provider |
| `Microsoft.EntityFrameworkCore.Tools` | 8.0.* | EF Core CLI (migrations) |
| `Microsoft.Extensions.Diagnostics.HealthChecks.EntityFrameworkCore` | 8.0.* | Database health checks |
| `Serilog.AspNetCore` | 8.0.* | Structured logging (console + file) |
| `Swashbuckle.AspNetCore` | 6.5.0 | Swagger / OpenAPI documentation |

### .NET Global Tools

| Tool | Install Command | Purpose |
|------|----------------|---------|
| `dotnet-ef` | `dotnet tool install --global dotnet-ef` | EF Core migrations CLI |

### Backward Compatibility Notes

- **Target Framework**: `net8.0` — compatible with .NET 8.0.0 through 8.0.x
- **SQLite**: Bundled with EF Core, no external DB server required
- **ASP.NET Identity**: Cookie-based auth, no external identity provider needed
- **SignalR**: Built into ASP.NET Core, no additional server needed
- **NuGet versions**: Using `8.0.*` wildcard — automatically resolves to latest 8.0.x patch

---

## Frontend Dependencies (Next.js)

### Production Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `next` | ^14.2.35 | React framework (SSR, routing, metadata) |
| `react` | ^18.3.1 | UI library |
| `react-dom` | ^18.3.1 | React DOM renderer |
| `@microsoft/signalr` | ^10.0.0 | SignalR client for live chat WebSocket |
| `@tiptap/react` | ^3.20.0 | Rich text editor (React integration) |
| `@tiptap/starter-kit` | ^3.20.0 | Tiptap base extensions |
| `@tiptap/extension-placeholder` | ^3.20.0 | Tiptap placeholder extension |

### Development Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `typescript` | ^5.9.3 | Type safety |
| `tailwindcss` | ^3.4.19 | Utility-first CSS framework |
| `postcss` | ^8.5.6 | CSS processing |
| `autoprefixer` | ^10.4.24 | CSS vendor prefixing |
| `eslint` | ^8.57.1 | Code linting |
| `eslint-config-next` | ^14.2.35 | Next.js ESLint rules |
| `@types/node` | ^25.3.0 | Node.js type definitions |
| `@types/react` | ^19.2.14 | React type definitions |
| `@types/react-dom` | ^19.2.3 | React DOM type definitions |

### Backward Compatibility Notes

- **Next.js 14**: Uses App Router (not Pages Router). Compatible with React 18.x
- **Tailwind CSS 3**: Not yet upgraded to v4. All utility classes use v3 syntax
- **TypeScript 5**: Strict mode enabled. Compatible with all dependencies
- **SignalR client**: Version ^10.0.0 is backward compatible with ASP.NET Core 8 SignalR hub
- **Tiptap 3**: Breaking change from v2 — uses new extension API. Not backward compatible with Tiptap 2.x
- **Node.js 20+**: Required for Next.js 14. Node 18 is NOT supported

---

## Infrastructure Dependencies

### Docker Images

| Image | Tag | Purpose |
|-------|-----|---------|
| `mcr.microsoft.com/dotnet/sdk` | 8.0-alpine | Backend build stage |
| `mcr.microsoft.com/dotnet/aspnet` | 8.0-alpine | Backend runtime |
| `node` | 20-alpine | Frontend build and runtime |
| `nginx` | 1.25-alpine | Reverse proxy |

### Ports

| Port | Service | Protocol |
|------|---------|----------|
| 3000 | Next.js Frontend | HTTP |
| 5062 | .NET Backend API | HTTP |
| 80 | Nginx (production) | HTTP |
| 443 | Nginx (production) | HTTPS |

### Volumes (Docker)

| Volume | Mount Point | Purpose |
|--------|-------------|---------|
| `sohamyoga-data` | `/app/data` | SQLite database persistence |
| `sohamyoga-logs` | `/app/logs` | Serilog log file persistence |

---

## Environment Variables

### Required

| Variable | Example | Used By |
|----------|---------|---------|
| `NEXT_PUBLIC_API_URL` | `http://localhost:5062` | Frontend |
| `ASPNETCORE_ENVIRONMENT` | `Development` | Backend |

### Optional

| Variable | Default | Used By |
|----------|---------|---------|
| `NEXT_PUBLIC_SITE_URL` | `https://sohamyoga.ca` | Frontend (OG tags) |
| `ASPNETCORE_URLS` | `http://+:5062` | Backend |
| `AllowedOrigins__0` | `http://localhost:3000` | Backend (CORS) |
| `RateLimit__MaxRequests` | `100` | Backend |
| `RateLimit__WindowSeconds` | `60` | Backend |
| `SMTP_HOST` | — | Backend (email) |
| `SMTP_PORT` | `587` | Backend (email) |
| `SMTP_USERNAME` | — | Backend (email) |
| `SMTP_PASSWORD` | — | Backend (email) |

---

## Browser Compatibility

| Browser | Minimum Version | Notes |
|---------|----------------|-------|
| Chrome | 90+ | Full support |
| Firefox | 90+ | Full support |
| Safari | 15+ | Full support |
| Edge | 90+ | Full support (Chromium-based) |
| IE 11 | Not supported | Next.js 14 does not support IE |

### CSS Features Used

| Feature | Support | Fallback |
|---------|---------|----------|
| `backdrop-filter: blur()` | Chrome 76+, Firefox 103+ | Solid background color |
| `line-clamp` | Chrome 68+, Firefox 68+ | Text truncation with overflow |
| CSS Grid | Chrome 57+, Firefox 52+ | None (required) |
| Flexbox | Chrome 29+, Firefox 22+ | None (required) |
| `gap` (flexbox) | Chrome 84+, Firefox 63+ | Margins |
| Custom Properties (CSS vars) | Chrome 49+, Firefox 31+ | None (required) |
| `@layer` | Chrome 99+, Firefox 97+ | Used by Tailwind CSS |

---

## API Backward Compatibility

### Versioning Strategy

- Current: Unversioned (`/api/...`)
- All endpoints maintain backward compatibility within the same major version
- Breaking changes will be introduced with `/api/v2/` prefix
- Deprecated endpoints return `X-Deprecated: true` header

### Stability Guarantees

| Aspect | Guarantee |
|--------|-----------|
| Response shape | Fields are never removed, only added |
| HTTP methods | Endpoints never change HTTP method |
| Status codes | Same codes for same conditions |
| URL paths | Paths never change without redirect |
| Auth mechanism | Cookie-based auth is the stable contract |

### Database Migration Compatibility

- EF Core migrations are forward-only (never modify deployed migrations)
- New migrations are additive (add columns/tables, never drop)
- SQLite WAL mode ensures concurrent read compatibility
- Migration history tracked in `__EFMigrationsHistory` table

---

## Security Requirements

| Requirement | Implementation |
|------------|----------------|
| HTTPS | Nginx SSL termination (Let's Encrypt / Cloudflare) |
| CORS | Restricted origins in `AllowedOrigins` config |
| Rate Limiting | Per-IP, 100 req/min default (configurable) |
| Auth | ASP.NET Core Identity + Cookie Authentication |
| Headers | SecurityHeadersMiddleware (CSP, HSTS, X-Frame-Options) |
| Input Validation | Pydantic-style model validation in controllers |
| Password Policy | Min 6 chars, requires uppercase + digit + special char |

---

## Performance Requirements

| Metric | Target |
|--------|--------|
| API Response (p95) | < 500ms |
| Frontend LCP | < 2.5s |
| Frontend FID | < 100ms |
| Frontend CLS | < 0.1 |
| Concurrent Users | 100+ (single VPS) |
| Database Size | Up to 1 GB (SQLite) |

---

*Last updated: 2026-03-06*
