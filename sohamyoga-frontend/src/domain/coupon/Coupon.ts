// Coupon & promotion domain entity
// Validation sequence: normalize → status → dates → eligibility → limits → stacking → calculate → reserve
// Backed by OfferKit (engine) + ERPNext (accounting) + Redis (reservation locking)

export type CouponType =
  | "percentage"      // 10% off
  | "fixed_amount"    // CAD 15 off
  | "free_class"      // one complimentary class
  | "buy_x_get_y"     // buy N get M free
  | "membership"      // tier-based renewal discount
  | "bundle"          // package deal
  | "referral"        // referrer + referred reward
  | "first_purchase"  // new-member only
  | "birthday"        // birthday month
  | "student_senior"  // eligibility-based
  | "corporate"       // employer/department code
  | "teacher"         // instructor campaign
  | "event"           // workshop or retreat
  | "product"         // mat, book, equipment
  | "free_shipping"   // delivery threshold waiver
  | "gift_voucher"    // stored monetary value
  | "private_unique"  // one customer, one redemption
  | "public_promo"    // shared campaign code
  | "auto_applied";   // no code required

export type CouponStatus =
  | "draft" | "pending_approval" | "scheduled" | "active"
  | "paused" | "expired" | "exhausted" | "revoked";

export type StackingRule = "combinable" | "exclusive" | "priority" | "best_discount";
export type DistributionChannel = "email" | "sms" | "qr" | "referral_link" | "social" | "printed" | "direct";
export type MembershipTier = "none" | "bronze" | "silver" | "gold" | "platinum";

export interface CouponDiscount {
  type: "percentage" | "fixed_amount" | "free_units";
  value: number;              // 10 = 10%, 15 = CAD 15, 1 = 1 free unit
  currency?: string;
  maxDiscountAmount?: number; // cap for percentage discounts
  freeUnits?: number;         // for buy_x_get_y / free_class
  requiredUnits?: number;     // minimum units for buy_x_get_y
}

export interface CouponEligibility {
  membershipTiers?: MembershipTier[];
  isNewCustomer?: boolean;
  isReturningCustomer?: boolean;
  customerSegments?: string[];
  isStudent?: boolean;
  isSenior?: boolean;
  isCorporate?: boolean;
  corporateCodes?: string[];
  minSpend?: number;
  minQuantity?: number;
  applicableProductIds?: string[];
  applicableClassIds?: string[];
  applicableCategoryIds?: string[];
  channels?: string[];
  countries?: string[];
}

export interface CouponLimits {
  globalLimit?: number;           // total redemptions allowed (undefined = unlimited)
  perCustomerLimit: number;       // per-customer redemptions
  perOrderLimit: number;          // per-order uses
  dailyLimit?: number;
  currentRedemptions: number;     // updated by event handler
}

export interface BlackoutPeriod {
  start: Date;
  end: Date;
  reason: string;
}

export interface CouponProps {
  id: string;
  code: string;             // normalized: uppercase, trimmed
  type: CouponType;
  name: string;
  description: string;
  status: CouponStatus;

  discount: CouponDiscount;
  eligibility: CouponEligibility;
  limits: CouponLimits;

  stackingRule: StackingRule;
  stackingPriority: number;  // lower = higher priority
  membershipTierPreset?: MembershipTier;

  validFrom: Date;
  validTo: Date;
  timezone: string;
  blackoutPeriods: BlackoutPeriod[];

  distributionChannels: DistributionChannel[];
  isAutoApplied: boolean;
  isSingleUse: boolean;

  // External IDs
  offerKitId?: string;
  erpnextId?: string;

  // Audit
  approvedBy?: string;
  approvedAt?: Date;
  revokedBy?: string;
  revokedReason?: string;
  pauseReason?: string;

