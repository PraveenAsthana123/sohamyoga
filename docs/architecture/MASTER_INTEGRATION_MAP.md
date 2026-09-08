# Master Integration Map — Repository-Wide

Every real external integration across all 6 portals, consolidated from Phase 1 per-portal
investigation. Verified 2026-09-08. "Real" = actual client code found; "tested" = live evidence
(API log, DB row, successful call) exists.

| Integration | Portal(s) | Real client code? | Tested live? | Current status |
|---|---|---|---|---|
| Ollama (local LLM) | sohamyoga-frontend, market-research-portal, ai-orchestrator-platform | Yes | Yes — live-confirmed healthy across all 3 | Working |
| OpenAI (cloud LLM) | ai-orchestrator-platform | Yes (via `agentic-ollama-platform`) | Blocked — OpenBao vault dev-mode means keys don't persist | **Currently non-functional** |
| Claude (cloud LLM) | ai-orchestrator-platform | Yes | Blocked — same vault issue; router.py's own comment flags this as a pre-existing known gap | **Currently non-functional** |
| Vapi (voice AI platform) | voice-agent-platform | Yes — real REST client, tenant-isolation guard proven via a real caught incident | Assistant config: yes, proven live. **Call placement/receipt: never exercised** | REAL_BUT_PARTIAL |
| Postiz (self-hosted social scheduler) | sohamyoga-frontend | Yes | No — `POSTIZ_PUBLIC_API_KEY` unset, not deployed in this environment | CODE_EXISTS_NOT_INTEGRATED |
| Telegram/Discord/Mastodon/Bluesky (direct, no Postiz) | sohamyoga-frontend | Yes, readiness-checked per platform | Wired to a real call site as of 2026-09-01 | REAL_BUT_PARTIAL |
| Google Business Profile (reviews) | sohamyoga-frontend | Yes | No — needs Google's manual API-access approval | CODE_EXISTS_NOT_INTEGRATED |
| Google Drive | sohamyoga-frontend | Yes (OAuth-based ingestion) | Not independently re-verified | REAL_BUT_PARTIAL |
| Slack | sohamyoga-frontend | Yes (bearer-token REST + OAuth connector) | Not independently re-verified | REAL_BUT_PARTIAL |
| Skyvern (browser automation) | sohamyoga-frontend | Yes | Container confirmed running | Working |
| OpenBao (secrets vault) | sohamyoga-frontend, ai-orchestrator-platform | Yes | **Runs in ephemeral -dev mode** — a real, live gap, see risk register SEC-01 | Degraded |
| Cal.com (calendar) | voice-agent-platform | Yes | No — `CALCOM_API_KEY` empty, fails closed, never tested against a live account | CONFIG_ONLY |
| Cloudflare quick tunnel | ai-orchestrator-platform | Yes | Yes — confirmed active, though was serving a dead backend during this audit (now fixed) | Working (post-fix) |
| ContextForge (IBM MCP federation) | voice-agent-platform | Yes, real pinned-digest deployment | Yes, per its own decision log: "verified the refusal survives the full proxied path through ContextForge" | Working |
| PSTN telephony (Twilio/Vapi/Plivo/Telnyx) for market-research-portal's voice AI | market-research-portal | **Confirmed NOT wired** — zero references anywhere | N/A | **Not built** — but honestly self-blocked (`status='blocked'`), never faked as working |
| Email/SMS delivery (SMTP/SES/SendGrid/Twilio) for campaigns | market-research-portal, sohamyoga-frontend | Partial — SohamYoga.Web has a real SMTP test endpoint (fails closed, host unconfigured); market-research-portal's Campaign Send always returns `NOT_CONFIGURED` | No | **Not configured anywhere in the repo** — every portal that could send email/SMS honestly reports it can't |
| OpenCV + Tesseract OCR (floor-plan detection) | market-research-portal | Yes — real local subprocess pipeline | Yes — writes confidence/limitations back to DB | Working |
| faster-whisper (local STT) | market-research-portal | Yes | Yes — shared across Voice AI transcription and Spatial Learning voice input | Working |
| espeak-ng + FFmpeg (local TTS/video render) | sohamyoga-frontend, market-research-portal | Yes | Yes — real checksummed MP4 output confirmed | Working |

## Cross-cutting observation

**Every single external SaaS/vendor integration that is currently non-functional is non-functional
for an honest, self-documented reason** (missing credential, unconfigured host, vault outage) —
none of the 6 portals fabricate a working integration when one doesn't exist. This pattern held
across all 6 codebases independently, which is a genuine, verified engineering-discipline finding,
not a coincidence worth understating.

**The one real gap in this discipline** is not a fabrication — it's staleness: `docs/PLATFORM_REFERENCE.md`
in voice-agent-platform was found to describe capabilities as "not built" that had, in fact, been
built since the doc was last updated (Phase 1 finding) — a documentation-currency issue, not an
integrity issue.
