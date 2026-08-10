import { ReferralReward, ReferralRewardProps } from "../../../domain/referral/ReferralReward";

const FUTURE = new Date("2027-01-01");
const PAST   = new Date("2025-01-01");
const NOW    = new Date("2026-08-05");

function base(overrides: Partial<ReferralRewardProps> = {}): ReferralRewardProps {
  return {
    id: "rr-1",
    referralId: "ref-1",
    referrerId: "user-1",
    referreeId: "user-2",
    type: "wallet_credit",
    value: 25,
    currency: "CAD",
    status: "pending",
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

describe("ReferralReward — construction", () => {
  it("creates a valid reward", () => {
    const r = new ReferralReward(base());
    expect(r.type).toBe("wallet_credit");
    expect(r.value).toBe(25);
    expect(r.status).toBe("pending");
    expect(r.currency).toBe("CAD");
  });

  it("throws on empty id", () => {
    expect(() => new ReferralReward(base({ id: "" }))).toThrow("id is required");
  });

  it("throws on empty referralId", () => {
    expect(() => new ReferralReward(base({ referralId: "" }))).toThrow("referralId is required");
  });

  it("throws on empty referrerId", () => {
    expect(() => new ReferralReward(base({ referrerId: "" }))).toThrow("referrerId is required");
  });

  it("throws on empty referreeId", () => {
    expect(() => new ReferralReward(base({ referreeId: "" }))).toThrow("referreeId is required");
  });

  it("throws on value <= 0", () => {
    expect(() => new ReferralReward(base({ value: 0 }))).toThrow("value must be > 0");
    expect(() => new ReferralReward(base({ value: -5 }))).toThrow("value must be > 0");
  });

  it("allows all reward types", () => {
    const types = [
      "cash", "wallet_credit", "reward_points", "membership_extension",
      "free_class", "discount_coupon", "gift_card", "merchandise",
      "yoga_mat", "meditation_course", "vip_membership", "workshop_access",
    ] as const;
    types.forEach(t => {
      expect(new ReferralReward(base({ type: t })).type).toBe(t);
    });
  });
});

describe("ReferralReward — expiry", () => {
  it("isExpired false when no expiresAt", () => {
    expect(new ReferralReward(base()).isExpired(NOW)).toBe(false);
  });

  it("isExpired false before expiry date", () => {
    expect(new ReferralReward(base({ expiresAt: FUTURE })).isExpired(NOW)).toBe(false);
  });

  it("isExpired true at exact expiry date", () => {
    expect(new ReferralReward(base({ expiresAt: NOW })).isExpired(NOW)).toBe(true);
  });

  it("isExpired true after expiry date", () => {
    expect(new ReferralReward(base({ expiresAt: PAST })).isExpired(NOW)).toBe(true);
  });
});

describe("ReferralReward — type classification", () => {
  it("cash is cash equivalent", () => {
    expect(new ReferralReward(base({ type: "cash" })).isCashEquivalent()).toBe(true);
  });

  it("wallet_credit is cash equivalent", () => {
    expect(new ReferralReward(base({ type: "wallet_credit" })).isCashEquivalent()).toBe(true);
  });

  it("gift_card is cash equivalent", () => {
    expect(new ReferralReward(base({ type: "gift_card" })).isCashEquivalent()).toBe(true);
  });

  it("reward_points is not cash equivalent", () => {
    expect(new ReferralReward(base({ type: "reward_points" })).isCashEquivalent()).toBe(false);
  });

  it("free_class is service reward", () => {
    expect(new ReferralReward(base({ type: "free_class" })).isServiceReward()).toBe(true);
  });

  it("workshop_access is service reward", () => {
    expect(new ReferralReward(base({ type: "workshop_access" })).isServiceReward()).toBe(true);
  });

  it("vip_membership is service reward", () => {
    expect(new ReferralReward(base({ type: "vip_membership" })).isServiceReward()).toBe(true);
  });

  it("meditation_course is service reward", () => {
    expect(new ReferralReward(base({ type: "meditation_course" })).isServiceReward()).toBe(true);
  });

  it("cash is not service reward", () => {
    expect(new ReferralReward(base({ type: "cash" })).isServiceReward()).toBe(false);
  });

  it("merchandise is physical reward", () => {
    expect(new ReferralReward(base({ type: "merchandise" })).isPhysicalReward()).toBe(true);
  });

  it("yoga_mat is physical reward", () => {
    expect(new ReferralReward(base({ type: "yoga_mat" })).isPhysicalReward()).toBe(true);
  });

  it("wallet_credit is not physical reward", () => {
    expect(new ReferralReward(base({ type: "wallet_credit" })).isPhysicalReward()).toBe(false);
  });
});

describe("ReferralReward — approve", () => {
  it("pending → approved with approvedBy", () => {
    const r = new ReferralReward(base()).approve("admin-1");
    expect(r.status).toBe("approved");
    expect(r.approvedBy).toBe("admin-1");
  });

  it("approve is immutable", () => {
    const r = new ReferralReward(base());
    r.approve("admin-1");
    expect(r.status).toBe("pending");
  });

  it("throws on empty approvedBy", () => {
    expect(() => new ReferralReward(base()).approve("")).toThrow("approvedBy is required");
  });

  it("throws when not pending", () => {
    expect(() => new ReferralReward(base({ status: "approved" })).approve("admin")).toThrow("Only pending");
  });
});

describe("ReferralReward — reject", () => {
  it("pending → rejected with reason", () => {
    const r = new ReferralReward(base()).reject("admin-1", "self-referral detected");
    expect(r.status).toBe("rejected");
    expect(r.rejectedBy).toBe("admin-1");
    expect(r.rejectionReason).toBe("self-referral detected");
  });

  it("throws on empty rejectedBy", () => {
    expect(() => new ReferralReward(base()).reject("", "reason")).toThrow("rejectedBy is required");
  });

  it("throws on empty reason", () => {
    expect(() => new ReferralReward(base()).reject("admin-1", "")).toThrow("rejection reason is required");
  });

  it("throws when not pending", () => {
    expect(() => new ReferralReward(base({ status: "rejected" })).reject("admin", "reason")).toThrow("Only pending");
  });
});

describe("ReferralReward — markPaid", () => {
  it("approved → paid", () => {
    const r = new ReferralReward(base({ status: "approved" })).markPaid(NOW);
    expect(r.status).toBe("paid");
    expect(r.paidAt).toEqual(NOW);
  });

  it("throws when not approved", () => {
    expect(() => new ReferralReward(base()).markPaid()).toThrow("Only approved rewards");
  });
});

describe("ReferralReward — markExpired", () => {
  it("pending → expired", () => {
    const r = new ReferralReward(base()).markExpired();
    expect(r.status).toBe("expired");
  });

  it("approved → expired", () => {
    const r = new ReferralReward(base({ status: "approved" })).markExpired();
    expect(r.status).toBe("expired");
  });

  it("throws when already expired", () => {
    expect(() => new ReferralReward(base({ status: "expired" })).markExpired()).toThrow("already expired");
  });

  it("throws when paid", () => {
    expect(() => new ReferralReward(base({ status: "paid" })).markExpired()).toThrow("Paid rewards cannot be expired");
  });
});

describe("ReferralReward — full lifecycle", () => {
  it("pending → approved → paid", () => {
    const r = new ReferralReward(base())
      .approve("admin-1")
      .markPaid(NOW);
    expect(r.status).toBe("paid");
    expect(r.approvedBy).toBe("admin-1");
    expect(r.paidAt).toEqual(NOW);
  });

  it("pending → rejected (fraud)", () => {
    const r = new ReferralReward(base())
      .reject("fraud-team", "duplicate device detected");
    expect(r.status).toBe("rejected");
    expect(r.rejectionReason).toBe("duplicate device detected");
  });
});
