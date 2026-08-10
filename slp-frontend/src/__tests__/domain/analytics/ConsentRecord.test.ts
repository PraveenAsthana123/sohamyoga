import { describe, it, expect } from "@jest/globals";
import { ConsentRecord, CONSENT_HIERARCHY, type ConsentLevel } from "../../../domain/analytics/ConsentRecord";

const NOW    = new Date("2026-08-05T10:00:00Z");
const LATER  = new Date("2026-08-05T11:00:00Z");
const FUTURE = new Date("2027-01-01T00:00:00Z");

function makeConsent(overrides: Partial<ConstructorParameters<typeof ConsentRecord>[0]> = {}): ConsentRecord {
  return new ConsentRecord({
    id: "cr-1",
    anonymousId: "anon-abc",
    level: "analytics",
    granted: true,
    grantedAt: NOW,
    ipHash: "sha256-abc123",
    userAgent: "Mozilla/5.0",
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  });
}

// ── Construction validation ───────────────────────────────────────────────────

describe("ConsentRecord — construction", () => {
  it("creates a valid consent record", () => {
    const c = makeConsent();
    expect(c.id).toBe("cr-1");
    expect(c.level).toBe("analytics");
    expect(c.granted).toBe(true);
  });

  it("throws when id is missing", () => {
    expect(() => makeConsent({ id: "" })).toThrow("id is required");
  });

  it("throws when anonymousId is missing", () => {
    expect(() => makeConsent({ anonymousId: "" })).toThrow("anonymousId is required");
  });

  it("throws when ipHash is missing", () => {
    expect(() => makeConsent({ ipHash: "" })).toThrow("ipHash is required");
  });

  it("throws when userAgent is missing", () => {
    expect(() => makeConsent({ userAgent: "" })).toThrow("userAgent is required");
  });

  it("throws when granted=true but grantedAt is missing", () => {
    expect(() => makeConsent({ granted: true, grantedAt: undefined })).toThrow("grantedAt required");
  });

  it("throws when revokedAt set without grantedAt", () => {
    expect(() => makeConsent({ granted: false, grantedAt: undefined, revokedAt: LATER })).toThrow("cannot revoke without");
  });

  it("throws when revokedAt <= grantedAt", () => {
    expect(() => makeConsent({ granted: false, grantedAt: NOW, revokedAt: NOW })).toThrow("revokedAt must be after grantedAt");
  });

  it("accepts valid revoked record (revokedAt > grantedAt)", () => {
    const c = makeConsent({ granted: false, grantedAt: NOW, revokedAt: LATER });
    expect(c.revokedAt).toEqual(LATER);
  });

  it("accepts optional userId", () => {
    expect(makeConsent({ userId: "user-1" }).userId).toBe("user-1");
  });
});

// ── CONSENT_HIERARCHY ─────────────────────────────────────────────────────────

describe("CONSENT_HIERARCHY", () => {
  it("none is the weakest level (index 0)", () => {
    expect(CONSENT_HIERARCHY.indexOf("none")).toBe(0);
  });

  it("all is the strongest level (last)", () => {
    expect(CONSENT_HIERARCHY.indexOf("all")).toBe(CONSENT_HIERARCHY.length - 1);
  });

  it("analytics comes after essential", () => {
    expect(CONSENT_HIERARCHY.indexOf("analytics")).toBeGreaterThan(CONSENT_HIERARCHY.indexOf("essential"));
  });

  it("marketing comes after analytics", () => {
    expect(CONSENT_HIERARCHY.indexOf("marketing")).toBeGreaterThan(CONSENT_HIERARCHY.indexOf("analytics"));
  });
});

// ── isGranted ─────────────────────────────────────────────────────────────────

describe("isGranted()", () => {
  it("true when level meets required", () => {
    expect(makeConsent({ level: "analytics" }).isGranted("analytics")).toBe(true);
  });

  it("true when level exceeds required", () => {
    expect(makeConsent({ level: "all" }).isGranted("analytics")).toBe(true);
  });

  it("false when level is below required", () => {
    expect(makeConsent({ level: "essential" }).isGranted("analytics")).toBe(false);
  });

  it("false when not granted", () => {
    expect(makeConsent({ granted: false, grantedAt: NOW, revokedAt: LATER }).isGranted("analytics")).toBe(false);
  });

  it("false when revoked", () => {
    const c = makeConsent({ granted: false, revokedAt: LATER });
    expect(c.isGranted("essential")).toBe(false);
  });

  const levels: ConsentLevel[] = ["none", "essential", "analytics", "marketing", "all"];
  it.each(levels)("isGranted('none') always false when level=%s and revoked", level => {
    const c = makeConsent({ level, granted: false, revokedAt: LATER });
    expect(c.isGranted("none")).toBe(false);
  });
});

