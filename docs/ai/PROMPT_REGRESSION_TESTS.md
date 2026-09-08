# Prompt Regression Tests — Phase 10

Verified 2026-09-08. **None exist anywhere in this repository.**

A repo-wide search for prompt-snapshot tests, golden-output comparisons, or any test file
referencing a fixed prompt+expected-output pair returned zero results across all 6 portals. The 153
real test files in sohamyoga-frontend (Phase 6 finding) cover domain logic, API routes, and e2e
flows — none test prompt behavior or AI output stability.

## Why this matters (concretely, not generically)

`promptBuilder.ts` (voice-agent-platform, builds the Vapi assistant's system prompt from call
script sections) and the Research-AI Draft Job's prompt construction are the two most
business-critical prompt-construction points found in this audit — a silent prompt regression in
either would degrade a real customer-facing conversation (voice-agent-platform) or produce
ungrounded research content that the fact-check gate might or might not catch depending on the
specific error mode. Neither has any regression protection today.

## Proposed minimal approach (not implemented)

Given no eval framework exists yet either (see EVAL_FRAMEWORK.md), prompt regression testing is
correctly sequenced *after* establishing basic output logging, not before — testing for regression
requires a baseline to regress from, and no baseline (logged historical outputs with quality labels)
currently exists in a reusable form. Recommend: (1) start logging real outputs from
`promptBuilder.ts` and the Research-AI Draft Job (near-zero effort, pure logging), (2) once a body of
real examples exists, snapshot a representative set as the first regression baseline. Skipping
straight to "write prompt tests" without this groundwork would produce tests that assert against
arbitrary, unvalidated snapshots rather than known-good behavior.
