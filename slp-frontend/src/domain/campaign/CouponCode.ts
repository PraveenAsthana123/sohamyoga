export type DiscountType = "percent" | "fixed_cad" | "free_class" | "free_trial_days";

export interface CouponCodeProps {
  id: string;
  code: string;              // e.g. "YOGA20", "SUMMER2026"
  description: string;
  discountType: DiscountType;
  discountValue: number;     // 20 = 20% or $20 CAD or 20 days
  maxUsageTotal: number;     // 0 = unlimited
  maxUsagePerUser: number;   // typically 1
  usageCount: number;
  minimumSpendCAD: number;   // 0 = no minimum
  validFrom: Date;
  validUntil: Date;
  applicablePlanIds: string[]; // empty = all plans
  isActive: boolean;
  campaignId?: string;
  createdById: string;
  createdAt: Date;
}

export class CouponCode {
  constructor(private props: CouponCodeProps) {
    if (!props.code.trim()) throw new Error("Coupon code is required");
    if (props.discountValue <= 0) throw new Error("Discount value must be > 0");
    if (props.discountType === "percent" && props.discountValue > 100)
      throw new Error("Percent discount cannot exceed 100");
    if (props.validUntil <= props.validFrom) throw new Error("Valid until must be after valid from");
    if (props.code !== props.code.toUpperCase()) throw new Error("Coupon code must be uppercase");
  }

  get id()             { return this.props.id; }
  get code()           { return this.props.code; }
  get description()    { return this.props.description; }
  get discountType()   { return this.props.discountType; }
  get discountValue()  { return this.props.discountValue; }
  get usageCount()     { return this.props.usageCount; }
  get maxUsageTotal()  { return this.props.maxUsageTotal; }
  get isActive()       { return this.props.isActive; }
  get validUntil()     { return this.props.validUntil; }

  isValid(): boolean {
    const now = new Date();
    return this.props.isActive &&
           now >= this.props.validFrom &&
           now <= this.props.validUntil &&
           (this.props.maxUsageTotal === 0 || this.props.usageCount < this.props.maxUsageTotal);
  }

  isValidForPlan(planId: string): boolean {
    return this.props.applicablePlanIds.length === 0 || this.props.applicablePlanIds.includes(planId);
  }

  meetsMinimumSpend(amountCAD: number): boolean {
    return amountCAD >= this.props.minimumSpendCAD;
  }

  applyDiscount(originalPriceCAD: number): number {
    if (!this.isValid()) throw new Error("Coupon is not valid");
    if (this.props.discountType === "percent") return originalPriceCAD * (1 - this.props.discountValue / 100);
    if (this.props.discountType === "fixed_cad") return Math.max(0, originalPriceCAD - this.props.discountValue);
    return originalPriceCAD; // free_class and free_trial_days handled at application layer
  }

  redeem(): CouponCode {
    if (!this.isValid()) throw new Error("Coupon is not valid");
    return new CouponCode({ ...this.props, usageCount: this.props.usageCount + 1 });
  }

  deactivate(): CouponCode {
    return new CouponCode({ ...this.props, isActive: false });
  }

  daysUntilExpiry(): number {
    return Math.max(0, Math.ceil((this.props.validUntil.getTime() - Date.now()) / 86400000));
  }

  toJSON(): CouponCodeProps { return { ...this.props, applicablePlanIds: [...this.props.applicablePlanIds] }; }
}
