# ADR-0002: Self-hosted VAPID web push instead of a 3rd-party push service

**Status:** Accepted (in effect)

## Context
`package.json` includes `web-push ^3.6.7`. `src/lib/web-push.ts` implements VAPID push directly to
browser push endpoints — no Firebase Cloud Messaging, OneSignal, or similar 3rd-party service.

## Decision
Send push notifications directly via VAPID, self-hosted, with no external push provider dependency
or cost.

## Consequences
- **Positive:** no per-notification cost, no 3rd-party data flow for push payloads.
- **Negative:** the send primitive exists but, as of 2026-09-07, is **not yet wired into**
  `NotificationDispatchJob.ts`'s dispatch branch — this is a disclosed, real gap in the code
  comments, not a hidden one. See [FEATURES.md](../FEATURES.md) for status.
