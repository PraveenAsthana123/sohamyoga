# Engineering Provenance — Phase 13

Verified 2026-09-08. Per the framework's instruction: **do not fabricate percentages if git history
cannot prove them.** Where git history can prove something, it's stated as a hard number; where it
can't, it's stated as unverifiable rather than estimated.

## AI-assisted development — git-history-provable

**101 of 110 commits (91.8%) on `main` carry a `Co-Authored-By: Claude` trailer.** This is a direct
`git log` count, not an estimate. This does not mean 91.8% of *code* is AI-written (a commit can be
one line or ten thousand) — it means the large majority of *development sessions* that produced a
commit involved AI co-authorship as a matter of record, consistent with this workspace's documented
practice (project memory: "core objective enterprise marketing suite" note describes ongoing
AI-assisted session-based development).

Individual module-registry entries carry more granular provenance for specific modules — e.g.
`verified_by: 'claude-session-339c0b70'` appears on several market-research-portal rows (Phase 1
export) — a real, queryable per-module attribution field, not a repo-wide estimate.

## Original vs. adapted vs. vendored, by category

| Category | Real examples | Count/scope |
|---|---|---|
| Original custom code | All 57 sohamyoga-frontend domains, all 6 portals' application logic | The large majority of the ~2,800 tracked files in the pushed repo |
| Adapted OSS (thin wrapper around a real library) | `mammoth` (docx→HTML), `pdf-lib`/`pdf-lib`-based exports, `pypdf`/`python-docx`, OpenCV+Tesseract pipeline (market-research-portal), `argon2`/Web Crypto (password-manager) | Real libraries, genuinely invoked, not reimplemented — see Phase 1 findings per portal |
| Vendored OSS, not modified, own git history | `vendor/skyvern` (separate `.git`, untracked by this repo) | Confirmed via `git ls-files` returning 0 for that path |
| Vendored OSS reference/tool collection | `ai-agents/` (52 subdirectories: activepieces, matomo, mautic, comfyui, etc.), `integrations/` (25 subdirectories: medusa, offerkit, paperclip, etc.) | Self-hosted third-party tools this workspace runs alongside its own code, not authored here |
| Client-side libraries via package manager | Bootstrap/jQuery/jQuery-validation under `SohamYoga.Web/wwwroot/lib/` (libman-managed) | 6 files, standard vendored front-end libs |

## Licenses / attribution

**No LICENSE file exists at the repository root** for this project's own original code — a real gap
if this code is ever distributed or open-sourced (not urgent for a private, pre-revenue,
self-funded project per current project memory, but worth noting). The vendored tools under
`ai-agents/`/`integrations/`/`vendor/` each carry their own upstream licenses (not audited
individually in this pass — a real, stated limitation, not claimed as reviewed).

## What this document does NOT claim

No file-by-file "AI-generated vs. human-written vs. human-reviewed" breakdown is provided — git
history proves *commit* co-authorship, not *line-level* authorship, and no tool exists in this repo
to make that finer distinction reliably. Any claim more granular than the 91.8% commit-level figure
above would be fabrication, which this document does not do.
