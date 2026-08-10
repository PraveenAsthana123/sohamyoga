// Pricing plan catalog — Silver/Gold/Platinum/Family/Corporate/Kids/Senior/Retreat/Workshop/etc.
// Holds pricing tiers (multi-currency), benefit matrix, and configurable policies.

export type PlanType =
  | "silver" | "gold" | "platinum"
  | "family" | "corporate" | "kids" | "senior"
  | "retreat" | "workshop" | "personal_training"
  | "trial" | "drop_in";

export type BillingCycle = "daily" | "weekly" | "monthly" | "quarterly" | "annual" | "one_time";
export type PlanStatus = "draft" | "active" | "deprecated" | "archived";

export interface PlanPrice {
  amount: number;
  currency: string;    // "CAD", "USD", "INR"
  billingCycle: BillingCycle;
}

export interface PlanBenefits {
  unlimitedClasses: boolean;
  classCreditsPerCycle?: number;
  workshopDiscountPercent: number;
  retreatDiscountPercent: number;
  storeDiscountPercent: number;
  priorityBooking: boolean;
  vipSeating: boolean;
  teacherConsultationMinutes: number;   // per month
  nutritionConsultationMinutes: number;
  meditationSessions: number;           // per month
  videoLibraryAccess: boolean;
  premiumContentAccess: boolean;
  certificateIssuance: boolean;
  corporateEventsAccess: boolean;
  exclusiveCommunityAccess: boolean;
}

export interface FreezePolicy {
  allowed: boolean;
  maxDaysPerYear: number;
  noticeDaysRequired: number;
  maxTimesPerYear: number;
}

export interface PausePolicy {
  allowed: boolean;
  maxDaysPerYear: number;
  maxTimesPerYear: number;
  noticeDaysRequired: number;
}

export interface FamilyConfig {
  maxSeats: number;
  primaryAccountRequired: boolean;
  sharedClassCredits: boolean;
  sharedWallet: boolean;
}

export interface CorporateConfig {
  minEmployees: number;
  maxEmployees?: number;
  departmentSubaccounts: boolean;
  bulkInvoicing: boolean;
  hrSystemIntegration: boolean;
  utilizationReporting: boolean;
}

export interface PricingPlanProps {
  id: string;
  name: string;
  slug: string;           // kebab-case, unique, e.g. "gold-monthly"
  type: PlanType;
  description: string;
  status: PlanStatus;
  prices: PlanPrice[];    // at least one price; multiple currencies/cycles
  benefits: PlanBenefits;
  gracePeriodDays: number;     // days of continued access after expiry
  freezePolicy: FreezePolicy;
  pausePolicy: PausePolicy;
  trialDays?: number;
  trialEligibility?: "first_time_only" | "no_prior_membership" | "any";
  upgradeableTo?: string[];    // plan IDs
  downgradeableTo?: string[];  // plan IDs
  familyConfig?: FamilyConfig;
  corporateConfig?: CorporateConfig;
  isGiftable: boolean;
  isTransferable: boolean;
  abTestVariantId?: string;    // A/B pricing experiment
  sortOrder: number;
  metadata: Record<string, unknown>;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

const CYCLE_DAYS: Record<BillingCycle, number> = {
  daily: 1, weekly: 7, monthly: 30, quarterly: 90, annual: 365, one_time: 1,
};

export class PricingPlan {
  constructor(private props: PricingPlanProps) {
    if (!props.name.trim()) throw new Error("Plan name required");
    if (!props.slug.trim()) throw new Error("Slug required");
    if (!/^[a-z0-9-]+$/.test(props.slug)) throw new Error("Slug must be lowercase kebab-case");
    if (props.prices.length === 0) throw new Error("At least one price required");
    if (props.prices.some(p => p.amount < 0)) throw new Error("Price amount cannot be negative");
    if (props.gracePeriodDays < 0) throw new Error("Grace period cannot be negative");
    if (props.sortOrder < 0) throw new Error("Sort order cannot be negative");
    if (props.benefits.workshopDiscountPercent < 0 || props.benefits.workshopDiscountPercent > 100)
      throw new Error("Workshop discount percent must be 0-100");
  }