  notes: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export class Coupon {
  constructor(private props: CouponProps) {
    if (!props.code.trim()) throw new Error("Coupon code required");
    if (props.code !== props.code.toUpperCase().trim()) throw new Error("Coupon code must be normalized to uppercase");
    if (!props.name.trim()) throw new Error("Coupon name required");
    if (props.validTo <= props.validFrom) throw new Error("Valid-to must be after valid-from");
    if (props.discount.value < 0) throw new Error("Discount value cannot be negative");
    if (props.discount.type === "percentage" && props.discount.value > 100)
      throw new Error("Percentage discount cannot exceed 100");
    if (props.limits.perCustomerLimit < 1) throw new Error("Per-customer limit must be >= 1");
    if (props.limits.perOrderLimit < 1) throw new Error("Per-order limit must be >= 1");
    if (props.limits.currentRedemptions < 0) throw new Error("Current redemptions cannot be negative");
    if (props.stackingPriority < 0) throw new Error("Stacking priority cannot be negative");
  }

  get id()                 { return this.props.id; }
  get code()               { return this.props.code; }
  get type()               { return this.props.type; }
  get name()               { return this.props.name; }
  get status()             { return this.props.status; }
  get discount()           { return { ...this.props.discount }; }
  get eligibility()        { return { ...this.props.eligibility }; }
  get limits()             { return { ...this.props.limits }; }
  get stackingRule()       { return this.props.stackingRule; }
  get stackingPriority()   { return this.props.stackingPriority; }
  get validFrom()          { return this.props.validFrom; }
  get validTo()            { return this.props.validTo; }
  get distributionChannels() { return [...this.props.distributionChannels]; }
  get isAutoApplied()      { return this.props.isAutoApplied; }
  get isSingleUse()        { return this.props.isSingleUse; }
  get approvedBy()         { return this.props.approvedBy; }
  get revokedBy()          { return this.props.revokedBy; }
  get revokedReason()      { return this.props.revokedReason; }
  get pauseReason()        { return this.props.pauseReason; }
  get offerKitId()         { return this.props.offerKitId; }
  get currentRedemptions() { return this.props.limits.currentRedemptions; }

  isDateValid(at = new Date()): boolean {
    return at >= this.props.validFrom && at <= this.props.validTo;
  }

  isInBlackout(at = new Date()): boolean {
    return this.props.blackoutPeriods.some(p => at >= p.start && at <= p.end);
  }

  isExpired(at = new Date()): boolean {
    return this.props.validTo < at;
  }

  isExhausted(): boolean {
    return this.props.limits.globalLimit !== undefined &&
      this.props.limits.currentRedemptions >= this.props.limits.globalLimit;
  }

  isActive(at = new Date()): boolean {
    return this.props.status === "active" && this.isDateValid(at) && !this.isInBlackout(at) && !this.isExhausted();
  }

  remainingUses(): number | null {
    if (this.props.limits.globalLimit === undefined) return null; // unlimited
    return Math.max(0, this.props.limits.globalLimit - this.props.limits.currentRedemptions);
  }

  isExclusive(): boolean { return this.props.stackingRule === "exclusive"; }

  canStackWith(other: Coupon): boolean {
    if (this.isExclusive() || other.isExclusive()) return false;
    if (this.props.stackingRule === "combinable" && other.props.stackingRule === "combinable") return true;
    return false;
  }

  isEligibleForTier(tier: MembershipTier): boolean {
    const tiers = this.props.eligibility.membershipTiers;
    if (!tiers || tiers.length === 0) return true; // no restriction
    return tiers.includes(tier);
  }

  calculateDiscount(orderAmount: number, unitPrice?: number): number {
    if (!this.isActive()) throw new Error("Coupon is not active");
    if (orderAmount < 0) throw new Error("Order amount cannot be negative");
    const d = this.props.discount;
    switch (d.type) {
      case "percentage": {
        const raw = orderAmount * (d.value / 100);
        return d.maxDiscountAmount !== undefined ? Math.min(raw, d.maxDiscountAmount) : raw;
      }
      case "fixed_amount":
        return Math.min(orderAmount, d.value);
      case "free_units": {
        if (unitPrice === undefined) throw new Error("Unit price required for free_units discount");
        return (d.freeUnits ?? 1) * unitPrice;
      }
    }
  }

  // --- State machine ---
  submit(): Coupon {
    if (this.props.status !== "draft") throw new Error("Only draft coupons can be submitted for approval");
    return new Coupon({ ...this.props, status: "pending_approval", updatedAt: new Date() });
  }

  approve(approvedBy: string): Coupon {
    if (!approvedBy.trim()) throw new Error("Approver ID required");
    if (this.props.status !== "pending_approval") throw new Error("Only pending coupons can be approved");
    const now = new Date();
    const newStatus: CouponStatus = this.props.validFrom > now ? "scheduled" : "active";
    return new Coupon({ ...this.props, status: newStatus, approvedBy, approvedAt: new Date(), updatedAt: new Date() });
  }

  reject(reason: string): Coupon {
    if (!reason.trim()) throw new Error("Rejection reason required");
    if (this.props.status !== "pending_approval") throw new Error("Only pending coupons can be rejected");
    return new Coupon({ ...this.props, status: "draft", updatedAt: new Date() });
  }

  activate(): Coupon {
    if (!["scheduled", "paused"].includes(this.props.status)) throw new Error("Can only activate scheduled or paused coupons");
    return new Coupon({ ...this.props, status: "active", updatedAt: new Date() });
  }

  pause(reason: string): Coupon {
    if (!reason.trim()) throw new Error("Pause reason required");
    if (this.props.status !== "active") throw new Error("Only active coupons can be paused");
    return new Coupon({ ...this.props, status: "paused", pauseReason: reason, updatedAt: new Date() });
  }

  revoke(revokedBy: string, reason: string): Coupon {
    if (!revokedBy.trim()) throw new Error("Revoking user ID required");
    if (!reason.trim()) throw new Error("Revocation reason required");
    if (this.props.status === "revoked") throw new Error("Already revoked");
    return new Coupon({ ...this.props, status: "revoked", revokedBy, revokedReason: reason, updatedAt: new Date() });
  }

  incrementRedemption(): Coupon {
    const newCount = this.props.limits.currentRedemptions + 1;
    const newStatus: CouponStatus =
      this.props.limits.globalLimit !== undefined && newCount >= this.props.limits.globalLimit
        ? "exhausted"
        : this.props.status;
    return new Coupon({ ...this.props, limits: { ...this.props.limits, currentRedemptions: newCount }, status: newStatus, updatedAt: new Date() });
  }

  addBlackout(period: BlackoutPeriod): Coupon {
    if (period.end <= period.start) throw new Error("Blackout end must be after start");
    return new Coupon({ ...this.props, blackoutPeriods: [...this.props.blackoutPeriods, period], updatedAt: new Date() });
  }

  linkOfferKit(id: string): Coupon {
    return new Coupon({ ...this.props, offerKitId: id, updatedAt: new Date() });
  }

  toJSON(): CouponProps {
    return { ...this.props, blackoutPeriods: [...this.props.blackoutPeriods], distributionChannels: [...this.props.distributionChannels] };
  }
}

export function normalizeCouponCode(code: string): string {
  return code.trim().toUpperCase().replace(/\s+/g, "");
}
