# Wave 14 — B2C Chat Module Integration Spec

## Stack

| Layer | Tool | Purpose |
|---|---|---|
| Customer Messaging | Chatwoot | Multi-channel inbox, web widget, WhatsApp, Telegram, Email |
| AI Chat Interface | Open WebUI + Ollama | Local LLM endpoint, streaming responses |
| Agent Workflow | LangGraph | Stateful AI/human orchestration, handoff logic |
| Knowledge Search | LlamaIndex + Qdrant | RAG, FAQ retrieval, semantic search |
| Voice / Video | LiveKit | WebRTC consultation sessions |
| Notifications | Novu | Push, email, SMS, WhatsApp notifications |
| Chat Analytics | PostHog | Funnels, session replay, CSAT tracking |
| Automation | Activepieces | No-code workflow triggers (booking confirmations, follow-ups) |

---

## 1. Chatwoot — Customer Messaging Platform

### Integration Points

- **Web Widget** — embed `chatwoot.js` in Next.js layout; configured via `NEXT_PUBLIC_CHATWOOT_TOKEN`
- **API** — REST API at `http://chatwoot:3000/api/v1/` for admin operations (MCP tools)
- **Webhooks** — Chatwoot fires `conversation_created`, `message_created`, `conversation_resolved` → Next.js `/api/chat/webhook`

### Environment Variables

```env
CHATWOOT_API_URL=http://localhost:3000
CHATWOOT_API_TOKEN=<chatwoot-access-token>
CHATWOOT_ACCOUNT_ID=1
NEXT_PUBLIC_CHATWOOT_TOKEN=<widget-token>
NEXT_PUBLIC_CHATWOOT_URL=http://localhost:3000
```

### Webhook Handler — `/api/chat/webhook`

```
POST /api/chat/webhook
Headers: X-Chatwoot-Signature: <hmac>

Events handled:
  conversation_created → notify LangGraph triage
  message_created      → route to AI or agent
  conversation_resolved → trigger CSAT via Novu
  handoff_requested    → assign to available agent
```

---

## 2. Open WebUI + Ollama — Local AI

### Model Routing

| Use Case | Model | Params |
|---|---|---|
| General chat | llama3 8B | temp 0.7 |
| Code/structured | mistral 7B | temp 0.3 |
| RAG answers | llama3 + Qdrant | temp 0.5 |

### Integration

- LangGraph calls `http://ollama:11434/api/generate` directly (or via Open WebUI proxy)
- Open WebUI provides admin UI at port 3000 (separate from Chatwoot)
- Model selection stored in `chat_bot.model` column

---

## 3. LangGraph — Workflow Orchestration

### State Machine

```
[CustomerMessage]
    │
    ▼
[BotTriage] ─── confidence >= threshold ──► [BotReply] ──► [Send via Chatwoot]
    │
    └─ confidence < threshold
    │  OR keyword trigger hit
    │
    ▼
[HumanHandoff]
    │
    ├── agent available? ──► [AssignAgent] ──► [AgentReply]
    └── no agent      ──────► [Snooze + Notify] ──► [Novu: push/email to customer]
```

### Handoff Triggers (from ChatBot domain)

- Confidence < `confidenceThreshold` (default 0.6)
- Keyword in `handoffTriggers[]`: "speak to human", "cancel", "refund", "payment issue"
- Customer explicitly types `/human`
- Bot reaches `maxTurns` without resolution

### Environment Variables

```env
LANGGRAPH_API_URL=http://localhost:8080
OLLAMA_BASE_URL=http://localhost:11434
```

---

## 4. LlamaIndex + Qdrant — RAG Knowledge Search

### Knowledge Base Pipeline

```
1. Ingest: FAQ pages, PDFs, class schedules → LlamaIndex node parser
2. Embed: bge-small-en-v1.5 (local via Ollama) → 384-dim vectors
3. Store: Qdrant collection = "slp_chat_kb"
4. Retrieve: top-k=5, similarity threshold 0.75
5. Augment: inject retrieved context into LangGraph bot prompt
```

### DB Linkage

`chat_knowledge_base.qdrant_collection` = Qdrant collection name  
`chat_bot.knowledge_base_id` = FK to active knowledge base

### Environment Variables

```env
QDRANT_URL=http://localhost:6333
QDRANT_COLLECTION=slp_chat_kb
LLAMAINDEX_EMBED_MODEL=bge-small-en-v1.5
```

---

