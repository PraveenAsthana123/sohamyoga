# Network Flow · {{PROJECT_NAME}} · Deployment Topology

> Container topology + port map + service-to-service connections + external integrations + data-flow boundaries.

## Container topology

```mermaid
graph TB
    subgraph "Host (Linux/AWS/GCP)"
        subgraph "Docker network: insur_default"
            FE[frontend<br/>:3210 → :3000]
            BE[backend<br/>:8001 → :8000]
            PG[(postgres<br/>:5432)]
            RD[(redis<br/>:6379)]
            ML[ollama<br/>:11434]
            MLF[mlflow<br/>:5001 → :5000]
            WK[worker<br/>celery]
        end
        Reverse[NGINX/Traefik<br/>:80 :443]
    end

    User[Internet User]
    Vendor[3rd-Party API]

    User -->|HTTPS :443| Reverse
    Reverse -->|HTTP :3000| FE
    Reverse -->|HTTP :8000| BE
    FE -->|REST| BE
    BE -->|TCP 5432| PG
    BE -->|TCP 6379| RD
    BE -->|HTTP 11434| ML
    BE -->|HTTP 5000| MLF
    WK -->|TCP 6379| RD
    WK -->|TCP 5432| PG
    WK -->|HTTPS| Vendor
```

## Port map (host:container)

| Service | Host port | Container port | Purpose |
|---|---|---|---|
| Frontend (Vite) | 3210 | 3000 | UI |
| Backend (FastAPI) | 8001 | 8000 | REST API |
| Postgres | 5432 | 5432 | Primary DB |
| Redis | 6379 | 6379 | Cache + queue |
| Ollama | 11434 | 11434 | LLM inference |
| MLflow | 5001 | 5000 | Experiment tracking |
| Reverse proxy | 80, 443 | 80, 443 | Public entrypoint |

## Service-to-service connections

| From | To | Protocol | Auth | Encryption |
|---|---|---|---|---|
| Frontend | Backend | HTTP/REST | Bearer token | TLS (prod) · plain (dev) |
| Backend | Postgres | TCP/SQL | Username+pwd in env | TLS optional |
| Backend | Redis | TCP/RESP | AUTH password | None (private net) |
| Backend | Ollama | HTTP | None (private) | None |
| Backend | MLflow | HTTP | None | None |
| Worker | Postgres | TCP/SQL | Same as backend | Same |
| Worker | Redis | TCP/RESP | Same as backend | Same |
| Worker | 3rd-party | HTTPS | OAuth2/API key | TLS |

## External integrations

| External | Purpose | Auth | Data sensitivity |
|---|---|---|---|
| Stripe / payment | Billing | API key | PCI-DSS scope |
| SendGrid / email | Notifications | API key | PII (email addresses) |
| 3rd-party AI | Optional model | OAuth2 | Prompt content (redacted) |
| OAuth provider | User login | OAuth2 client | User PII |

## Data-flow boundaries (where PII enters/exits)

```mermaid
graph LR
    User[User] -->|PII: name, email, etc.| FE[Frontend]
    FE -->|PII over TLS| BE[Backend]
    BE -->|PII encrypted at rest| PG[(Postgres)]
    BE -.->|PII redacted before sending| ML[ML Service]
    BE -->|Audit-log every PII access| Audit[(Audit Log)]
    BE -->|Only aggregate metrics| MLF[(MLflow)]

    style PG fill:#fee,stroke:#c00
    style Audit fill:#fee,stroke:#c00
```

## Failure / DR considerations

- **Postgres**: primary + read replica · daily backup to S3 · RPO 1h
- **Redis**: AOF persistence · RPO 1s
- **Backend**: stateless · horizontal scaling
- **Frontend**: CDN-cached static · zero state
- **Worker**: idempotent tasks · retry on failure

## Composes with

§47 (architecture · network is a C4 deployment view) · §76 (privacy · data-flow boundaries) · §86 (this standard).