// ── isRevoked ─────────────────────────────────────────────────────────────────

describe("isRevoked()", () => {
  it("false when not revoked", () => {
    expect(makeConsent().isRevoked()).toBe(false);
  });

  it("true when revokedAt is set", () => {
    expect(makeConsent({ granted: false, revokedAt: LATER }).isRevoked()).toBe(true);
  });
});

// ── canCollect helpers ────────────────────────────────────────────────────────

describe("canCollect helpers", () => {
  it("canCollectAnalytics true for analytics level", () => {
    expect(makeConsent({ level: "analytics" }).canCollectAnalytics()).toBe(true);
  });

  it("canCollectAnalytics false for essential level", () => {
    expect(makeConsent({ level: "essential" }).canCollectAnalytics()).toBe(false);
  });

  it("canCollectMarketing true for marketing level", () => {
    expect(makeConsent({ level: "marketing" }).canCollectMarketing()).toBe(true);
  });

  it("canCollectMarketing false for analytics level", () => {
    expect(makeConsent({ level: "analytics" }).canCollectMarketing()).toBe(false);
  });

  it("canCollectMarketing true for all level", () => {
    expect(makeConsent({ level: "all" }).canCollectMarketing()).toBe(true);
  });
});

// ── grant() ───────────────────────────────────────────────────────────────────

describe("grant()", () => {
  it("sets level, granted=true, grantedAt", () => {
    const c = makeConsent({ level: "essential", granted: false, grantedAt: undefined }).grant("analytics", NOW);
    expect(c.level).toBe("analytics");
    expect(c.granted).toBe(true);
    expect(c.grantedAt).toEqual(NOW);
  });

  it("clears revokedAt on re-grant", () => {
    const revoked = makeConsent({ granted: false, revokedAt: LATER });
    const regranted = revoked.grant("analytics", FUTURE);
    expect(regranted.revokedAt).toBeUndefined();
  });

  it("does not mutate original", () => {
    const c = makeConsent({ level: "essential", granted: false, grantedAt: undefined });
    c.grant("analytics", NOW);
    expect(c.granted).toBe(false);
  });
});

// ── revoke() ──────────────────────────────────────────────────────────────────

describe("revoke()", () => {
  it("sets granted=false and revokedAt", () => {
    const c = makeConsent().revoke(LATER);
    expect(c.granted).toBe(false);
    expect(c.revokedAt).toEqual(LATER);
  });

  it("throws when not granted", () => {
    expect(() => makeConsent({ granted: false, grantedAt: NOW, revokedAt: LATER }).revoke(FUTURE))
      .toThrow("already revoked");
  });

  it("throws when consent was never granted", () => {
    expect(() => makeConsent({ granted: false, grantedAt: undefined, revokedAt: undefined }).revoke(NOW))
      .toThrow("cannot revoke a consent that was not granted");
  });
});

// ── upgrade() ─────────────────────────────────────────────────────────────────

describe("upgrade()", () => {
  it("moves to a higher consent level", () => {
    const c = makeConsent({ level: "analytics" }).upgrade("all", LATER);
    expect(c.level).toBe("all");
  });

  it("throws when upgrading to same level", () => {
    expect(() => makeConsent({ level: "analytics" }).upgrade("analytics", LATER)).toThrow("upgrade requires a higher");
  });

  it("throws when upgrading to a lower level", () => {
    expect(() => makeConsent({ level: "analytics" }).upgrade("essential", LATER)).toThrow("upgrade requires a higher");
  });
});

// ── downgrade() ───────────────────────────────────────────────────────────────

describe("downgrade()", () => {
  it("moves to a lower consent level", () => {
    const c = makeConsent({ level: "all" }).downgrade("analytics", LATER);
    expect(c.level).toBe("analytics");
  });

  it("throws when downgrading to same level", () => {
    expect(() => makeConsent({ level: "analytics" }).downgrade("analytics", LATER)).toThrow("downgrade requires a lower");
  });

  it("throws when downgrading to higher level", () => {
    expect(() => makeConsent({ level: "analytics" }).downgrade("all", LATER)).toThrow("downgrade requires a lower");
  });
});

// ── identify() ────────────────────────────────────────────────────────────────

describe("identify()", () => {
  it("sets userId", () => {
    expect(makeConsent().identify("user-1", LATER).userId).toBe("user-1");
  });

  it("throws when userId is empty", () => {
    expect(() => makeConsent().identify("", LATER)).toThrow("userId is required");
  });

  it("does not mutate original", () => {
    const c = makeConsent();
    c.identify("u1", LATER);
    expect(c.userId).toBeUndefined();
  });
});
