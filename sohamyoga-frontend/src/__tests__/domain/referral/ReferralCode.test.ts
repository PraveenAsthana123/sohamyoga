import { ReferralCode, ReferralCodeProps } from "../../../domain/referral/ReferralCode";

const FUTURE = new Date("2027-01-01");
const PAST   = new Date("2025-01-01");
const NOW    = new Date("2026-08-05");

function base(overrides: Partial<ReferralCodeProps> = {}): ReferralCodeProps {
  return {
    id: "rc-1",
    code: "PRAVEEN2026",
    referrerId: "user-1",
    referrerType: "customer_customer",
    referralUrl: "https://sohamyoga.ca/register?ref=PRAVEEN2026",
    status: "active",
    usedCount: 0,
    clickCount: 0,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

describe("ReferralCode — construction", () => {
  it("creates a valid code", () => {
    const rc = new ReferralCode(base());
    expect(rc.code).toBe("PRAVEEN2026");
    expect(rc.status).toBe("active");
    expect(rc.usedCount).toBe(0);
    expect(rc.clickCount).toBe(0);
  });

  it("throws on empty id", () => {
    expect(() => new ReferralCode(base({ id: "" }))).toThrow("id is required");
  });

  it("throws on empty code", () => {
    expect(() => new ReferralCode(base({ code: "" }))).toThrow("code is required");
  });

  it("throws on empty referrerId", () => {
    expect(() => new ReferralCode(base({ referrerId: "" }))).toThrow("referrerId is required");
  });

  it("throws on empty referralUrl", () => {
    expect(() => new ReferralCode(base({ referralUrl: "" }))).toThrow("referralUrl is required");
  });

  it("throws on negative usedCount", () => {
    expect(() => new ReferralCode(base({ usedCount: -1 }))).toThrow("usedCount must be >= 0");
  });

  it("throws on negative clickCount", () => {
    expect(() => new ReferralCode(base({ clickCount: -1 }))).toThrow("clickCount must be >= 0");
  });

  it("throws on maxUses < 1", () => {
    expect(() => new ReferralCode(base({ maxUses: 0 }))).toThrow("maxUses must be >= 1");
  });

  it("throws when usedCount exceeds maxUses", () => {
    expect(() => new ReferralCode(base({ maxUses: 5, usedCount: 6 }))).toThrow("usedCount cannot exceed maxUses");
  });

  it("allows usedCount equal to maxUses", () => {
    const rc = new ReferralCode(base({ maxUses: 10, usedCount: 10 }));
    expect(rc.isMaxedOut()).toBe(true);
  });

  it("stores optional campaignId", () => {
    const rc = new ReferralCode(base({ campaignId: "camp-1" }));
    expect(rc.campaignId).toBe("camp-1");
  });
});

describe("ReferralCode — expiry and maxing out", () => {
  it("isExpired returns false when no expiresAt", () => {
    const rc = new ReferralCode(base());
    expect(rc.isExpired(NOW)).toBe(false);
  });

  it("isExpired returns false before expiry date", () => {
    const rc = new ReferralCode(base({ expiresAt: FUTURE }));
    expect(rc.isExpired(NOW)).toBe(false);
  });

  it("isExpired returns true at exact expiry date", () => {
    const rc = new ReferralCode(base({ expiresAt: NOW }));
    expect(rc.isExpired(NOW)).toBe(true);
  });

  it("isExpired returns true after expiry date", () => {
    const rc = new ReferralCode(base({ expiresAt: PAST }));
    expect(rc.isExpired(NOW)).toBe(true);
  });

  it("isMaxedOut false when no maxUses", () => {
    const rc = new ReferralCode(base());
    expect(rc.isMaxedOut()).toBe(false);
  });

  it("isMaxedOut true when usedCount equals maxUses", () => {
    const rc = new ReferralCode(base({ maxUses: 3, usedCount: 3 }));
    expect(rc.isMaxedOut()).toBe(true);
  });

  it("canBeUsed true for active non-expired non-maxed code", () => {
    const rc = new ReferralCode(base({ expiresAt: FUTURE }));
    expect(rc.canBeUsed(NOW)).toBe(true);
  });

  it("canBeUsed false when paused", () => {
    const rc = new ReferralCode(base({ status: "paused" }));
    expect(rc.canBeUsed(NOW)).toBe(false);
  });

  it("canBeUsed false when expired", () => {
    const rc = new ReferralCode(base({ expiresAt: PAST }));
    expect(rc.canBeUsed(NOW)).toBe(false);
  });

  it("canBeUsed false when maxed out", () => {
    const rc = new ReferralCode(base({ maxUses: 1, usedCount: 1 }));
    expect(rc.canBeUsed(NOW)).toBe(false);
  });
});

describe("ReferralCode — click and use", () => {
  it("recordClick increments clickCount", () => {
    const rc = new ReferralCode(base()).recordClick();
    expect(rc.clickCount).toBe(1);
  });

  it("recordClick returns new instance", () => {
    const rc = new ReferralCode(base());
    const rc2 = rc.recordClick();
    expect(rc.clickCount).toBe(0);
    expect(rc2.clickCount).toBe(1);
  });

  it("multiple clicks accumulate", () => {
    let rc = new ReferralCode(base());
    rc = rc.recordClick().recordClick().recordClick();
    expect(rc.clickCount).toBe(3);
  });

  it("recordUse increments usedCount", () => {
    const rc = new ReferralCode(base()).recordUse();
    expect(rc.usedCount).toBe(1);
  });

  it("recordUse is immutable", () => {
    const rc = new ReferralCode(base());
    const rc2 = rc.recordUse();
    expect(rc.usedCount).toBe(0);
    expect(rc2.usedCount).toBe(1);
  });

  it("recordUse throws when paused", () => {
    const rc = new ReferralCode(base({ status: "paused" }));
    expect(() => rc.recordUse()).toThrow("cannot be used");
  });

  it("recordUse throws when expired by date", () => {
    const rc = new ReferralCode(base({ expiresAt: PAST }));
    expect(() => rc.recordUse()).toThrow("cannot be used");
  });

  it("recordUse throws when maxed out", () => {
    const rc = new ReferralCode(base({ maxUses: 2, usedCount: 2 }));
    expect(() => rc.recordUse()).toThrow("cannot be used");
  });
});

describe("ReferralCode — status transitions", () => {
  it("pause changes active to paused", () => {
    const rc = new ReferralCode(base()).pause();
    expect(rc.status).toBe("paused");
  });

  it("pause throws when not active", () => {
    const rc = new ReferralCode(base({ status: "revoked" }));
    expect(() => rc.pause()).toThrow("Only active codes can be paused");
  });

  it("resume changes paused to active", () => {
    const rc = new ReferralCode(base({ status: "paused" })).resume();
    expect(rc.status).toBe("active");
  });

  it("resume throws when not paused", () => {
    const rc = new ReferralCode(base());
    expect(() => rc.resume()).toThrow("Only paused codes can be resumed");
  });

  it("revoke changes any status to revoked", () => {
    expect(new ReferralCode(base()).revoke().status).toBe("revoked");
    expect(new ReferralCode(base({ status: "paused" })).revoke().status).toBe("revoked");
  });

  it("revoke throws when already revoked", () => {
    const rc = new ReferralCode(base({ status: "revoked" }));
    expect(() => rc.revoke()).toThrow("already revoked");
  });

  it("expire changes active to expired", () => {
    const rc = new ReferralCode(base()).expire();
    expect(rc.status).toBe("expired");
  });

  it("expire throws when revoked", () => {
    const rc = new ReferralCode(base({ status: "revoked" }));
    expect(() => rc.expire()).toThrow("Revoked code cannot be expired");
  });

  it("expire throws when already expired", () => {
    const rc = new ReferralCode(base({ status: "expired" }));
    expect(() => rc.expire()).toThrow("already expired");
  });

  it("state machine is immutable throughout", () => {
    const original = new ReferralCode(base());
    original.pause();
    expect(original.status).toBe("active");
  });
});
