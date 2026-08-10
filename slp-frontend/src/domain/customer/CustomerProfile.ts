// Customer profile — managed by ERPNext + Frappe CRM; yoga-specific layer custom

export type CustomerType = "individual" | "corporate" | "family";
export type CustomerLifecycle = "lead" | "prospect" | "active" | "at_risk" | "churned" | "vip" | "alumni";
export type AcquisitionSource = "organic_search" | "social_media" | "referral" | "walk_in" | "event" | "google_ads" | "email_campaign" | "partner";

export interface CustomerProfileProps {
  id: string;
  userId?: string;              // linked portal account (may not exist for leads)

  // External system IDs
  erpnextCustomerId?: string;
  frappeCrmLeadId?: string;
  chatwootContactId?: string;
  posthogDistinctId?: string;   // PostHog analytics identity

  // Core
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  company?: string;
  type: CustomerType;
  lifecycle: CustomerLifecycle;
  acquisitionSource: AcquisitionSource;
  referredBy?: string;          // customerId of referrer

  // Financial (mirrored from ERPNext)
  currency: string;
  lifetimeValue: number;
  totalInvoiced: number;
  totalPaid: number;
  outstandingBalance: number;
  creditLimit: number;

  // Loyalty (from ERPNext loyalty program)
  loyaltyPoints: number;
  loyaltyTier: "bronze" | "silver" | "gold" | "platinum";

  // Engagement (mirrored from PostHog)
  lastActiveAt?: Date;
  totalSessions: number;
  npsScore?: number;           // -100 to +100
  csat?: number;               // 1–5

  // Tags and segments for CRM
  tags: string[];
  segments: string[];          // e.g. "at_risk_churn", "birthday_this_month"

  // Address
  city?: string;
  province?: string;
  country: string;
  postalCode?: string;

  notes: string;
  gdprConsentAt?: Date;
  doNotContact: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class CustomerProfile {
  constructor(private props: CustomerProfileProps) {
    if (!props.firstName.trim()) throw new Error("First name required");
    if (!props.lastName.trim()) throw new Error("Last name required");
    if (!props.email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) throw new Error("Invalid email");
    if (props.lifetimeValue < 0) throw new Error("Lifetime value cannot be negative");
    if (props.loyaltyPoints < 0) throw new Error("Loyalty points cannot be negative");
    if (props.npsScore !== undefined && (props.npsScore < -100 || props.npsScore > 100))
      throw new Error("NPS score must be -100 to +100");
  }

  get id()              { return this.props.id; }
  get lifecycle()       { return this.props.lifecycle; }
  get fullName()        { return `${this.props.firstName} ${this.props.lastName}`; }
  get email()           { return this.props.email; }
  get phone()           { return this.props.phone; }
  get lifetimeValue()   { return this.props.lifetimeValue; }
  get loyaltyPoints()   { return this.props.loyaltyPoints; }
  get loyaltyTier()     { return this.props.loyaltyTier; }
  get outstandingBalance(){ return this.props.outstandingBalance; }
  get npsScore()        { return this.props.npsScore; }
  get tags()            { return [...this.props.tags]; }
  get segments()        { return [...this.props.segments]; }
  get erpnextCustomerId(){ return this.props.erpnextCustomerId; }
  get frappeCrmLeadId() { return this.props.frappeCrmLeadId; }
  get doNotContact()    { return this.props.doNotContact; }
  get acquisitionSource(){ return this.props.acquisitionSource; }

  paymentRate(): number {
    if (this.props.totalInvoiced === 0) return 0;
    return Math.round((this.props.totalPaid / this.props.totalInvoiced) * 100);
  }

  isAtRisk(): boolean {
    return this.props.lifecycle === "at_risk" ||
      (this.props.lifecycle === "active" && this.props.lastActiveAt !== undefined &&
        Date.now() - this.props.lastActiveAt.getTime() > 30 * 86400000);
  }

  isVip(): boolean {
    return this.props.lifecycle === "vip" || this.props.loyaltyTier === "platinum" || this.props.lifetimeValue >= 5000;
  }

  npsCategory(): "promoter" | "passive" | "detractor" | "unknown" {
    if (this.props.npsScore === undefined) return "unknown";
    if (this.props.npsScore >= 70) return "promoter";
    if (this.props.npsScore >= 0) return "passive";
    return "detractor";
  }

  computedLoyaltyTier(): "bronze" | "silver" | "gold" | "platinum" {
    if (this.props.lifetimeValue >= 5000 || this.props.loyaltyPoints >= 10000) return "platinum";
    if (this.props.lifetimeValue >= 2000 || this.props.loyaltyPoints >= 5000) return "gold";
    if (this.props.lifetimeValue >= 500 || this.props.loyaltyPoints >= 1000) return "silver";
    return "bronze";
  }

  promote(to: CustomerLifecycle): CustomerProfile {
    return new CustomerProfile({ ...this.props, lifecycle: to, updatedAt: new Date() });
  }

  addLoyaltyPoints(points: number): CustomerProfile {
    if (points <= 0) throw new Error("Points must be positive");
    const newPoints = this.props.loyaltyPoints + points;
    return new CustomerProfile({ ...this.props, loyaltyPoints: newPoints, loyaltyTier: this.computedLoyaltyTierFor(newPoints, this.props.lifetimeValue), updatedAt: new Date() });
  }

  private computedLoyaltyTierFor(points: number, ltv: number): "bronze" | "silver" | "gold" | "platinum" {
    if (ltv >= 5000 || points >= 10000) return "platinum";
    if (ltv >= 2000 || points >= 5000) return "gold";
    if (ltv >= 500 || points >= 1000) return "silver";
    return "bronze";
  }

  addTag(tag: string): CustomerProfile {
    if (this.props.tags.includes(tag)) return this;
    return new CustomerProfile({ ...this.props, tags: [...this.props.tags, tag], updatedAt: new Date() });
  }

  removeTag(tag: string): CustomerProfile {
    return new CustomerProfile({ ...this.props, tags: this.props.tags.filter(t => t !== tag), updatedAt: new Date() });
  }

  markDoNotContact(): CustomerProfile {
    return new CustomerProfile({ ...this.props, doNotContact: true, updatedAt: new Date() });
  }

  toJSON(): CustomerProfileProps {
    return { ...this.props, tags: [...this.props.tags], segments: [...this.props.segments] };
  }
}
