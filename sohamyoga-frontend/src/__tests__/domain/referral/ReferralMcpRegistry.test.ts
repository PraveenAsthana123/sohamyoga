import {
  ReferralMcpRegistry,
  REFERRAL_MCP_TOOLS,
  ReferralMcpExecuteRequest,
} from "../../../domain/referral/ReferralMcpRegistry";

function req(overrides: Partial<ReferralMcpExecuteRequest> = {}): ReferralMcpExecuteRequest {
  return { toolName: "create_referral_code", args: {}, ...overrides };
}

describe("ReferralMcpRegistry — catalog", () => {
  it("exposes 12 MCP tools", () => {
    expect(REFERRAL_MCP_TOOLS).toHaveLength(12);
  });

  it("getTools returns a copy of the tools array", () => {
    const tools = ReferralMcpRegistry.getTools();
    expect(tools).toHaveLength(12);
    tools.push({} as never);
    expect(ReferralMcpRegistry.getTools()).toHaveLength(12);
  });

  it("getTool returns tool by name", () => {
    const tool = ReferralMcpRegistry.getTool("validate_referral");
    expect(tool).toBeDefined();
    expect(tool!.tier).toBe("auto");
  });

  it("getTool returns undefined for unknown tool", () => {
    expect(ReferralMcpRegistry.getTool("nonexistent")).toBeUndefined();
  });

  it("all tools have name, tier, requiredFields", () => {
    for (const tool of REFERRAL_MCP_TOOLS) {
      expect(tool.name).toBeTruthy();
      expect(tool.tier).toBeTruthy();
      expect(Array.isArray(tool.requiredFields)).toBe(true);
    }
  });

  it("fraud_check is admin_destructive and requires both confirmText and approval", () => {
    const tool = ReferralMcpRegistry.getTool("fraud_check");
    expect(tool!.tier).toBe("admin_destructive");
    expect(tool!.isDestructive).toBe(true);
    expect(tool!.requiresApproval).toBe(true);
    expect(tool!.confirmText).toBe("RUN_FRAUD_CHECK");
  });

  it("approve_reward requires approval but is not destructive", () => {
    const tool = ReferralMcpRegistry.getTool("approve_reward");
    expect(tool!.tier).toBe("staff_approval");
    expect(tool!.requiresApproval).toBe(true);
    expect(tool!.isDestructive).toBeFalsy();
  });

  it("auto tools have no requiresApproval or confirmText", () => {
    const autoTools = REFERRAL_MCP_TOOLS.filter(t => t.tier === "auto");
    for (const tool of autoTools) {
      expect(tool.requiresApproval).toBeFalsy();
    }
  });
});

describe("ReferralMcpRegistry — canExecute: unknown tool", () => {
  it("denies unknown tool", () => {
    const result = ReferralMcpRegistry.canExecute(req({ toolName: "hack_portal" }));
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("Unknown tool");
  });
});

describe("ReferralMcpRegistry — auto tier tools", () => {
  it("create_referral_code: allowed with required fields", () => {
    const result = ReferralMcpRegistry.canExecute(req({
      toolName: "create_referral_code",
      args: { referrerId: "user-1", referrerType: "customer_customer" },
    }));
    expect(result.allowed).toBe(true);
  });

  it("create_referral_code: denied when missing referrerId", () => {
    const result = ReferralMcpRegistry.canExecute(req({
      toolName: "create_referral_code",
      args: { referrerType: "customer_customer" },
    }));
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("referrerId");
  });

  it("create_referral_code: denied when missing referrerType", () => {
    const result = ReferralMcpRegistry.canExecute(req({
      toolName: "create_referral_code",
      args: { referrerId: "user-1" },
    }));
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("referrerType");
  });

  it("generate_referral_link: allowed with required fields", () => {
    const result = ReferralMcpRegistry.canExecute(req({
      toolName: "generate_referral_link",
      args: { referralCodeId: "rc-1", channel: "whatsapp" },
    }));
    expect(result.allowed).toBe(true);
  });

  it("generate_referral_qr: allowed with referralCodeId", () => {
    const result = ReferralMcpRegistry.canExecute(req({
      toolName: "generate_referral_qr",
      args: { referralCodeId: "rc-1" },
    }));
    expect(result.allowed).toBe(true);
  });

  it("validate_referral: allowed with code + referreeEmail", () => {
    const result = ReferralMcpRegistry.canExecute(req({
      toolName: "validate_referral",
      args: { code: "PRAVEEN2026", referreeEmail: "friend@example.com" },
    }));
    expect(result.allowed).toBe(true);
  });

  it("validate_referral: denied when code empty string", () => {
    const result = ReferralMcpRegistry.canExecute(req({
      toolName: "validate_referral",
      args: { code: "", referreeEmail: "friend@example.com" },
    }));
    expect(result.allowed).toBe(false);
  });

  it("wallet_balance: allowed with customerId", () => {
    const result = ReferralMcpRegistry.canExecute(req({
      toolName: "wallet_balance",
      args: { customerId: "user-1" },
    }));
    expect(result.allowed).toBe(true);
  });

  it("referral_history: allowed with referrerId", () => {
    const result = ReferralMcpRegistry.canExecute(req({
      toolName: "referral_history",
      args: { referrerId: "user-1" },
    }));
    expect(result.allowed).toBe(true);
  });

  it("leaderboard: allowed with no required fields", () => {
    const result = ReferralMcpRegistry.canExecute(req({ toolName: "leaderboard", args: {} }));
    expect(result.allowed).toBe(true);
  });
});

