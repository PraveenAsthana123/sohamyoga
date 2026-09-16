# AI / Model Standard — sohamyoga Platform

> **Version:** 2.0.0 · **Mandatory for all AI features**

## Model Registry (approved models)

| Model | Provider | Use Case | Privacy | Cost |
|-------|----------|----------|---------|------|
| `llama3.2` | Ollama (local) | Content generation, adaptation, classification, summarization | ✅ Local — no egress | Free |
| `nomic-embed-text` | Ollama (local) | Semantic embeddings, vector search | ✅ Local | Free |
| `llama3.1` | Ollama (local) | Complex multi-step reasoning | ✅ Local | Free |
| `gpt-4o` | OpenAI | Cloud fallback, high-complexity tasks | ⚠️ Data egress | Paid |
| `claude-3-5-sonnet` | Anthropic | Cloud fallback | ⚠️ Data egress | Paid |

**Default: always use local Ollama first. Cloud only when API key explicitly configured.**

## LangChain / LangGraph Architecture

```
User Request
    │
    ▼
Supervisor Agent (LangGraph router)
    │
    ├── ContentAgent (generate_social_post, adapt_content_for_platform)
    ├── AnalyticsAgent (analyze_platform_performance, get_best_posting_time)
    ├── ReviewAgent (classify_review_sentiment)
    └── SchedulingAgent (get_best_posting_time)
              │
              ▼
         Ollama llama3.2
              │
              ▼
         LangSmith (trace every run)
              │
              ▼
         agent_run SQLite table + admin dashboard
```

## Prompt Engineering Standard

### Required Prompt Structure

```python
# Every production prompt MUST include:
prompt = f"""
Role: You are a {role} specializing in {domain}.
Task: {specific_task_description}
Input: {sanitized_input}
Constraints:
  - Output format: {format}  # JSON / markdown / plain text
  - Max length: {max_chars} characters
  - Language: Professional English
  - Do NOT include: PII, competitor URLs, internal system details
Output:
"""
```

### Platform-Specific Content Adaptation

```typescript
const PLATFORM_CONSTRAINTS = {
  twitter:   { maxChars: 280,   tone: 'casual, punchy',        hashtags: '1-2' },
  linkedin:  { maxChars: 3000,  tone: 'professional',          hashtags: '0-3' },
  instagram: { maxChars: 2200,  tone: 'visual, inspiring',     hashtags: '5-10' },
  facebook:  { maxChars: 63206, tone: 'friendly, community',   hashtags: '1-3' },
  tiktok:    { maxChars: 2200,  tone: 'energetic, trend-aware', hashtags: '3-5' },
  whatsapp:  { maxChars: 4096,  tone: 'personal, direct',      hashtags: '0' },
  medium:    { maxChars: 100000, tone: 'thoughtful, detailed',  hashtags: '0' },
  reddit:    { maxChars: 40000, tone: 'authentic, community',   hashtags: '0' },
};
```

## Output Evaluation Framework

### Scoring Rubric (log to ai_governance_log)

```typescript
interface AIOutputEvaluation {
  confidence_score: number;    // 0.00-1.00 — model's self-reported confidence
  fairness_score: number;      // 0.00-1.00 — demographic/cultural bias check
  explainability_score: number; // 0.00-1.00 — can we explain why this output?
  relevance_score: number;     // 0.00-1.00 — output addresses the task
  safety_score: number;        // 0.00-1.00 — no harmful/manipulative content
}

// Thresholds
const THRESHOLDS = {
  auto_approve:  { confidence: 0.85, fairness: 0.80, safety: 0.90 },
  human_review:  { confidence: 0.70, fairness: 0.75, safety: 0.80 },
  auto_reject:   { confidence: 0.50, fairness: 0.60, safety: 0.70 }, // below = reject
};
```

### Hallucination Detection

```typescript
// Check for hallucinated URLs/citations in output
function detectHallucinations(output: string): string[] {
  const urlPattern = /https?:\/\/[^\s]+/g;
  const urls = output.match(urlPattern) ?? [];
  // Flag any URL not in our known-good domain list
  return urls.filter(url => !KNOWN_SAFE_DOMAINS.some(d => url.includes(d)));
}

// Check for invented statistics
const STAT_PATTERN = /\d+(\.\d+)?%|\$\d+[BMK]?|\d+ (million|billion)/g;
// Any statistic in AI output must be sourced or labeled "estimated"
```

## Training & Fine-tuning Standard

```
Current models are pre-trained (no custom fine-tuning):
  - llama3.2: Meta's base model, no sohamyoga-specific fine-tuning
  - nomic-embed-text: Nomic's base embedding model

IF fine-tuning is ever implemented:
  1. Training data MUST be sourced from verified, licensed datasets only
  2. No customer PII in training data
  3. Bias evaluation BEFORE deployment (fairness audit on held-out test set)
  4. Model card written documenting: training data, intended use, limitations
  5. A/B test new model vs baseline for 14 days before full rollout
  6. Rollback plan documented before deployment
```

## Performance Benchmarks

### Current Baseline (llama3.2 on this machine)

| Task | p50 Latency | p95 Latency | Tokens/sec |
|------|-------------|-------------|------------|
| Short content (280 chars) | ~1.2s | ~2.5s | ~45 |
| Platform adaptation (5 platforms) | ~8s | ~15s | ~40 |
| Sentiment classification | ~0.8s | ~1.5s | ~50 |
| Report generation (600 words) | ~12s | ~20s | ~42 |
| Embedding generation | ~0.3s | ~0.8s | N/A |

### SLO Enforcement

- All AI routes: 30-second hard timeout (AbortController)
- Graceful degradation: return `[AI unavailable]` on timeout — never crash the request
- Circuit breaker: if Ollama fails 5 consecutive times → return cached/default response for 60s

## Responsible AI Implementation Checklist

For every AI feature before shipping:

```
[ ] UI labels AI-generated content ("✨ AI-generated" badge)
[ ] Human can edit/override every AI output before it's used
[ ] Input logged to ai_governance_log (sanitized — no PII)
[ ] Output logged to ai_governance_log
[ ] Confidence score captured and logged
[ ] Fairness check run on generated content
[ ] 30-second timeout with graceful fallback implemented
[ ] Hallucination detection run on any factual claims
[ ] PII not present in prompt (verified with regex scan)
[ ] Output sanitized through sanitizeInput() before storage/display
[ ] Feature tested with edge case: Ollama down → graceful degradation
```

## LangSmith Observability

Every production agent run is traced in LangSmith when `LANGCHAIN_API_KEY` is set:

```bash
# Required env vars for LangSmith tracing
LANGCHAIN_TRACING_V2=true
LANGCHAIN_API_KEY=<your_key_from_smith.langchain.com>
LANGCHAIN_PROJECT=sohamyoga-ai-platform
LANGCHAIN_ENDPOINT=https://api.smith.langchain.com
```

When not configured: tracing silently disabled — no crashes, no warnings to users.  
Admin visibility: `/admin/agent-supervisor` Tab 5 shows LangSmith link per run.
