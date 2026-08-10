// MCP tool registry for pricing, membership, and subscription management
// Safety rules: model cannot create unlimited-value bundles, bypass eligibility,
// modify committed payments, or force cancellations without customer consent.

export type PricingMcpAccess =
  | "auto"              // read-only, no state change
  | "customer_confirm"  // requires explicit customer action
  | "staff"             // staff role required
  | "staff_approval"    // staff + approval token
  | "admin"             // admin role
  | "admin_destructive";// admin + confirmText="CANCEL"/"CONFIRM"

export interface PricingMcpTool {
  key: string;
  name: string;
  description: string;
  access: PricingMcpAccess;
  requiresApproval: boolean;
  isDestructive: boolean;
  inputSchema: { required: string[]; optional?: string[] };
  safetyNote?: string;
}

export const PRICING_MCP_TOOLS: PricingMcpTool[] = [
  {
    key: "create_membership",
    name: "Create Membership Plan",
    description: "Create a new membership plan in draft status with pricing tiers, benefits, and policies",
    access: "staff_approval",
    requiresApproval: true,
    isDestructive: false,
    inputSchema: { required: ["name", "slug", "type", "prices", "benefits", "confirmApprovalId"], optional: ["freezePolicy", "pausePolicy", "familyConfig", "corporateConfig"] },
    safetyNote: "Unlimited plans (no credit cap) require confirmApprovalId from a manager",
  },
  {
    key: "update_membership",
    name: "Update Membership Plan",
    description: "Update pricing, benefits, or policies on an existing plan — does NOT affect active subscriptions",
    access: "staff",
    requiresApproval: false,
    isDestructive: false,
    inputSchema: { required: ["planId", "updatedBy"], optional: ["prices", "benefits", "freezePolicy", "pausePolicy"] },
  },
  {
    key: "compare_plan",
    name: "Compare Plans",
    description: "Side-by-side comparison of 2-4 membership plans — read-only, no state change",
    access: "auto",
    requiresApproval: false,
    isDestructive: false,
    inputSchema: { required: ["planIds"], optional: ["currency", "billingCycle"] },
  },
  {
    key: "recommend_plan",
    name: "Recommend Best Plan",
    description: "AI-driven recommendation based on customer usage, attendance, and preferences",
    access: "auto",
    requiresApproval: false,
    isDestructive: false,
    inputSchema: { required: ["customerId"], optional: ["budget", "goals", "attendanceHistory"] },
    safetyNote: "Returns recommendations only — customer must explicitly choose; model cannot auto-subscribe",
  },
  {
    key: "recommend_bundle",
    name: "Recommend Best Bundle",
    description: "Suggest class packs, hybrid bundles, or corporate packages based on customer profile",
    access: "auto",
    requiresApproval: false,
    isDestructive: false,
    inputSchema: { required: ["customerId"], optional: ["budget", "classTypes", "frequency"] },
  },
  {
    key: "calculate_discount",
    name: "Calculate Discount",
    description: "Preview discount for a given order amount, coupon codes, and active pricing rules",
    access: "auto",
    requiresApproval: false,
    isDestructive: false,
    inputSchema: { required: ["orderAmount", "customerId"], optional: ["couponCodes", "planId", "bundleId", "currency"] },
  },
  {
    key: "apply_coupon",
    name: "Apply Coupon to Order",
    description: "Validate and reserve a coupon during checkout (15-min Redis TTL)",
    access: "customer_confirm",
    requiresApproval: false,
    isDestructive: false,
    inputSchema: { required: ["couponCode", "customerId", "cartId", "orderAmount"] },
  },
  {
    key: "wallet_balance",
    name: "Check Wallet Balance",
    description: "Read current wallet balance, gift card value, and reward points for a customer",
    access: "auto",
    requiresApproval: false,
    isDestructive: false,
    inputSchema: { required: ["customerId"], optional: ["currency"] },
  },
  {
    key: "renew_subscription",
    name: "Renew Subscription",
    description: "Manually renew a subscription or extend expiry date (for failed auto-renewal recovery)",
    access: "staff",
    requiresApproval: false,
    isDestructive: false,
    inputSchema: { required: ["subscriptionId", "staffId"], optional: ["billingCycle", "applyCredit"] },
  },
  {
    key: "cancel_subscription",
    name: "Cancel Subscription",
    description: "Cancel a customer subscription — irreversible, triggers proration credit if applicable",
    access: "admin_destructive",
    requiresApproval: true,
    isDestructive: true,
    inputSchema: { required: ["subscriptionId", "cancelledBy", "reason", "confirmText"], optional: ["applyProratedCredit", "effectiveDate"] },
    safetyNote: "confirmText must be 'CANCEL'. Credit is applied to wallet automatically if applyProratedCredit=true.",
  },
  {
    key: "upgrade_plan",
    name: "Upgrade Membership Plan",
    description: "Upgrade customer to a higher-tier plan with prorated credit for unused days",
    access: "customer_confirm",
    requiresApproval: false,
    isDestructive: false,
    inputSchema: { required: ["subscriptionId", "newPlanId", "customerId"], optional: ["effectiveDate", "applyCredit"] },
  },
  {
    key: "downgrade_plan",
    name: "Downgrade Membership Plan",
    description: "Schedule downgrade to a lower-tier plan effective at the next billing cycle",
    access: "customer_confirm",
    requiresApproval: false,
    isDestructive: false,
    inputSchema: { required: ["subscriptionId", "newPlanId", "customerId"], optional: ["effectiveDate"] },
    safetyNote: "Downgrade is always scheduled for next cycle, never immediate — prevents mid-cycle benefit loss",
  },
];

export class PricingMcpRegistry {
  private tools: Map<string, PricingMcpTool>;

  constructor() {
    this.tools = new Map(PRICING_MCP_TOOLS.map(t => [t.key, t]));
  }

  list(): PricingMcpTool[] { return [...PRICING_MCP_TOOLS]; }

  get(key: string): PricingMcpTool | undefined { return this.tools.get(key); }

  listDestructive(): PricingMcpTool[] { return PRICING_MCP_TOOLS.filter(t => t.isDestructive); }

  listRequiringApproval(): PricingMcpTool[] { return PRICING_MCP_TOOLS.filter(t => t.requiresApproval); }

  listByAccess(access: PricingMcpAccess): PricingMcpTool[] { return PRICING_MCP_TOOLS.filter(t => t.access === access); }

  canExecute(key: string, input: Record<string, unknown>): { allowed: boolean; reason?: string } {
    const tool = this.tools.get(key);
    if (!tool) return { allowed: false, reason: `Unknown tool: ${key}` };

    if (tool.isDestructive) {
      if (input.confirmText !== "CANCEL")
        return { allowed: false, reason: "Destructive tool requires confirmText='CANCEL'" };
    }

    if (tool.requiresApproval && !tool.isDestructive) {
      if (!input.confirmApprovalId)
        return { allowed: false, reason: "Tool requires confirmApprovalId" };
    }

    const missing = tool.inputSchema.required.filter(f => !(f in input));
    if (missing.length > 0)
      return { allowed: false, reason: `Missing required fields: ${missing.join(", ")}` };

    return { allowed: true };
  }
}
