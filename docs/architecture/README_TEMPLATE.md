# {{PROJECT_NAME}}

> {{ONE_LINE_DESCRIPTION}}

## Snapshot (per §51.2)

| Field | Value |
|---|---|
| Last updated | YYYY-MM-DD (local TZ + UTC) |
| Location | {{HOSTNAME}} ({{OS}}-{{ARCH}}) |
| Code metrics | LOC: X · Tests: Y · Diagrams: 4 · ADRs: Z |
| Trust signals | `./scripts/project_doctor.sh` · `npm run validate` |
| Standards | §47 ✓ · §51 ✓ · §58 ✓ · §74-§86 ✓ |
| License | MIT / Apache-2.0 / proprietary |

## Quick start (5 commands)

```bash
git clone <repo-url> && cd {{PROJECT_NAME}}
cp .env.template .env && edit .env
docker compose up -d         # OR: pip install -r requirements.txt
./scripts/project_doctor.sh  # verify health
open http://localhost:3210   # frontend
```

## Architecture

See [`docs/architecture/ARCHITECTURE.md`](docs/architecture/ARCHITECTURE.md) for C4 L1 context + L2 containers.

Other diagrams:
- [`docs/architecture/FLOW_DIAGRAM.md`](docs/architecture/FLOW_DIAGRAM.md) — Manual vs Automatic business process flows
- [`docs/architecture/NETWORK_FLOW.md`](docs/architecture/NETWORK_FLOW.md) — Deployment topology + ports
- [`docs/architecture/SEQUENCE_DIAGRAMS.md`](docs/architecture/SEQUENCE_DIAGRAMS.md) — Top 3 user flow sequence diagrams

## Folder structure

```
{{PROJECT_NAME}}/
├── backend/          # FastAPI/Express app
├── frontend/         # React/Next.js app
├── data/             # Datasets, manifests, evaluation outputs
├── docs/             # Architecture, runbooks, ADRs
├── scripts/          # Operational scripts
├── tests/            # Test suites
├── infra/            # Docker, Terraform, K8s
└── docker-compose.yml
```

## Environment variables

See [`.env.template`](.env.template). Required: `{{LIST_KEY_ENV_VARS}}`.

## Running tests

```bash
./scripts/project_doctor.sh    # full health gate
cd frontend && npm test         # frontend unit
pytest backend/tests            # backend unit
npx playwright test             # e2e
```

Note: DB-backed tests skip when Postgres not running.

## Deployment

See [`docs/architecture/NETWORK_FLOW.md`](docs/architecture/NETWORK_FLOW.md). Production deployments use `infra/k8s/` manifests.

## Contributing

PR checklist:
- [ ] `./scripts/project_doctor.sh` passes
- [ ] Lint clean (`npm run lint`)
- [ ] If architectural change: relevant diagram updated
- [ ] If new env var: `.env.template` updated
- [ ] Snapshot section refreshed in this README

## License

{{LICENSE}}
