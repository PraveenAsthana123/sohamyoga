export type ReferralAccessTier =
  | "auto"
  | "customer_confirm"
  | "staff"
  | "staff_approval"
  | "admin"
  | "admin_destructive";

export interface ReferralMcpTool {
  name: string;
  description: string;
  tier: ReferralAccessTier;
  requiredFields: string[];
  confirmText?: string;
  requiresApproval?: boolean;
  isDestructive?: boolean;
  safetyNote?: string;
}

export interface ReferralMcpExecuteRequest {
  toolName: string;
  args: Record<string, unknown>;
  confirmText?: string;
  confirmApprovalId?: string;
}

export interface ReferralMcpExecuteResult {
  allowed: boolean;
  reason?: string;
}

export const REFERRAL_MCP_TOOLS: ReferralMcpTool[] = [
  {
    name: "create_referral_code",
    description: "Generate a unique referral code for a customer or teacher",
    tier: "auto",
    requiredFields: ["referrerId", "referrerType"],
    safetyNote: "Code is generated server-side; referrer identity must be verified before issuance",
  },
  {
    name: "generate_referral_link",
    description: "Build a shareable referral URL with UTM tracking parameters",
    tier: "auto",
    requiredFields: ["referralCodeId", "channel"],
  },
  {
    name: "generate_referral_qr",
    description: "Create a QR code image for the referral link",
    tier: "auto",
    requiredFields: ["referralCodeId"],
  },
  {
    name: "validate_referral",
    description: "Check referral code validity, fraud flags, and campaign eligibility",
    tier: "auto",
    requiredFields: ["code", "referreeEmail"],
  },
  {
    name: "wallet_balance",
    description: "Retrieve referral wallet balance for a customer",
    tier: "auto",
    requiredFields: ["customerId"],
  },
  {
    name: "referral_history",
    description: "List referral events and statuses for a referrer",
    tier: "auto",
    requiredFields: ["referrerId"],
  },
  {
    name: "leaderboard",
    description: "Return top referrers for a campaign or global leaderboard",
    tier: "auto",
    requiredFields: [],
  },
  {
    name: "calculate_reward",
    description: "Compute reward amount for a referral based on campaign rules",
    tier: "staff",
    requiredFields: ["referralId", "campaignId"],
  },
  {
    name: "referral_analytics",
    description: "Return funnel metrics: clicks, registrations, conversions, revenue per referral",
    tier: "staff",
    requiredFields: ["campaignId"],
  },
  {
    name: "approve_reward",
    description: "Approve a pending referral reward for payment",
    tier: "staff_approval",
    requiredFields: ["referralId", "approvedBy"],
    requiresApproval: true,
  },
  {
    name: "reject_reward",
    description: "Reject a pending referral reward with a mandatory reason",
    tier: "staff_approval",
    requiredFields: ["referralId", "rejectedBy", "reason"],
    requiresApproval: true,
  },
  {
    name: "fraud_check",
    description: "Run fraud detection scan and add or remove fraud flags on a referral",
    tier: "admin_destructive",
    isDestructive: true,
    requiresApproval: true,
    confirmText: "RUN_FRAUD_CHECK",
    requiredFields: ["referralId", "performedBy"],
    safetyNote: "Fraud check may block rewards and flag the referrer; requires admin authorization",
  },
];

export class ReferralMcpRegistry {
  static getTools(): ReferralMcpTool[] {
    return [...REFERRAL_MCP_TOOLS];
  }

  static getTool(name: string): ReferralMcpTool | undefined {
    return REFERRAL_MCP_TOOLS.find(t => t.name === name);
  }

  static canExecute(request: ReferralMcpExecuteRequest): ReferralMcpExecuteResult {
    const tool = this.getTool(request.toolName);
    if (!tool) {
      return { allowed: false, reason: `Unknown tool: ${request.toolName}` };
    }

    for (const field of tool.requiredFields) {
      const val = request.args[field];
      if (val === undefined || val === null || val === "") {
        return { allowed: false, reason: `Missing required field: ${field}` };
      }
    }

    // admin_destructive: both confirmText AND confirmApprovalId required
    if (tool.isDestructive && tool.requiresApproval) {
      if (!request.confirmText || request.confirmText !== tool.confirmText) {
        return { allowed: false, reason: `Destructive tool requires confirmText="${tool.confirmText}"` };
      }
      if (!request.confirmApprovalId) {
        return { allowed: false, reason: "Destructive tool requires confirmApprovalId" };
      }
      return { allowed: true };
    }

    // staff_approval: confirmApprovalId only
    if (tool.requiresApproval) {
      if (!request.confirmApprovalId) {
        return { allowed: false, reason: "Tool requires confirmApprovalId" };
      }
      return { allowed: true };
    }

    // customer_confirm: confirmText match
    if (tool.tier === "customer_confirm" && tool.confirmText) {
      if (!request.confirmText || request.confirmText !== tool.confirmText) {
        return { allowed: false, reason: `Tool requires confirmText="${tool.confirmText}"` };
      }
    }

    return { allowed: true };
  }
}
