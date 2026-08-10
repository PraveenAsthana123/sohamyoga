import { Referral, ReferralProps } from "../../../domain/referral/Referral";

const NOW = new Date("2026-08-05");

function base(overrides: Partial<ReferralProps> = {}): ReferralProps {
  return {
    id: "ref-1",
    referralCodeId: "rc-1",
    referrerId: "user-1",
    referreeEmail: "friend@example.com",
    type: "customer_customer",
    status: "draft",
    fraudFlags: [],
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

describe("Referral — construction", () => {
  it("creates a valid referral", () => {
    const r = new Referral(base());
    expect(r.id).toBe("ref-1");
    expect(r.status).toBe("draft");
    expect(r.fraudFlags).toEqual([]);
    expect(r.hasFraudFlags()).toBe(false);
  });

  it("throws on empty id", () => {
    expect(() => new Referral(base({ id: "" }))).toThrow("id is required");
  });

  it("throws on empty referralCodeId", () => {
    expect(() => new Referral(base({ referralCodeId: "" }))).toThrow("referralCodeId is required");
  });

  it("throws on empty referrerId", () => {
    expect(() => new Referral(base({ referrerId: "" }))).toThrow("referrerId is required");
  });

  it("throws on empty referreeEmail", () => {
    expect(() => new Referral(base({ referreeEmail: "" }))).toThrow("referreeEmail is required");
  });

  it("throws on negative orderAmount", () => {
    expect(() => new Referral(base({ orderAmount: -1 }))).toThrow("orderAmount must be >= 0");
  });

  it("allows orderAmount of 0", () => {
    const r = new Referral(base({ orderAmount: 0 }));
    expect(r.orderAmount).toBe(0);
  });

  it("initializes fraudFlags as defensive copy", () => {
    const flags = ["dup-email"];
    const r = new Referral(base({ fraudFlags: flags }));
    flags.push("extra");
    expect(r.fraudFlags).toEqual(["dup-email"]);
  });

  it("isTerminal false for draft", () => {
    expect(new Referral(base()).isTerminal()).toBe(false);
  });

  it("isTerminal true for reward_paid", () => {
    expect(new Referral(base({ status: "reward_paid" })).isTerminal()).toBe(true);
  });

  it("isTerminal true for reward_rejected", () => {
    expect(new Referral(base({ status: "reward_rejected" })).isTerminal()).toBe(true);
  });

  it("isTerminal true for expired", () => {
    expect(new Referral(base({ status: "expired" })).isTerminal()).toBe(true);
  });
});

describe("Referral — share", () => {
  it("draft → shared with channel", () => {
    const r = new Referral(base()).share("whatsapp");
    expect(r.status).toBe("shared");
    expect(r.channel).toBe("whatsapp");
  });

  it("share is immutable", () => {
    const r = new Referral(base());
    r.share("email");
    expect(r.status).toBe("draft");
  });

  it("throws when not draft", () => {
    expect(() => new Referral(base({ status: "shared" })).share("telegram")).toThrow("Only draft referrals");
  });
});

describe("Referral — click", () => {
  it("shared → clicked", () => {
    const r = new Referral(base({ status: "shared" })).click(NOW);
    expect(r.status).toBe("clicked");
    expect(r.clickedAt).toEqual(NOW);
  });

  it("draft → clicked (direct link)", () => {
    const r = new Referral(base()).click(NOW);
    expect(r.status).toBe("clicked");
  });

  it("throws when already registered", () => {
    expect(() => new Referral(base({ status: "registered" })).click()).toThrow("shared or draft");
  });
});

describe("Referral — register", () => {
  it("clicked → registered with referreeId", () => {
    const r = new Referral(base({ status: "clicked" })).register("user-2", NOW);
    expect(r.status).toBe("registered");
    expect(r.referreeId).toBe("user-2");
    expect(r.registeredAt).toEqual(NOW);
  });

  it("shared → registered (skipped click)", () => {
    const r = new Referral(base({ status: "shared" })).register("user-3", NOW);
    expect(r.status).toBe("registered");
  });

  it("draft → registered (offline flow)", () => {
    const r = new Referral(base()).register("user-4", NOW);
    expect(r.status).toBe("registered");
  });

  it("throws on empty referreeId", () => {
    expect(() => new Referral(base({ status: "clicked" })).register("")).toThrow("referreeId is required");
  });

  it("throws when already verified", () => {
    expect(() => new Referral(base({ status: "verified" })).register("user-5")).toThrow("clicked, shared, or draft");
  });
});

describe("Referral — verify", () => {
  it("registered → verified", () => {
    const r = new Referral(base({ status: "registered" })).verify(NOW);
    expect(r.status).toBe("verified");
    expect(r.verifiedAt).toEqual(NOW);
  });

  it("throws when not registered", () => {
    expect(() => new Referral(base({ status: "clicked" })).verify()).toThrow("must be registered");
  });
});

describe("Referral — recordPurchase", () => {
  it("verified → membership_purchased", () => {
    const r = new Referral(base({ status: "verified" })).recordPurchase(149.0, NOW);
    expect(r.status).toBe("membership_purchased");
    expect(r.orderAmount).toBe(149.0);
    expect(r.purchasedAt).toEqual(NOW);
  });

  it("registered → membership_purchased (skip verify)", () => {
    const r = new Referral(base({ status: "registered" })).recordPurchase(79, NOW);
    expect(r.status).toBe("membership_purchased");
  });

  it("throws on orderAmount <= 0", () => {
    expect(() => new Referral(base({ status: "verified" })).recordPurchase(0)).toThrow("orderAmount must be > 0");
  });

  it("throws from wrong status", () => {
    expect(() => new Referral(base({ status: "clicked" })).recordPurchase(100)).toThrow("verified or registered");
  });
});

describe("Referral — reward lifecycle", () => {
  it("membership_purchased → reward_pending", () => {
    const r = new Referral(base({ status: "membership_purchased" })).pendingReward();
    expect(r.status).toBe("reward_pending");
  });

  it("verified → reward_pending (membership not required)", () => {
    const r = new Referral(base({ status: "verified" })).pendingReward();
    expect(r.status).toBe("reward_pending");
  });

  it("pendingReward throws from wrong status", () => {
    expect(() => new Referral(base({ status: "registered" })).pendingReward()).toThrow("purchase or be verified");
  });

  it("reward_pending → reward_approved", () => {
    const r = new Referral(base({ status: "reward_pending" })).approveReward();
    expect(r.status).toBe("reward_approved");
  });

  it("approveReward throws when not pending", () => {
    expect(() => new Referral(base({ status: "verified" })).approveReward()).toThrow("reward_pending");
  });

  it("reward_pending → reward_rejected with reason", () => {
    const r = new Referral(base({ status: "reward_pending" })).rejectReward("duplicate account");
    expect(r.status).toBe("reward_rejected");
    expect(r.rejectionReason).toBe("duplicate account");
  });

  it("rejectReward throws on empty reason", () => {
    expect(() => new Referral(base({ status: "reward_pending" })).rejectReward("")).toThrow("Rejection reason");
  });

  it("rejectReward throws when not pending", () => {
    expect(() => new Referral(base({ status: "registered" })).rejectReward("fraud")).toThrow("reward_pending");
  });

  it("reward_approved → reward_paid", () => {
    const r = new Referral(base({ status: "reward_approved" })).markRewardPaid(NOW);
    expect(r.status).toBe("reward_paid");
    expect(r.rewardPaidAt).toEqual(NOW);
  });

  it("markRewardPaid throws when not approved", () => {
    expect(() => new Referral(base({ status: "reward_pending" })).markRewardPaid()).toThrow("reward_approved");
  });
});

describe("Referral — expire", () => {
  it("expires from shared status", () => {
    const r = new Referral(base({ status: "shared" })).expire();
    expect(r.status).toBe("expired");
  });

  it("expires from registered status", () => {
    const r = new Referral(base({ status: "registered" })).expire();
    expect(r.status).toBe("expired");
  });

  it("throws when already expired", () => {
    expect(() => new Referral(base({ status: "expired" })).expire()).toThrow("Cannot expire");
  });

  it("throws when reward_paid", () => {
    expect(() => new Referral(base({ status: "reward_paid" })).expire()).toThrow("Cannot expire");
  });

  it("throws when reward_rejected", () => {
    expect(() => new Referral(base({ status: "reward_rejected" })).expire()).toThrow("Cannot expire");
  });
});

describe("Referral — fraud flags", () => {
  it("addFraudFlag adds a flag", () => {
    const r = new Referral(base()).addFraudFlag("duplicate-ip");
    expect(r.fraudFlags).toEqual(["duplicate-ip"]);
    expect(r.hasFraudFlags()).toBe(true);
  });

  it("multiple flags accumulate", () => {
    const r = new Referral(base())
      .addFraudFlag("dup-email")
      .addFraudFlag("dup-device");
    expect(r.fraudFlags).toHaveLength(2);
  });

  it("addFraudFlag throws on empty string", () => {
    expect(() => new Referral(base()).addFraudFlag("")).toThrow("must not be empty");
  });

  it("clearFraudFlags removes all flags", () => {
    const r = new Referral(base({ fraudFlags: ["dup-email", "vpn"] })).clearFraudFlags();
    expect(r.fraudFlags).toEqual([]);
    expect(r.hasFraudFlags()).toBe(false);
  });

  it("fraudFlags getter returns defensive copy", () => {
    const r = new Referral(base({ fraudFlags: ["flag1"] }));
    const flags = r.fraudFlags;
    flags.push("injected");
    expect(r.fraudFlags).toEqual(["flag1"]);
  });
});