  get id()           { return this.props.id; }
  get name()         { return this.props.name; }
  get slug()         { return this.props.slug; }
  get type()         { return this.props.type; }
  get status()       { return this.props.status; }
  get prices()       { return this.props.prices.map(p => ({ ...p })); }
  get benefits()     { return { ...this.props.benefits }; }
  get gracePeriodDays() { return this.props.gracePeriodDays; }
  get freezePolicy() { return { ...this.props.freezePolicy }; }
  get pausePolicy()  { return { ...this.props.pausePolicy }; }
  get isGiftable()   { return this.props.isGiftable; }
  get isTransferable() { return this.props.isTransferable; }
  get sortOrder()    { return this.props.sortOrder; }
  get upgradeableTo() { return [...(this.props.upgradeableTo ?? [])]; }
  get downgradeableTo() { return [...(this.props.downgradeableTo ?? [])]; }
  get familyConfig() { return this.props.familyConfig ? { ...this.props.familyConfig } : undefined; }
  get corporateConfig() { return this.props.corporateConfig ? { ...this.props.corporateConfig } : undefined; }
  get abTestVariantId() { return this.props.abTestVariantId; }

  priceFor(currency: string, cycle: BillingCycle): PlanPrice {
    const p = this.props.prices.find(p => p.currency === currency && p.billingCycle === cycle);
    if (!p) throw new Error(`No price for ${currency}/${cycle}`);
    return { ...p };
  }

  dailyRate(currency: string, cycle: BillingCycle): number {
    const p = this.priceFor(currency, cycle);
    return Math.round((p.amount / CYCLE_DAYS[cycle]) * 100) / 100;
  }

  canUpgradeTo(planId: string): boolean { return (this.props.upgradeableTo ?? []).includes(planId); }
  canDowngradeTo(planId: string): boolean { return (this.props.downgradeableTo ?? []).includes(planId); }
  canFreeze(): boolean { return this.props.freezePolicy.allowed; }
  canPause(): boolean  { return this.props.pausePolicy.allowed; }
  isTrialPlan(): boolean { return this.props.type === "trial"; }
  isFamilyPlan(): boolean { return this.props.type === "family"; }
  isCorporatePlan(): boolean { return this.props.type === "corporate"; }

  // --- State machine ---
  activate(): PricingPlan {
    if (this.props.status !== "draft") throw new Error("Only draft plans can be activated");
    return new PricingPlan({ ...this.props, status: "active", updatedAt: new Date() });
  }

  deprecate(): PricingPlan {
    if (this.props.status !== "active") throw new Error("Only active plans can be deprecated");
    return new PricingPlan({ ...this.props, status: "deprecated", updatedAt: new Date() });
  }

  archive(): PricingPlan {
    if (this.props.status === "archived") throw new Error("Already archived");
    return new PricingPlan({ ...this.props, status: "archived", updatedAt: new Date() });
  }

  addPrice(price: PlanPrice): PricingPlan {
    if (price.amount < 0) throw new Error("Price amount cannot be negative");
    const filtered = this.props.prices.filter(p => !(p.currency === price.currency && p.billingCycle === price.billingCycle));
    return new PricingPlan({ ...this.props, prices: [...filtered, price], updatedAt: new Date() });
  }

  removePrice(currency: string, cycle: BillingCycle): PricingPlan {
    const remaining = this.props.prices.filter(p => !(p.currency === currency && p.billingCycle === cycle));
    if (remaining.length === 0) throw new Error("Cannot remove last price — plan must have at least one");
    return new PricingPlan({ ...this.props, prices: remaining, updatedAt: new Date() });
  }

  toJSON(): PricingPlanProps {
    return { ...this.props, prices: this.props.prices.map(p => ({ ...p })), benefits: { ...this.props.benefits } };
  }
}
