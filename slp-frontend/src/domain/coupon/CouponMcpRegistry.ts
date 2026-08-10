// MCP tool registry for coupon/promotion management
// Constraint: model may NOT create unlimited-value coupons, bypass eligibility,
// modify completed transactions, or issue refunds without human approval.

export type CouponMcpAccess =
  | "customer_read"     // customer's own coupons only
  | "auto"              // automatic, no approval needed
  | "customer_confirm"  // requires explicit customer intent
  | "marketing_staff"   // marketing role required
  | "marketing_approval"// marketing + approval token
  | "authorized_staff"  // any authorized staff
  | "admin_approval"    // admin role + approval token
  | "audit_restricted"; // restricted audit role only

export interface CouponMcpInputSchema {
  required: string[];
  optional?: string[];
}

export interface CouponMcpTool {
  key: string;
  name: string;
  description: string;
  access: CouponMcpAccess;
  requiresApproval: boolean;
  isDestructive: boolean;
  inputSchema: CouponMcpInputSchema;
  safetyNote?: string;
}

export const COUPON_MCP_TOOLS: CouponMcpTool[] = [
  {
    key: "list_customer_coupons",
    name: "List Customer Coupons",
    description: "Retrieve all active and upcoming coupons for the authenticated customer",
    access: "customer_read",
    requiresApproval: false,
    isDestructive: false,
    inputSchema: { required: ["customerId"], optional: ["status", "type"] },
  },
  {
    key: "validate_coupon",
    name: "Validate Coupon",
    description: "Check coupon validity, eligibility, and calculate preview discount without reserving",
    access: "auto",
    requiresApproval: false,
    isDestructive: false,
    inputSchema: { required: ["couponCode", "customerId", "orderAmount"], optional: ["membershipTier", "productIds"] },
  },
  {
    key: "preview_discount",
    name: "Preview Discount",
    description: "Show estimated savings before checkout — read-only, no reservation created",
    access: "auto",
    requiresApproval: false,
    isDestructive: false,
    inputSchema: { required: ["couponCode", "orderAmount"], optional: ["currency"] },
  },
  {
    key: "apply_coupon_to_cart",
    name: "Apply Coupon to Cart",
    description: "Reserve coupon slot during checkout (15-minute TTL via Redis lock)",
    access: "customer_confirm",
    requiresApproval: false,
    isDestructive: false,
    inputSchema: { required: ["couponCode", "customerId", "cartId", "orderAmount"], optional: ["channel"] },
    safetyNote: "Creates a time-limited reservation — must be committed after payment succeeds",
  },
  {
    key: "remove_coupon_from_cart",
    name: "Remove Coupon from Cart",
    description: "Cancel reservation and release the coupon slot back to the pool",
    access: "auto",
    requiresApproval: false,
    isDestructive: false,
    inputSchema: { required: ["reservationId", "customerId"] },
  },
  {
    key: "create_coupon_draft",
    name: "Create Coupon Draft",
    description: "Create a new coupon in draft status for review — cannot exceed CAD 500 face value without escalation",
    access: "marketing_staff",
    requiresApproval: false,
    isDestructive: false,
    inputSchema: { required: ["name", "type", "discountType", "discountValue", "validFrom", "validTo", "createdBy"], optional: ["eligibility", "limits", "distributionChannels"] },
    safetyNote: "Fixed-amount coupons > CAD 500 require admin_approval. Percentage coupons > 50% require admin_approval.",
  },
  {
    key: "generate_unique_codes",
    name: "Generate Unique Codes",
    description: "Bulk-generate unique single-use coupon codes for a campaign",
    access: "marketing_approval",
    requiresApproval: true,
    isDestructive: false,
    inputSchema: { required: ["campaignId", "quantity", "confirmApprovalId"], optional: ["prefix", "codeLength"] },
    safetyNote: "Requires approval token — prevents accidental mass issuance",
  },
  {
    key: "activate_campaign",
    name: "Activate Campaign",
    description: "Transition a scheduled or paused campaign to active state",
    access: "marketing_approval",
    requiresApproval: true,
    isDestructive: false,
    inputSchema: { required: ["campaignId", "confirmApprovalId"] },
  },
  {
    key: "pause_campaign",
    name: "Pause Campaign",
    description: "Pause an active campaign to stop new redemptions immediately",
    access: "authorized_staff",
    requiresApproval: false,
    isDestructive: false,
    inputSchema: { required: ["campaignId", "reason"] },
  },
  {
    key: "revoke_coupon",
    name: "Revoke Coupon",
    description: "Permanently revoke a coupon — committed redemptions are NOT automatically reversed",
    access: "admin_approval",
    requiresApproval: true,
    isDestructive: true,
    inputSchema: { required: ["couponId", "revokedBy", "reason", "confirmText"], optional: ["notifyCustomers"] },
    safetyNote: "confirmText must be 'REVOKE'. Does not reverse past redemptions — use reverse_redemption separately.",
  },
  {
    key: "get_coupon_analytics",
    name: "Get Coupon Analytics",
    description: "Read-only: views, redemptions, discount cost, conversion rate, top coupons",
    access: "marketing_staff",
    requiresApproval: false,
    isDestructive: false,
    inputSchema: { required: ["dateFrom", "dateTo"], optional: ["couponId", "campaignId", "groupBy"] },
  },
  {
    key: "simulate_promotion",
    name: "Simulate Promotion",
    description: "Test discount calculation with sample data — sandbox only, no records created",
    access: "admin_approval",
    requiresApproval: false,
    isDestructive: false,
    inputSchema: { required: ["couponCode", "simulatedOrderAmount", "simulatedCustomerProfile"] },
    safetyNote: "Sandbox operation — results are not persisted and do not affect real inventory or ledgers",
  },
  {
    key: "investigate_redemption",
    name: "Investigate Redemption",
    description: "Full audit trail for a specific redemption including IP, device, and eligibility checks",
    access: "audit_restricted",
    requiresApproval: false,
    isDestructive: false,
    inputSchema: { required: ["redemptionId", "auditRoleToken"] },
    safetyNote: "Returns PII — restricted to audit role with logged access",
  },
];

