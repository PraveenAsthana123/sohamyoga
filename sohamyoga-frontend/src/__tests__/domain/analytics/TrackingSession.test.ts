import { describe, it, expect } from "@jest/globals";
import { TrackingSession, type SessionDevice } from "../../../domain/analytics/TrackingSession";

const NOW    = new Date("2026-08-05T10:00:00Z");
const LATER  = new Date("2026-08-05T10:30:00Z");  // 30 min later
const FUTURE = new Date("2027-01-01T00:00:00Z");

const DEVICE: SessionDevice = {
  type: "desktop", browser: "Chrome", os: "macOS",
  screenWidth: 1920, screenHeight: 1080,
};

function makeSession(overrides: Partial<ConstructorParameters<typeof TrackingSession>[0]> = {}): TrackingSession {
  return new TrackingSession({
    id: "sess-1",
    anonymousId: "anon-abc",
    status: "active",
    startedAt: NOW,
    lastSeenAt: NOW,
    pageCount: 1,
    eventCount: 2,
    device: DEVICE,
    landingUrl: "https://sohamyoga.ca/",
    ...overrides,
  });
}

// ── Construction validation ──────────────────────────────────────────────────

describe("TrackingSession — construction", () => {
  it("creates a valid session", () => {
    const s = makeSession();
    expect(s.id).toBe("sess-1");
    expect(s.status).toBe("active");
  });

  it("throws when id is missing", () => {
    expect(() => makeSession({ id: "" })).toThrow("id is required");
  });

  it("throws when anonymousId is missing", () => {
    expect(() => makeSession({ anonymousId: "" })).toThrow("anonymousId is required");
  });

  it("throws when landingUrl is missing", () => {
    expect(() => makeSession({ landingUrl: "" })).toThrow("landingUrl is required");
  });

  it("throws when pageCount < 0", () => {
    expect(() => makeSession({ pageCount: -1 })).toThrow("pageCount must be >= 0");
  });

  it("throws when eventCount < 0", () => {
    expect(() => makeSession({ eventCount: -1 })).toThrow("eventCount must be >= 0");
  });

  it("throws when endedAt <= startedAt", () => {
    expect(() => makeSession({ endedAt: NOW })).toThrow("endedAt must be after startedAt");
  });

  it("throws when scrollDepthPct < 0", () => {
    expect(() => makeSession({ scrollDepthPct: -1 })).toThrow("scrollDepthPct must be 0–100");
  });

  it("throws when scrollDepthPct > 100", () => {
    expect(() => makeSession({ scrollDepthPct: 101 })).toThrow("scrollDepthPct must be 0–100");
  });

  it("accepts valid endedAt after startedAt", () => {
    const s = makeSession({ endedAt: LATER, status: "ended" });
    expect(s.endedAt).toEqual(LATER);
  });

  it("accepts optional userId", () => {
    expect(makeSession({ userId: "u1" }).userId).toBe("u1");
  });

  it("device getter returns copy", () => {
    const s = makeSession();
    const d = s.device;
    (d as Record<string, unknown>)["browser"] = "hacked";
    expect(s.device.browser).toBe("Chrome");
  });
});

// ── Predicates ───────────────────────────────────────────────────────────────

describe("TrackingSession — predicates", () => {
  it("isActive true for active status", () => {
    expect(makeSession({ status: "active" }).isActive()).toBe(true);
  });

  it("isActive false for idle", () => {
    expect(makeSession({ status: "idle" }).isActive()).toBe(false);
  });

  it("isEnded true for ended status", () => {
    expect(makeSession({ status: "ended", endedAt: LATER }).isEnded()).toBe(true);
  });

  it("isAuthenticated false without userId", () => {
    expect(makeSession().isAuthenticated()).toBe(false);
  });

  it("isAuthenticated true with userId", () => {
    expect(makeSession({ userId: "u1" }).isAuthenticated()).toBe(true);
  });

  it("isBounce true when pageCount=1 and ended", () => {
    expect(makeSession({ pageCount: 1, status: "ended", endedAt: LATER }).isBounce()).toBe(true);
  });

  it("isBounce false when pageCount > 1", () => {
    expect(makeSession({ pageCount: 3 }).isBounce()).toBe(false);
  });

  it("replayAvailable defaults to false", () => {
    expect(makeSession().replayAvailable).toBe(false);
  });

  it("replayAvailable true when set", () => {
    expect(makeSession({ replayAvailable: true }).replayAvailable).toBe(true);
  });
});

// ── durationSeconds ───────────────────────────────────────────────────────────

describe("durationSeconds()", () => {
  it("returns 0 when endedAt equals startedAt (via lastSeenAt=startedAt)", () => {
    expect(makeSession().durationSeconds()).toBe(0);
  });

  it("calculates from startedAt to endedAt when ended", () => {
    const s = makeSession({ endedAt: LATER, status: "ended" });
    expect(s.durationSeconds()).toBe(1800); // 30 min
  });

  it("uses provided 'at' param when session is still active", () => {
    expect(makeSession().durationSeconds(LATER)).toBe(1800);
  });

  it("falls back to lastSeenAt when no endedAt and no at param", () => {
    const s = makeSession({ lastSeenAt: LATER });
    expect(s.durationSeconds()).toBe(1800);
  });

  it("never returns negative", () => {
    expect(makeSession().durationSeconds()).toBeGreaterThanOrEqual(0);
  });
});

// ── durationMinutes ───────────────────────────────────────────────────────────

describe("durationMinutes()", () => {
  it("returns 30 for 30-minute session", () => {
    const s = makeSession({ endedAt: LATER, status: "ended" });
    expect(s.durationMinutes()).toBe(30);
  });
});

// ── trafficSource ─────────────────────────────────────────────────────────────

