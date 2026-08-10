// eCommerce MCP Tool Registry — 12 tools across 6 access tiers
// Connects AI assistant to eCommerce operations with safety controls

export type EcommerceAccessTier =
  | "auto"               // read-only, no confirmation
  | "customer_confirm"   // customer must confirm action
  | "staff"              // staff can execute without approval
  | "staff_approval"     // staff action requires manager approval
  | "admin"              // admin-only action
  | "admin_destructive"; // admin + explicit confirmText required

export interface EcommerceMcpTool {
  key: string;
  name: string;
  description: string;
  access: EcommerceAccessTier;
  requiredFields: string[];
  isDestructive: boolean;
  requiresApproval: boolean;
  confirmText?: string;    // exact string required for destructive operations
  safetyNote?: string;
}

export const ECOMMERCE_MCP_TOOLS: EcommerceMcpTool[] = [
  {
    key: "search_product",
    name: "Search Products",
    description: "Search catalog by name, category, type, price range, or tags",
    access: "auto",
    requiredFields: ["query"],
    isDestructive: false,
    requiresApproval: false,
  },
  {
    key: "recommend_product",
    name: "Recommend Products",
    description: "AI-powered product recommendations based on customer history and preferences",
    access: "auto",
    requiredFields: ["customerId"],
    isDestructive: false,
    requiresApproval: false,
    safetyNote: "Returns recommendations only — customer must explicitly add to cart; model cannot auto-purchase",
  },
  {
    key: "inventory_status",
    name: "Inventory Status",
    description: "Check stock levels, low-stock alerts, and reorder points for a product or warehouse",
    access: "auto",
    requiredFields: ["productId"],
    isDestructive: false,
    requiresApproval: false,
  },
  {
    key: "wallet_balance",
    name: "Wallet Balance",
    description: "Read customer wallet balance and reward points available for redemption",
    access: "auto",
    requiredFields: ["customerId"],
    isDestructive: false,
    requiresApproval: false,
  },
  {
    key: "subscription_status",
    name: "Subscription Status",
    description: "Read customer subscription plan, billing cycle, renewal date, and entitlements",
    access: "auto",
    requiredFields: ["customerId"],
    isDestructive: false,
    requiresApproval: false,
  },
  {
    key: "track_order",
    name: "Track Order",
    description: "Get order status, shipment tracking number, and estimated delivery",
    access: "auto",
    requiredFields: ["orderNumber"],
    isDestructive: false,
    requiresApproval: false,
  },
  {
    key: "create_order",
    name: "Create Order",
    description: "Convert a confirmed cart into a new order; triggers Medusa + ERPNext invoice",
    access: "staff",
    requiredFields: ["cartId", "customerId", "paymentMethod"],
    isDestructive: false,
    requiresApproval: false,
  },
  {
    key: "generate_invoice",
    name: "Generate Invoice",
    description: "Generate GST/HST invoice PDF for an order via ERPNext; send to customer email",
    access: "staff",
    requiredFields: ["orderId"],
    isDestructive: false,
    requiresApproval: false,
  },
  {
    key: "create_coupon",
    name: "Create Coupon",
    description: "Create a discount coupon and sync to OfferKit; links to Wave 7 Coupon domain",
    access: "staff",
    requiredFields: ["code", "discountType", "discountValue", "validFrom", "validTo"],
    isDestructive: false,
    requiresApproval: false,
  },
  {
    key: "return_request",
    name: "Return Request",
    description: "Initiate a product return for a delivered order; triggers refund eligibility check",
    access: "customer_confirm",
    requiredFields: ["orderId", "reason"],
    isDestructive: false,
    requiresApproval: false,
    confirmText: "REQUEST_RETURN",
    safetyNote: "Customer must type REQUEST_RETURN to confirm; return policy applied before approval",
  },
  {
    key: "refund_order",
    name: "Refund Order",
    description: "Process full or partial refund via Stripe/PayPal; posts credit note to ERPNext",
    access: "staff_approval",
    requiredFields: ["orderId", "amount", "reason"],
    isDestructive: false,
    requiresApproval: true,
    safetyNote: "Requires manager confirmApprovalId; partial refunds do not cancel the order",
  },
  {
    key: "cancel_order",
    name: "Cancel Order",
    description: "Cancel an unfulfilled order; reverses stock reservation, triggers customer notification",
    access: "admin_destructive",
    requiredFields: ["orderId", "cancelledBy", "reason"],
    isDestructive: true,
    requiresApproval: true,
    confirmText: "CANCEL_ORDER",
    safetyNote: "Cannot cancel delivered or refunded orders; triggers Novu cancellation notification",
  },
];

export class EcommerceMcpRegistry {
  list(): EcommerceMcpTool[] {
    return [...ECOMMERCE_MCP_TOOLS];
  }

  get(key: string): EcommerceMcpTool | undefined {
    return ECOMMERCE_MCP_TOOLS.find(t => t.key === key);
  }

  listByAccess(tier: EcommerceAccessTier): EcommerceMcpTool[] {
    return ECOMMERCE_MCP_TOOLS.filter(t => t.access === tier);
  }

  listDestructive(): EcommerceMcpTool[] {
    return ECOMMERCE_MCP_TOOLS.filter(t => t.isDestructive);
  }

  listRequiringApproval(): EcommerceMcpTool[] {
    return ECOMMERCE_MCP_TOOLS.filter(t => t.requiresApproval);
  }

  canExecute(key: string, input: Record<string, unknown>): { allowed: boolean; reason?: string } {
    const tool = this.get(key);
    if (!tool) return { allowed: false, reason: `Unknown tool: ${key}` };

    if (tool.isDestructive) {
      if (!input.confirmText) return { allowed: false, reason: `confirmText "${tool.confirmText}" required for destructive operation` };
      if (input.confirmText !== tool.confirmText) return { allowed: false, reason: `confirmText must be exactly "${tool.confirmText}"` };
    }

    if (tool.requiresApproval && !tool.isDestructive) {
      if (!input.confirmApprovalId) return { allowed: false, reason: "confirmApprovalId required for approval-gated operation" };
    }

    if (tool.requiresApproval && tool.isDestructive) {
      // Destructive + approval: need BOTH confirmText and confirmApprovalId
      if (!input.confirmApprovalId) return { allowed: false, reason: "confirmApprovalId required" };
    }

    if (tool.access === "customer_confirm" && tool.confirmText) {
      if (!input.confirmText) return { allowed: false, reason: `confirmText "${tool.confirmText}" required` };
      if (input.confirmText !== tool.confirmText) return { allowed: false, reason: `confirmText must be exactly "${tool.confirmText}"` };
    }

    const missing = tool.requiredFields.filter(f => input[f] === undefined || input[f] === null || input[f] === "");
    if (missing.length > 0) return { allowed: false, reason: `Missing required fields: ${missing.join(", ")}` };

    return { allowed: true };
  }
}
