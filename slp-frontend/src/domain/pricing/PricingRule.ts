// Pricing rule engine — 13 rule types, priority-based, stackable or exclusive
// Application layer evaluates all matching rules and picks winner based on stacking behavior.

export type PricingRuleType =
  | "buy_x_get_y"               // buy 10 classes → 1 free
  | "percentage_off"            // 20% off
  | "fixed_amount_off"          // CAD 15 off
  | "free_item"                 // free workshop / product
  | "membership_upgrade_credit" // prorated credit on upgrade
  | "early_bird"                // booked >= N days before class
  | "last_minute"               // booked < N hours before class
  | "seasonal"                  // date-range window
  | "peak_off_peak"             // time-of-day / day-of-week
  | "occupancy_based"           // class < X% full → off-peak discount
  | "birthday"                  // N days around customer birthday
  | "first_purchase"            // first order only
  | "referral_reward";          // referred customer discount

export type CustomerSegment =
  | "all" | "silver" | "gold" | "platinum" | "corporate" | "family"
  | "student" | "senior" | "kids" | "teacher" | "new" | "returning";

export type DayOfWeek = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";
export type RuleStatus = "draft" | "active" | "paused" | "exhausted" | "archived";
export type StackingBehavior = "combinable" | "exclusive" | "best_wins";

export interface PricingCondition {
  segments?: CustomerSegment[];
  daysOfWeek?: DayOfWeek[];
  startHour?: number;                  // 0-23 (inclusive)
  endHour?: number;                    // 0-23 (inclusive)
  validFrom?: Date;
  validTo?: Date;
  minQuantity?: number;
  minOrderAmount?: number;
  maxOccupancyPercent?: number;        // for off-peak: trigger when class < X% full
  minOccupancyPercent?: number;        // for peak: trigger when class > X% full
  daysBefore?: number;                 // early_bird: booked at least N days ahead
  hoursBeforeCutoff?: number;          // last_minute: booked < N hours before
  birthdayWindowDays?: number;         // N days around birthday (default 7)
  applicableProductIds?: string[];
  applicablePlanIds?: string[];
}

export interface PricingAction {
  type: "percentage_discount" | "fixed_discount" | "free_units" | "upgrade_credit_percent";
  value: number;               // 10 = 10%, 15 = CAD 15, etc.
  maxDiscountAmount?: number;  // cap on percentage discount
  freeUnits?: number;          // for buy_x_get_y / free_item
  requiredUnits?: number;      // buy N before getting free units
  freeItemId?: string;         // for free_item type
  currency?: string;
}

export interface PricingRuleProps {
  id: string;
  name: string;
  description: string;
  type: PricingRuleType;
  status: RuleStatus;
  priority: number;            // lower = applied first (1 = highest)
  stackingBehavior: StackingBehavior;
  condition: PricingCondition;
  action: PricingAction;
  maxApplicationsPerCustomer?: number;
  maxApplicationsTotal?: number;
  currentApplications: number;
  notes: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export class PricingRule {
  constructor(private props: PricingRuleProps) {
    if (!props.name.trim()) throw new Error("Rule name required");
    if (props.priority < 1) throw new Error("Priority must be >= 1");
    if (props.action.value < 0) throw new Error("Action value cannot be negative");
    if (props.action.type === "percentage_discount" && props.action.value > 100)
      throw new Error("Percentage discount cannot exceed 100");
    if (props.currentApplications < 0) throw new Error("Current applications cannot be negative");
    if (props.condition.startHour !== undefined && (props.condition.startHour < 0 || props.condition.startHour > 23))
      throw new Error("startHour must be 0-23");
    if (props.condition.endHour !== undefined && (props.condition.endHour < 0 || props.condition.endHour > 23))
      throw new Error("endHour must be 0-23");
  }

  get id()                  { return this.props.id; }
  get name()                { return this.props.name; }
  get type()                { return this.props.type; }
  get status()              { return this.props.status; }
  get priority()            { return this.props.priority; }
  get stackingBehavior()    { return this.props.stackingBehavior; }
  get condition()           { return { ...this.props.condition }; }
  get action()              { return { ...this.props.action }; }
  get currentApplications() { return this.props.currentApplications; }

  isExpired(at = new Date()): boolean {
    return this.props.condition.validTo !== undefined && this.props.condition.validTo < at;
  }

  isExhausted(): boolean {
    return this.props.maxApplicationsTotal !== undefined &&
      this.props.currentApplications >= this.props.maxApplicationsTotal;
  }

  isApplicable(at = new Date()): boolean {
    if (this.props.status !== "active") return false;
    if (this.isExpired(at)) return false;
    if (this.isExhausted()) return false;
    if (this.props.condition.validFrom && at < this.props.condition.validFrom) return false;
    return true;
  }

  applyToAmount(orderAmount: number, unitPrice?: number): number {
    if (!this.isApplicable()) throw new Error("Rule is not applicable");
    if (orderAmount < 0) throw new Error("Order amount cannot be negative");
    const a = this.props.action;
    switch (a.type) {
      case "percentage_discount": {
        const raw = orderAmount * (a.value / 100);
        return a.maxDiscountAmount !== undefined ? Math.min(raw, a.maxDiscountAmount) : raw;
      }
      case "fixed_discount":
        return Math.min(orderAmount, a.value);
      case "free_units": {
        if (unitPrice === undefined) throw new Error("Unit price required for free_units");
        return (a.freeUnits ?? 1) * unitPrice;
      }
      case "upgrade_credit_percent":
        return orderAmount * (a.value / 100);
    }
  }

  incrementApplications(): PricingRule {
    const newCount = this.props.currentApplications + 1;
    const newStatus: RuleStatus =
      this.props.maxApplicationsTotal !== undefined && newCount >= this.props.maxApplicationsTotal
        ? "exhausted"
        : this.props.status;
    return new PricingRule({ ...this.props, currentApplications: newCount, status: newStatus, updatedAt: new Date() });
  }

  // --- State machine ---
  activate(): PricingRule {
    if (this.props.status !== "draft") throw new Error("Only draft rules can be activated");
    return new PricingRule({ ...this.props, status: "active", updatedAt: new Date() });
  }

  pause(): PricingRule {
    if (this.props.status !== "active") throw new Error("Only active rules can be paused");
    return new PricingRule({ ...this.props, status: "paused", updatedAt: new Date() });
  }

  resume(): PricingRule {
    if (this.props.status !== "paused") throw new Error("Only paused rules can be resumed");
    return new PricingRule({ ...this.props, status: "active", updatedAt: new Date() });
  }

  archive(): PricingRule {
    if (this.props.status === "archived") throw new Error("Already archived");
    return new PricingRule({ ...this.props, status: "archived", updatedAt: new Date() });
  }

  toJSON(): PricingRuleProps { return { ...this.props, condition: { ...this.props.condition }, action: { ...this.props.action } }; }
}

export const CYCLE_DAYS: Record<string, number> = {
  daily: 1, weekly: 7, monthly: 30, quarterly: 90, annual: 365, one_time: 1,
};
