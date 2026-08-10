# Multi-tenant marketing automation

The admin page at `/admin/marketing-command` is the control centre for tenant business profiles, local Ollama models, publishing channels, campaign assets, scheduling, and workflow status.

## Start

Set production-safe values for `POSTGRES_PASSWORD`, `ADMIN_EMAIL`, and `ADMIN_PASSWORD`, then run:

```bash
docker compose up -d --build postgres cron backend frontend
```

PostgreSQL initializes the foundation, social, and marketing-automation schemas on a new volume. The cron container runs the registry in UTC and processes `marketing_automation_request` rows every two minutes.

## Credentials and tokens

- Ollama is local and requires no API token.
- YouTube requires a Google Cloud project, YouTube Data API v3, OAuth consent configuration, and an OAuth refresh token.
- Other social networks require their respective developer apps. Postiz is the default publishing adapter.
- Credential values must be stored in the configured secret manager. Database rows store only credential references and connection status.

Enabling a channel does not publish anything. A channel must also have a connected developer account, and generated assets enter `review_required` before scheduling or publishing.

## Workflow

1. An admin creates a B2C or B2B tenant and its default organization.
2. The tenant saves an industry profile such as Yoga or Dental.
3. The admin enables installed Ollama models and publishing channels.
4. A user submits a campaign brief with required assets and a schedule.
5. The cron worker uses Ollama to create copy, banner prompts, and a video script.
6. Generated assets wait for administrator approval.
7. Rendering and publishing adapters send approved assets to connected providers.
8. Provider identifiers, failures, and analytics remain tenant-scoped in PostgreSQL.

The current worker completes steps 1–6. Actual image/video rendering and YouTube/social upload require configured provider credentials and adapter execution; the system intentionally does not simulate successful publication.