describe("ReferralMcpRegistry — staff tier tools", () => {
  it("calculate_reward: allowed with referralId + campaignId", () => {
    const result = ReferralMcpRegistry.canExecute(req({
      toolName: "calculate_reward",
      args: { referralId: "ref-1", campaignId: "camp-1" },
    }));
    expect(result.allowed).toBe(true);
  });

  it("calculate_reward: denied when missing campaignId", () => {
    const result = ReferralMcpRegistry.canExecute(req({
      toolName: "calculate_reward",
      args: { referralId: "ref-1" },
    }));
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("campaignId");
  });

  it("referral_analytics: allowed with campaignId", () => {
    const result = ReferralMcpRegistry.canExecute(req({
      toolName: "referral_analytics",
      args: { campaignId: "camp-1" },
    }));
    expect(result.allowed).toBe(true);
  });

  it("referral_analytics: denied without campaignId", () => {
    const result = ReferralMcpRegistry.canExecute(req({ toolName: "referral_analytics", args: {} }));
    expect(result.allowed).toBe(false);
  });
});

describe("ReferralMcpRegistry — staff_approval tier tools", () => {
  it("approve_reward: denied without confirmApprovalId", () => {
    const result = ReferralMcpRegistry.canExecute(req({
      toolName: "approve_reward",
      args: { referralId: "ref-1", approvedBy: "admin-1" },
    }));
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("confirmApprovalId");
  });

  it("approve_reward: allowed with confirmApprovalId", () => {
    const result = ReferralMcpRegistry.canExecute(req({
      toolName: "approve_reward",
      args: { referralId: "ref-1", approvedBy: "admin-1" },
      confirmApprovalId: "appr-xyz",
    }));
    expect(result.allowed).toBe(true);
  });

  it("reject_reward: denied without confirmApprovalId", () => {
    const result = ReferralMcpRegistry.canExecute(req({
      toolName: "reject_reward",
      args: { referralId: "ref-1", rejectedBy: "admin-1", reason: "fraud" },
    }));
    expect(result.allowed).toBe(false);
  });

  it("reject_reward: allowed with confirmApprovalId", () => {
    const result = ReferralMcpRegistry.canExecute(req({
      toolName: "reject_reward",
      args: { referralId: "ref-1", rejectedBy: "admin-1", reason: "fraud" },
      confirmApprovalId: "appr-abc",
    }));
    expect(result.allowed).toBe(true);
  });

  it("reject_reward: denied missing required reason", () => {
    const result = ReferralMcpRegistry.canExecute(req({
      toolName: "reject_reward",
      args: { referralId: "ref-1", rejectedBy: "admin-1" },
      confirmApprovalId: "appr-abc",
    }));
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("reason");
  });
});

describe("ReferralMcpRegistry — admin_destructive: fraud_check", () => {
  it("denied without confirmText", () => {
    const result = ReferralMcpRegistry.canExecute(req({
      toolName: "fraud_check",
      args: { referralId: "ref-1", performedBy: "admin-1" },
      confirmApprovalId: "appr-xyz",
    }));
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("RUN_FRAUD_CHECK");
  });

  it("denied with wrong confirmText", () => {
    const result = ReferralMcpRegistry.canExecute(req({
      toolName: "fraud_check",
      args: { referralId: "ref-1", performedBy: "admin-1" },
      confirmText: "WRONG_TEXT",
      confirmApprovalId: "appr-xyz",
    }));
    expect(result.allowed).toBe(false);
  });

  it("denied with correct confirmText but missing confirmApprovalId", () => {
    const result = ReferralMcpRegistry.canExecute(req({
      toolName: "fraud_check",
      args: { referralId: "ref-1", performedBy: "admin-1" },
      confirmText: "RUN_FRAUD_CHECK",
    }));
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("confirmApprovalId");
  });

  it("allowed with both confirmText and confirmApprovalId", () => {
    const result = ReferralMcpRegistry.canExecute(req({
      toolName: "fraud_check",
      args: { referralId: "ref-1", performedBy: "admin-1" },
      confirmText: "RUN_FRAUD_CHECK",
      confirmApprovalId: "appr-xyz",
    }));
    expect(result.allowed).toBe(true);
  });

  it("denied when missing required field performedBy", () => {
    const result = ReferralMcpRegistry.canExecute(req({
      toolName: "fraud_check",
      args: { referralId: "ref-1" },
      confirmText: "RUN_FRAUD_CHECK",
      confirmApprovalId: "appr-xyz",
    }));
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("performedBy");
  });

  it("denied when missing required field referralId", () => {
    const result = ReferralMcpRegistry.canExecute(req({
      toolName: "fraud_check",
      args: { performedBy: "admin-1" },
      confirmText: "RUN_FRAUD_CHECK",
      confirmApprovalId: "appr-xyz",
    }));
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("referralId");
  });
});