describe("trafficSource()", () => {
  it("direct when no referrer and no utmSource", () => {
    expect(makeSession().trafficSource()).toBe("direct");
  });

  it("email when utmMedium=email", () => {
    expect(makeSession({ utmMedium: "email" }).trafficSource()).toBe("email");
  });

  it("paid when utmMedium=cpc", () => {
    expect(makeSession({ utmMedium: "cpc" }).trafficSource()).toBe("paid");
  });

  it("paid when utmMedium=ppc", () => {
    expect(makeSession({ utmMedium: "ppc" }).trafficSource()).toBe("paid");
  });

  it("social when utmMedium=social", () => {
    expect(makeSession({ utmMedium: "social" }).trafficSource()).toBe("social");
  });

  it("social when utmSource=instagram", () => {
    expect(makeSession({ utmSource: "instagram" }).trafficSource()).toBe("social");
  });

  it("social when utmSource=facebook", () => {
    expect(makeSession({ utmSource: "facebook" }).trafficSource()).toBe("social");
  });

  it("search when utmSource=google", () => {
    expect(makeSession({ utmSource: "google" }).trafficSource()).toBe("search");
  });

  it("search when referrer contains google.", () => {
    expect(makeSession({ referrer: "https://www.google.ca/search?q=yoga" }).trafficSource()).toBe("search");
  });

  it("referral for unknown referrer", () => {
    expect(makeSession({ referrer: "https://example.com" }).trafficSource()).toBe("referral");
  });
});

// ── State machine ─────────────────────────────────────────────────────────────

describe("TrackingSession — state machine", () => {
  it("end() sets status=ended with exitUrl and endedAt", () => {
    const s = makeSession().end("/thank-you", LATER);
    expect(s.status).toBe("ended");
    expect(s.exitUrl).toBe("/thank-you");
    expect(s.endedAt).toEqual(LATER);
  });

  it("end() throws if endedAt <= startedAt", () => {
    expect(() => makeSession().end("/bye", NOW)).toThrow("endedAt must be after startedAt");
  });

  it("end() throws when already ended", () => {
    const s = makeSession({ status: "ended", endedAt: LATER });
    expect(() => s.end("/bye", FUTURE)).toThrow("session already ended");
  });

  it("markIdle() transitions to idle", () => {
    expect(makeSession().markIdle().status).toBe("idle");
  });

  it("markIdle() throws on ended session", () => {
    expect(() => makeSession({ status: "ended", endedAt: LATER }).markIdle()).toThrow("cannot idle an ended session");
  });

  it("resume() transitions to active", () => {
    const s = makeSession({ status: "idle" }).resume(LATER);
    expect(s.status).toBe("active");
    expect(s.lastSeenAt).toEqual(LATER);
  });
});

// ── recordPageView / recordEvent ──────────────────────────────────────────────

describe("recordPageView()", () => {
  it("increments pageCount and eventCount", () => {
    const s = makeSession({ pageCount: 1, eventCount: 2 }).recordPageView(LATER);
    expect(s.pageCount).toBe(2);
    expect(s.eventCount).toBe(3);
  });

  it("updates lastSeenAt", () => {
    expect(makeSession().recordPageView(LATER).lastSeenAt).toEqual(LATER);
  });

  it("does not mutate original", () => {
    const s = makeSession({ pageCount: 1 });
    s.recordPageView(LATER);
    expect(s.pageCount).toBe(1);
  });
});

describe("recordEvent()", () => {
  it("increments eventCount only", () => {
    const s = makeSession({ pageCount: 1, eventCount: 2 }).recordEvent(LATER);
    expect(s.pageCount).toBe(1);
    expect(s.eventCount).toBe(3);
  });
});

// ── updateScrollDepth ─────────────────────────────────────────────────────────

describe("updateScrollDepth()", () => {
  it("sets initial scroll depth", () => {
    expect(makeSession().updateScrollDepth(50).scrollDepthPct).toBe(50);
  });

  it("updates when new depth is greater", () => {
    const s = makeSession({ scrollDepthPct: 40 }).updateScrollDepth(70);
    expect(s.scrollDepthPct).toBe(70);
  });

  it("keeps current depth when new is shallower", () => {
    const s = makeSession({ scrollDepthPct: 80 }).updateScrollDepth(30);
    expect(s.scrollDepthPct).toBe(80);
  });

  it("throws when pct < 0", () => {
    expect(() => makeSession().updateScrollDepth(-1)).toThrow("scrollDepthPct must be 0–100");
  });

  it("throws when pct > 100", () => {
    expect(() => makeSession().updateScrollDepth(101)).toThrow("scrollDepthPct must be 0–100");
  });

  it("accepts exactly 0", () => {
    expect(makeSession().updateScrollDepth(0).scrollDepthPct).toBe(0);
  });

  it("accepts exactly 100", () => {
    expect(makeSession().updateScrollDepth(100).scrollDepthPct).toBe(100);
  });
});

// ── identify ──────────────────────────────────────────────────────────────────

describe("identify()", () => {
  it("sets userId on anonymous session", () => {
    expect(makeSession().identify("user-42").userId).toBe("user-42");
  });

  it("throws when userId is empty", () => {
    expect(() => makeSession().identify("")).toThrow("userId is required");
  });

  it("does not mutate original", () => {
    const s = makeSession();
    s.identify("u1");
    expect(s.userId).toBeUndefined();
  });
});

// ── markReplayAvailable ───────────────────────────────────────────────────────

describe("markReplayAvailable()", () => {
  it("sets replayAvailable to true", () => {
    expect(makeSession().markReplayAvailable().replayAvailable).toBe(true);
  });

  it("does not mutate original", () => {
    const s = makeSession();
    s.markReplayAvailable();
    expect(s.replayAvailable).toBe(false);
  });
});
