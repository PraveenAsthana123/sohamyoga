# Session Plan — 2026-08-24

Consolidated plan for everything requested and still open. Each item is
marked **one-time** (a task with a finish line — a cron job doesn't make
sense for it) or **recurring** (genuinely benefits from an ongoing scheduled
job, not just a chat-triggered one-off).

## Completed this session (for reference, not re-doing)

Operations & Failure Tracking (4 layers: DB/API/UI/testing), Paperclip agent
orchestration, Build Status dashboard, email_template + lead entities +
real form-capture loop, self-healing retry worker, STT wired to voice
calls, Ollama agent-role gap analysis, cron/test-schedule/demo-scenario
doc, Kaggle scenario simulation, research paper summary. All individually
verified end-to-end this session, not just typechecked.

## Remaining — one-time tasks

| Task | Plan |
|---|---|
| Extract shared backend code into a package | Move `OllamaClient` + circuit breaker + `api-error-log` pattern (already proven duplicated across both apps) into a shared workspace package |
| Evaluate vector DB need | Answer: is there a real consumer today? (semantic search over research phases, campaign content, etc.) If none, explicitly defer rather than build speculatively |
| Scope ~25-item management feature list | Same honest-gap-check pattern as ads management — most of it is likely greenfield |
| Adversarial review pass | Independent skeptical pass over everything built this session, not self-graded |

## Remaining — recurring (real cron job candidates)

| Task | Why it's recurring, not one-time | Cron job |
|---|---|---|
| Keep Build Status dashboard fresh | Connected-account counts, job-run counts, lead counts all drift daily | Already live-queried on every page load — no job needed, this one's already "recurring" by design |
| Operations & Failure Tracking sweep | Already real | `operations-alert-sweep`, */10 min, already running |
| Self-heal retry | Already real | `self-heal`, */15 min, already running |
| Re-check research paper links for new publications | New AI-marketing papers publish continuously | **New**: could add a monthly job that re-runs the same search and appends new findings to `docs/research-papers/` — only worth building if you want papers tracked ongoing, not as a one-off |

## Honest note on "cron job for each pending task"

The 4 one-time tasks above (shared-package extraction, vector DB evaluation, feature-list scoping, adversarial review) don't have a sensible recurring cadence — they're each a single piece of work with a finish line, not a monitoring loop. Turning them into cron jobs would mean either a job that does nothing most runs, or one that re-does finished work pointlessly. I'm doing them as one-time tasks now instead; the research-paper monthly job above is the one candidate that genuinely fits the "recurring" model if you want it.

Continuing to work the one-time list now, in order.
