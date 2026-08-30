# Voice Agent Platform — Operations MVP

A standalone Next.js + PostgreSQL app for managing the **operations** around
AI voice-agent calling at healthcare clinics (dental, chiropractic,
physiotherapy, ENT, massage therapy): contacts, lead-capture forms, call
scripts, call tracking, and reporting.

This is **not** the rejected 60-phase "enterprise AI voice platform"
architecture (ScoreAI/GovernAI/FinAI/ResilienceAI/etc.) that came out of an
earlier ChatGPT research conversation — that was assessed as wildly
over-scoped for what one voice-agent engineer/consultant needs to run
clinic voice-agent operations, and explicitly rejected. This app is the real,
working MVP instead.

Unrelated to `sohamyoga-frontend` in the same parent directory — different
business, different database, different ports, no shared code.

## What is real (DB-backed, live-tested, not a mockup)

| Area | What's real |
|---|---|
| **Contacts** | `contact` table; full CRUD via `/api/contacts`, admin UI at `/admin/contacts` |
| **Forms** | Admin-defined field-builder forms (`form_definition`), public submission endpoint at `/api/public/forms/[slug]/submit` with real server-side required/email validation, creates a real `contact` row on submit — never a dead-end fake lead |
| **Call scripts** | Versioned scripts (`call_script` + `call_script_version`) per clinic service type (dental/chiropractic/physiotherapy/ent/massage_therapy); editing never overwrites — publishing a new version archives the previous one, full history preserved |
| **Call tracking** | `call_log` table: direction, contact, script version used, status, duration, timestamps, outcome notes, provider. Currently populated exclusively via the manual "Log a call" admin form (`/admin/calls/new`) — real staff recording real call outcomes |
| **Reporting + dashboard** | `/admin` and `/admin/reports` run live SQL aggregates (calls/day, calls by status, form→contact conversion, script usage). Zero data means the page genuinely shows 0 — there is no `DEMO_*`/sample-data fallback anywhere in this codebase |
| **Admin auth** | `admin_user` + `admin_session` tables, scrypt-hashed passwords (Node built-in `crypto`, no extra dependency), httpOnly session cookie. All `/admin/*` pages and all API routes except the public form-submit endpoint require a valid session |

## What is explicitly deferred (and why)

- **Real telephony / STT / LLM / TTS call execution.** The user does not yet
  hold API credentials for Retell AI, Vapi, or Bolna.ai. `src/domain/call/VoiceProviderAdapter.ts`
  defines the adapter interface a real provider would implement, and
  `NotConfiguredVoiceProvider.ts` is the only implementation that exists —
  it **fails closed** with a clear error on every call attempt rather than
  fabricating a fake successful call. The adapter file documents exactly
  what each real provider's implementation would need (API key, agent
  provisioning, webhook reconciliation).
- **The 60-phase enterprise architecture** (ScoreAI, GovernAI, FinAI,
  ResilienceAI, and the other "-AI" suffixed control planes) — explicitly
  out of scope as disproportionate over-engineering for this team's actual
  needs.
- **Kubernetes / microservices / Kafka** or any infrastructure beyond
  Next.js + PostgreSQL + Docker Compose.
- Inbound call webhooks, agent auto-provisioning, and transcript ingestion —
  all depend on a real provider being wired up first.

Nothing above is silently stubbed as if it worked — every deferred piece is
named here and (where relevant) throws/returns an honest error instead of
fake success.

## Tech stack

Next.js 14 (App Router) + TypeScript + Tailwind, PostgreSQL via `pg`,
Docker Compose for the database, the same domain-driven design pattern used
in the sibling `sohamyoga-frontend` project: immutable entity classes
(`props` + getters + state-transition methods returning new instances +
`toJSON()`), numbered SQL migrations applied by a idempotent runner script,
Next.js API routes under `src/app/api/`, admin UI under `src/app/admin/`.

### Ports (deliberately different from sohamyoga-frontend to avoid conflicts)

| Service | Port |
|---|---|
| Postgres (`voiceagent-postgres` container) | host `5438` → container `5432` |
| Next.js dev/start | `8090` |

## Project layout

```
docker-compose.yml            # Postgres only (voiceagent-postgres, port 5438)
scripts/
  migrate.sh                  # numbered SQL migration runner (schema_migration table)
  create-admin.js             # bootstraps/updates an admin_user row (scrypt hash)
src/
  domain/
    admin/       AdminUser.ts, db-schema.sql
    contact/     Contact.ts, repository.ts, db-schema.sql
    form/        FormDefinition.ts, FormSubmission.ts, repository.ts, db-schema.sql
    script/      CallScript.ts, CallScriptVersion.ts, repository.ts, db-schema.sql
    call/        CallLog.ts, repository.ts, VoiceProviderAdapter.ts,
                 NotConfiguredVoiceProvider.ts, db-schema.sql
  lib/           db.ts (pg Pool), auth.ts (scrypt + sessions), requireAdmin.ts
  app/
    api/         auth/*, contacts/*, forms/* (+ public/forms/[slug]/submit),
                 scripts/* (+ publish), calls/*, dashboard
    admin/
      login/                       # public login page
      (protected)/                 # everything else — server-side session gate
        page.tsx                   # dashboard
        contacts/, forms/, scripts/, calls/, reports/
```

## Getting started

```bash
cd voice-agent-platform
cp .env.example .env            # adjust secrets for anything beyond local dev
npm install
docker compose up -d            # starts voiceagent-postgres on :5438
bash scripts/migrate.sh         # applies all 5 numbered migrations
node scripts/create-admin.js you@example.com "a-real-password" "Your Name"
npm run dev                     # http://localhost:8090 -> redirects to /admin/login
```

## Data model summary

- `admin_user` / `admin_session` — admin auth
- `contact` — every person/lead a clinic might call (`status`: new →
  contacted → qualified → customer, or do_not_call/archived)
- `form_definition` / `form_submission` — admin-built lead-capture forms and
  their real submissions; `form_submission.contact_id` links to the real
  `contact` row created on submit
- `call_script` / `call_script_version` — versioned scripts per
  `clinic_service_type` (`dental`, `chiropractic`, `physiotherapy`, `ent`,
  `massage_therapy`); `call_script.published_version_id` points at the
  live version, older published versions are archived, never deleted
- `call_log` — one row per real (currently: manually logged) call;
  `script_version_id` records the exact script version used;
  `provider` is `'manual'` today, ready to hold `'retell'|'vapi'|'bolna'`
  once a real adapter exists

## Verification performed

- `npm run build` passes (Next.js production build, TypeScript strict mode).
- `bash scripts/migrate.sh` applied all 5 migrations against the live
  dockerized Postgres and is idempotent (second run reports `SKIP` for all).
- End-to-end live tests via `curl` against the running dev server: admin
  login issues a real session cookie, unauthenticated requests to every
  admin API route return 401, a public form submission creates a real
  `contact` row, a call script can be authored/published/re-versioned, a
  manually logged call shows up in `/api/dashboard`'s live counts.
