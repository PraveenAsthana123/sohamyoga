# Sequence Diagrams · {{PROJECT_NAME}} · Top 3 User Flows

> Per §86 doc #5. Top 3 user flows: authentication · primary business flow · error recovery. Mermaid `sequenceDiagram` syntax.

## Flow 1: Authentication / Login

```mermaid
sequenceDiagram
    actor U as User
    participant FE as Frontend
    participant BE as Backend API
    participant DB as Postgres
    participant RD as Redis (session)

    U->>FE: POST /login (email, password)
    FE->>BE: POST /api/v1/auth/login
    BE->>DB: SELECT user WHERE email=?
    DB-->>BE: user row + hashed pwd
    BE->>BE: bcrypt.verify(pwd, hashed)
    alt valid credentials
        BE->>BE: generate JWT (15min) + refresh (7d)
        BE->>RD: SETEX session:{user_id} 900 {jwt}
        BE-->>FE: 200 { jwt, refresh, user }
        FE->>FE: store jwt in memory · refresh in httpOnly cookie
        FE-->>U: redirect to dashboard
    else invalid
        BE->>BE: increment failed_attempts counter
        BE-->>FE: 401 Unauthorized
        FE-->>U: show error
    end
```

## Flow 2: Primary business flow — {{BUSINESS_FLOW_NAME}}

```mermaid
sequenceDiagram
    actor U as User
    participant FE as Frontend
    participant BE as Backend API
    participant ML as ML Service
    participant DB as Postgres
    participant W as Worker (Celery)
    participant ext as 3rd-Party API

    U->>FE: Submit form
    FE->>FE: Client-side validation
    FE->>BE: POST /api/v1/{{resource}}
    BE->>BE: Schema validation
    BE->>DB: INSERT request (pending)
    BE->>ML: POST /score (features)
    ML-->>BE: {risk_score, confidence}

    alt auto-approve (confidence ≥ 0.85)
        BE->>DB: UPDATE status='approved'
        BE->>W: dispatch process_async(id)
        BE-->>FE: 201 { id, status: 'approved' }
        FE-->>U: success page
        W->>ext: POST to vendor
        ext-->>W: confirmation
        W->>DB: UPDATE status='completed'
    else needs review
        BE->>DB: UPDATE status='pending_review'
        BE-->>FE: 202 { id, status: 'pending_review' }
        FE-->>U: "Under review (24-48h)"
    end
```

## Flow 3: Error recovery — payment failure / external API failure

```mermaid
sequenceDiagram
    actor U as User
    participant FE as Frontend
    participant BE as Backend
    participant W as Worker
    participant ext as Payment API
    participant Q as Dead-Letter Queue
    participant Ops as On-Call

    U->>FE: Submit payment
    FE->>BE: POST /api/v1/payments
    BE->>W: dispatch charge_async(payment_id)
    W->>ext: POST /charge
    ext-->>W: 503 timeout

    W->>W: retry 1 (backoff 2s)
    W->>ext: POST /charge (idempotency-key)
    ext-->>W: 503 timeout

    W->>W: retry 2 (backoff 4s)
    W->>ext: POST /charge
    ext-->>W: 503 timeout

    W->>Q: enqueue payment_id to DLQ
    W->>BE: UPDATE payment status='failed_retry'
    BE->>Ops: alert via PagerDuty
    BE->>FE: SSE { payment_failed }
    FE->>U: "Payment delayed · email when resolved"

    Note over Ops,ext: On-call investigates
    Ops->>ext: check vendor status page
    Ops->>Q: requeue when vendor recovered
    Q->>W: dispatch charge_async retry
    W->>ext: POST /charge
    ext-->>W: 200 OK
    W->>BE: UPDATE status='completed'
    BE->>U: email "Payment confirmed"
```

## Composes with

§47 (architecture · sequences are C4 dynamic views) · §57.5 (5-question runbook · flow #3 IS incident response) · §73 (two-menu layout · flows describe its routes) · §86 (this standard).