## 5. LiveKit — Voice & Video Consultations

### Session Flow

```
Customer requests video → /api/chat/livekit/token (POST)
  → server creates LiveKit room token (server SDK)
  → Next.js client uses @livekit/client to join
  → LiveKit Media Server (local docker) handles WebRTC
  → Session recorded if recording_enabled=true
  → Session end → Chatwoot conversation updated with duration
```

### Feature Flags

- `chat.voice_messages` — enabled by feature flag (disabled, rollout 0% in Wave 14)
- `chat.video_consultation` — disabled, rollout 0%

### Environment Variables

```env
LIVEKIT_URL=ws://localhost:7880
LIVEKIT_API_KEY=<api-key>
LIVEKIT_API_SECRET=<api-secret>
```

---

## 6. Novu — Notification Orchestration

### Notification Events

| Event | Trigger | Channels |
|---|---|---|
| `chat.conversation_assigned` | Agent assigned | Push + email to customer |
| `chat.message_received` | New message when tab closed | Push notification |
| `chat.handoff_queued` | No agent available | Email: "We'll be with you soon" |
| `chat.csat_request` | Conversation resolved | Email with CSAT link |
| `chat.bot_escalation` | Bot hands off | In-app notification to agent |

### Environment Variables

```env
NOVU_API_KEY=<novu-api-key>
NOVU_API_URL=http://localhost:3002
```

---

## 7. MCP Tool Registry — Tier Summary

| Tool | Tier | Confirm |
|---|---|---|
| get_conversations | auto | — |
| get_bot_status | auto | — |
| get_conversation | staff | — |
| send_message | staff | — |
| assign_agent | staff | — |
| resolve_conversation | staff | — |
| get_agent_stats | staff | — |
| opt_out_chat_history | customer_confirm | confirmText="OPT_OUT" |
| get_conversation_pii | staff_approval | confirmApprovalId |
| export_conversation | staff_approval | confirmApprovalId |
| update_bot_config | admin | — |
| get_chat_analytics | admin | — |
| delete_conversation_data | admin_destructive | confirmText="DELETE_CONVERSATION" + confirmApprovalId |

---

## 8. Data Privacy & Compliance

### GDPR / PIPEDA Controls

- All PII access logged in `chat_audit` table
- `delete_conversation_data` triggers CASCADE delete across `chat_message`, `chat_handoff`, `chat_notification`
- Chat history export includes legal basis field (GDPR Art 6 / PIPEDA Principle 4)
- Customer opt-out (`opt_out_chat_history`) deletes all messages, preserves aggregate stats only

### Data Retention

- Active conversations: retained indefinitely while open
- Resolved conversations: archived after 90 days (configurable)
- `chat_audit`: retained 7 years (regulatory requirement)
- `chat_notification` delivery records: 1 year

### Analytics Masking

- Same `SENSITIVE_FRAGMENTS` from Wave 13 apply to chat event properties
- Chat events never include: message content, customer name/email in event payload
- PostHog receives only: conversation_id (hashed), channel, status transitions, CSAT score

---

## 9. Next.js API Routes Required

```
POST /api/chat/webhook           ← Chatwoot webhook receiver
POST /api/chat/livekit/token     ← generate LiveKit room token
GET  /api/chat/conversations     ← proxy to Chatwoot API (staff)
POST /api/chat/conversations     ← create conversation
GET  /api/chat/agents            ← agent list + status
POST /api/chat/messages          ← send message via Chatwoot
GET  /api/chat/analytics         ← aggregate from DB views
POST /api/chat/csat              ← submit satisfaction score
POST /api/chat/opt-out           ← GDPR delete own history
```

---

## 10. Docker Services (docker-compose additions)

```yaml
chatwoot:
  image: chatwoot/chatwoot:latest
  ports: ["3000:3000"]
  depends_on: [postgres, redis]

qdrant:
  image: qdrant/qdrant:latest
  ports: ["6333:6333", "6334:6334"]
  volumes: ["qdrant_data:/qdrant/storage"]

livekit:
  image: livekit/livekit-server:latest
  ports: ["7880:7880", "7881:7881"]

novu:
  image: ghcr.io/novuhq/novu:latest
  ports: ["3002:3000"]

langgraph:
  build: ./services/langgraph
  ports: ["8080:8080"]
  environment:
    - OLLAMA_BASE_URL=http://ollama:11434
    - QDRANT_URL=http://qdrant:6333
```
