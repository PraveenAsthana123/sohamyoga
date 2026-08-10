# Flow Diagram · {{PROJECT_NAME}} · Manual vs Automatic

> Per §64.27. For each major business process: manual AS-IS swimlane + automatic TO-BE flow + comparison table.

## Process 1: {{PROCESS_NAME}}

### Manual flow (AS-IS)

```mermaid
graph LR
    A([User submits request]) --> B[Front-desk receives form]
    B --> C{Form complete?}
    C -->|No| B
    C -->|Yes| D[Manual data entry to system]
    D --> E[Manager reviews · approves]
    E --> F{Approved?}
    F -->|No| G[Email user · reject]
    F -->|Yes| H[Process payment manually]
    H --> I[Email confirmation]
    I --> J([Done · 3-5 business days])

    style J fill:#fee
```

### Automatic flow (TO-BE)

```mermaid
graph LR
    A([User submits form]) --> B[Frontend validates]
    B --> C[Backend API receives]
    C --> D[ML model scores · risk tier]
    D --> E{Auto-approve eligible?}
    E -->|Yes · &gt;0.85 confidence| F[Auto-approve · process]
    E -->|No · &lt;0.85| G[Route to human reviewer]
    G --> H[Manager review w/ AI assist]
    H --> I{Decision}
    I -->|Approve| F
    I -->|Reject| J[User notified w/ reason]
    F --> K([Done · &lt;5 minutes])

    style K fill:#efe
```

### Comparison table

| Metric | Manual (AS-IS) | Automatic (TO-BE) | Improvement |
|---|---|---|---|
| Time per instance | 3-5 days | < 5 min | 800-1500x |
| Error rate | 8-12% | 1-2% (auto) · 4-6% (HITL) | 4-6x |
| Cost per instance | $25-40 | $0.05-0.15 | 200x |
| Human touch points | 4-6 | 0-2 | 3x reduction |
| Throughput | 50/day/agent | 10,000/day total | 200x |

## Process 2: {{ADDITIONAL_PROCESS}}

[Repeat above structure for each major business process]

## Composes with

§64.27 (Manual/Automatic flow standard) · §74 (lifecycle Phase 4 use-case definition) · §86 (this standard).
