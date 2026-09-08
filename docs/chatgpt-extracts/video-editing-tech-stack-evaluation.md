# Extracted: AI Video Editing Tech Stack Evaluation (GitHub/opensource survey)

Source: [ChatGPT shared conversation](https://chatgpt.com/share/6a94ff58-7784-83e8-a3b5-4093f600263b), 89 messages. Extracted via the mandatory `chatgpt_share_extract.py` script.

## What was actually in the conversation

**7 distinct things were typed** by the user across 89 messages — the other 82 are "next" auto-continuations (identical pattern to the other two conversations), generating an increasingly abstract "AI Video Operating System" architecture.

| # | Msg index | Real prompt |
|---|---|---|
| 1 | [1] | "review his github" |
| 2 | [5] | "what else missing? for video editing and usecase" |
| 3 | [7] | "check other github for other topic ..library opensource.." |
| 4 | [11] | "what else missing ..brutal ..top1%" |
| 5 | [13] | "what are the opensource library or github library can help or custom code..." |
| 6 | [17] | "what I can download from net ..list of opensource tool, github, etc" |
| 7 | [21] | "create technical plan for overall first" |

3 of the intervening turns ([2], [8], [14], [18] in the raw array — GitHub-repo browsing calls) came back `"The output of this plugin was redacted"` — genuinely unrecoverable, same pattern as the other two conversations.

## What this conversation actually is

A tech-stack survey for an end-to-end AI video editing pipeline: ingestion → transcription (WhisperX) → noise removal (DeepFilterNet) → scene/object detection (YOLO/SAM/SceneDetect) → agent orchestration (LangGraph) → composition/rendering (**HyperFrames**, OpenCut) → encode (FFmpeg). The response to prompt #7 ([21]/[22]) is the overall technical plan naming these specific tools and arguing for stable interfaces so any one of them (HyperFrames, OpenCut, Whisper, Wan, LangGraph) can be swapped later.

## Verdict: already acted on

This conversation is what prompted the HyperFrames evaluation already carried out this session (`/tmp/.../scratchpad/hyperframes-eval/`): scaffolded a project, added a GSAP fade-in text clip, ran `check`, rendered a real `out.mp4` via the Docker fallback path, and confirmed the local Chrome+FFmpeg pipeline genuinely works. That was scoped as an **isolated technology evaluation**, not production integration — `VideoRenderer.ts` in market-research-portal still uses its own FFmpeg-only pipeline.

Everything else the plan names (WhisperX, DeepFilterNet, YOLO/SAM, SceneDetect, LangGraph, OpenCut) is unevaluated and unbuilt — listed here as open, not silently dropped. No further action was taken from this conversation beyond the HyperFrames spike already completed.
