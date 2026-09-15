# Architecture: Explainable Lead Scoring + Next-Best-Action

Backlog item #6/30.

## Another correction to the original roadmap cross-check

Classified as "not independently confirmed built." Investigation (same
"search before building" discipline applied after the Audience
Intelligence false negative on item #5) found a real, scheduled,
already-working `LeadNurturingJob` (weekly, Friday 06:00 UTC): for each
real active `campaign_lead`, a real Ollama call scores 0-100, classifies
cold/warm/hot, and — critically — the model's own `next_action` text is
stored as `lead_score_reason`. That field IS the roadmap's own
Next-Best-Action concept, already built, with an explicit code comment
confirming the deliberate design: "the score's own explanation (real
Lead Score Explainability, not a separate AI call)." Warm/hot leads
also trigger a real Mautic segment action.

The only real gap: zero admin UI consumed `/api/crm/leads` (which
already returns `score`/`temperature`/`scoreReason` correctly). Built
here.

## What was built

- `/admin/leads`: table of real scored leads (score, temperature,
  next-best-action text), on-demand trigger for the real weekly job via
  the existing generic run-job endpoint.
- Nav link. No new backend — none was needed.

## Live verification

Triggered the real `lead-nurturing` job on demand (real Ollama calls,
~42s for 7 real leads). All 7 real active leads received real, distinct
scores and next-best-action text — not templated copy-paste:
"follow up with an educational content piece", "ask for more details on
the interest in classes", "Send follow-up email", etc. — genuine
per-lead model output. Full log:
`docs/testing/2026-09-14_lead-scoring-log.txt`.

## Deliberately not built

- No lead-score history/trend table — each run overwrites the previous
  score in place; there's no snapshot to show a trend over time.

## Status

Built (backend pre-existing, UI new this session), live-verified. Sixth
of 30 registered backlog items — the second item in a row where the
original cross-check's "not built" verdict was wrong. Before building
each remaining item, this session is now doing a deeper existing-code
search first, not just trusting the original grep-based verdict.
