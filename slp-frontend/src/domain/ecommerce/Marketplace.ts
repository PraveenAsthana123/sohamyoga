// Marketplace — vendor/teacher stores, affiliate commissions, settlement management

export type VendorType = "teacher" | "partner" | "brand" | "affiliate" | "independent";
export type VendorStatus = "pending" | "active" | "suspended" | "deactivated";
export type CommissionType = "percentage" | "fixed" | "tiered";
export type SettlementStatus = "pending" | "processing" | "settled" | "failed";
export type SettlementFrequency = "weekly" | "biweekly" | "monthly";

export interface CommissionTier {
  minAmount: number;
  maxAmount?: number;   // undefined = unbounded upper tier
  rate: number;         // percentage 0–100
}

export interface Settlement {
  id: string;
  period: string;         // "2026-07"
  grossAmount: number;
  commissionAmount: number;
  netAmount: number;
  status: SettlementStatus;
  settledAt?: Date;
  paymentReference?: string;
}

export interface VendorProps {
  id: string;
  name: string;
  slug: string;
  type: VendorType;
  status: VendorStatus;
  email: string;
  phone?: string;

  commissionType: CommissionType;
  commissionRate: number;        // percent (0–100) or fixed CAD amount
  commissionTiers?: CommissionTier[];

  bankAccount?: string;
  ifscCode?: string;
  paypalEmail?: string;

  settlementFrequency: SettlementFrequency;

  totalSales: number;
  totalCommissionPaid: number;
  pendingBalance: number;

  suspendReason?: string;
  settlements: Settlement[];

  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export class Marketplace {
  constructor(private props: VendorProps) {
    if (!props.name.trim()) throw new Error("Vendor name required");
    if (!props.slug.trim()) throw new Error("Slug required");
    if (!/^[a-z0-9-]+$/.test(props.slug)) throw new Error("Slug must be lowercase kebab-case");
    if (!props.email.trim()) throw new Error("Email required");
    if (props.commissionRate < 0) throw new Error("Commission rate cannot be negative");
    if (props.commissionType === "percentage" && props.commissionRate > 100) throw new Error("Commission percentage cannot exceed 100");
    if (props.totalSales < 0) throw new Error("Total sales cannot be negative");
    if (props.totalCommissionPaid < 0) throw new Error("Total commission paid cannot be negative");
    if (props.pendingBalance < 0) throw new Error("Pending balance cannot be negative");
    if (props.commissionType === "tiered") {
      if (!props.commissionTiers || props.commissionTiers.length === 0) throw new Error("Tiered commission requires at least one tier");
      if (props.commissionTiers.some(t => t.rate < 0 || t.rate > 100)) throw new Error("Tier rate must be 0–100");
    }
  }

  get id()                  { return this.props.id; }
  get name()                { return this.props.name; }
  get slug()                { return this.props.slug; }
  get type()                { return this.props.type; }
  get status()              { return this.props.status; }
  get email()               { return this.props.email; }
  get commissionType()      { return this.props.commissionType; }
  get commissionRate()      { return this.props.commissionRate; }
  get commissionTiers()     { return this.props.commissionTiers ? [...this.props.commissionTiers] : undefined; }
  get settlementFrequency() { return this.props.settlementFrequency; }
  get totalSales()          { return this.props.totalSales; }
  get totalCommissionPaid() { return this.props.totalCommissionPaid; }
  get pendingBalance()      { return this.props.pendingBalance; }
  get suspendReason()       { return this.props.suspendReason; }
  get settlements()         { return this.props.settlements.map(s => ({ ...s })); }

  // ─── Commission calculation ───────────────────────────────────────────────

  calculateCommission(orderAmount: number): number {
    if (orderAmount < 0) throw new Error("Order amount cannot be negative");
    if (orderAmount === 0) return 0;

    switch (this.props.commissionType) {
      case "percentage":
        return Math.round(orderAmount * (this.props.commissionRate / 100) * 100) / 100;

      case "fixed":
        return Math.min(this.props.commissionRate, orderAmount);

      case "tiered": {
        const tier = (this.props.commissionTiers ?? []).find(t =>
          orderAmount >= t.minAmount && (t.maxAmount === undefined || orderAmount <= t.maxAmount)
        );
        if (!tier) return 0;
        return Math.round(orderAmount * (tier.rate / 100) * 100) / 100;
      }
    }
  }

  vendorEarnings(orderAmount: number): number {
    return Math.round((orderAmount - this.calculateCommission(orderAmount)) * 100) / 100;
  }

  // ─── Sales recording ──────────────────────────────────────────────────────

  recordSale(orderAmount: number): Marketplace {
    if (this.props.status !== "active") throw new Error(`Cannot record sale for ${this.props.status} vendor`);
    if (orderAmount <= 0) throw new Error("Order amount must be > 0");
    const commission = this.calculateCommission(orderAmount);
    const netEarned = orderAmount - commission;
    return new Marketplace({
      ...this.props,
      totalSales: Math.round((this.props.totalSales + orderAmount) * 100) / 100,
      pendingBalance: Math.round((this.props.pendingBalance + netEarned) * 100) / 100,
      updatedAt: new Date(),
    });
  }

  addSettlement(settlement: Settlement): Marketplace {
    if (settlement.grossAmount <= 0) throw new Error("Settlement amount must be > 0");
    if (settlement.netAmount > this.props.pendingBalance) throw new Error("Settlement net amount exceeds pending balance");
    return new Marketplace({
      ...this.props,
      settlements: [...this.props.settlements, settlement],
      pendingBalance: Math.round((this.props.pendingBalance - settlement.netAmount) * 100) / 100,
      updatedAt: new Date(),
    });
  }

  markSettled(settlementId: string, paymentReference: string): Marketplace {
    const settlement = this.props.settlements.find(s => s.id === settlementId);
    if (!settlement) throw new Error(`Settlement ${settlementId} not found`);
    if (settlement.status === "settled") throw new Error("Settlement already settled");
    if (!paymentReference.trim()) throw new Error("Payment reference required");
    const updatedSettlements = this.props.settlements.map(s =>
      s.id === settlementId
        ? { ...s, status: "settled" as SettlementStatus, settledAt: new Date(), paymentReference }
        : s
    );
    return new Marketplace({
      ...this.props,
      totalCommissionPaid: Math.round((this.props.totalCommissionPaid + settlement.commissionAmount) * 100) / 100,
      settlements: updatedSettlements,
      updatedAt: new Date(),
    });
  }

  // ─── Status machine ───────────────────────────────────────────────────────

  activate(): Marketplace {
    if (this.props.status === "deactivated") throw new Error("Cannot activate a deactivated vendor");
    return new Marketplace({ ...this.props, status: "active", suspendReason: undefined, updatedAt: new Date() });
  }

  suspend(reason: string): Marketplace {
    if (!reason.trim()) throw new Error("Suspension reason required");
    if (this.props.status !== "active") throw new Error(`Can only suspend active vendors (current: ${this.props.status})`);
    return new Marketplace({ ...this.props, status: "suspended", suspendReason: reason, updatedAt: new Date() });
  }

  deactivate(): Marketplace {
    if (this.props.status === "deactivated") throw new Error("Already deactivated");
    return new Marketplace({ ...this.props, status: "deactivated", updatedAt: new Date() });
  }

  toJSON(): VendorProps {
    return { ...this.props, settlements: this.props.settlements.map(s => ({ ...s })) };
  }
}