export class CouponMcpRegistry {
  private tools: Map<string, CouponMcpTool>;

  constructor() {
    this.tools = new Map(COUPON_MCP_TOOLS.map(t => [t.key, t]));
  }

  list(): CouponMcpTool[] { return [...COUPON_MCP_TOOLS]; }

  get(key: string): CouponMcpTool | undefined { return this.tools.get(key); }

  listDestructive(): CouponMcpTool[] { return COUPON_MCP_TOOLS.filter(t => t.isDestructive); }

  listRequiringApproval(): CouponMcpTool[] { return COUPON_MCP_TOOLS.filter(t => t.requiresApproval); }

  listByAccess(access: CouponMcpAccess): CouponMcpTool[] { return COUPON_MCP_TOOLS.filter(t => t.access === access); }

  canExecute(key: string, input: Record<string, unknown>): { allowed: boolean; reason?: string } {
    const tool = this.tools.get(key);
    if (!tool) return { allowed: false, reason: `Unknown tool: ${key}` };

    // Destructive tools require confirmText=REVOKE
    if (tool.isDestructive) {
      if (input.confirmText !== "REVOKE")
        return { allowed: false, reason: "Destructive tool requires confirmText='REVOKE'" };
    }

    // Tools requiring approval need confirmApprovalId
    if (tool.requiresApproval && !tool.isDestructive) {
      if (!input.confirmApprovalId)
        return { allowed: false, reason: "Tool requires confirmApprovalId" };
    }

    // Audit-restricted tools need auditRoleToken
    if (tool.access === "audit_restricted") {
      if (!input.auditRoleToken)
        return { allowed: false, reason: "Tool requires auditRoleToken" };
    }

    // Check required fields present
    const missing = tool.inputSchema.required.filter(f => !(f in input));
    if (missing.length > 0)
      return { allowed: false, reason: `Missing required fields: ${missing.join(", ")}` };

    return { allowed: true };
  }
}
