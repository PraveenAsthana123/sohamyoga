// Customer subscription — active lifecycle with proration, pause, freeze, and grace period
// State machine: trial → active → paused → frozen → grace_period → expired → cancelled
// pause/resume automatically extends expiresAt to compensate for lost days
// freeze extends expiresAt at the point of freezing (pre-committed)

import type { PlanType, BillingCycle } from "./PricingPlan";

export type SubscriptionStatus =
  | "trial" | "active" | "paused" | "frozen" | "grace_period" | "expired" | "cancelled";

export interface FamilySeat {
  customerId: string;
  memberName: string;
  addedAt: Date;
  status: "active" | "removed";
}

export interface SubscriptionProps {
  id: string;
  customerId: string;
  planId: string;
  planName: string;
  planType: PlanType;

  status: SubscriptionStatus;

  billingCycle: BillingCycle;
  billingAmount: number;
  currency: string;
  billingCycleDays: number;      // 30, 90, 365

  startedAt: Date;
  expiresAt: Date;
  renewsAt?: Date;
  cancelledAt?: Date;
  cancelReason?: string;
  pausedAt?: Date;
  pauseReason?: string;
  frozenFrom?: Date;
  frozenTo?: Date;
  gracePeriodEndsAt?: Date;

  autoRenew: boolean;
  pendingDowngradePlanId?: string;  // effective next billing cycle

  // Family / corporate
  familySeats: FamilySeat[];
  corporateDepartment?: string;
  corporateContractId?: string;

  // Credits
  prorationCredit: number;

  notes: string;
  createdAt: Date;
  updatedAt: Date;
}

export class Subscription {
  constructor(private props: SubscriptionProps) {
    if (!props.customerId.trim()) throw new Error("Customer ID required");
    if (!props.planId.trim()) throw new Error("Plan ID required");
    if (props.billingAmount < 0) throw new Error("Billing amount cannot be negative");
    if (props.billingCycleDays < 1) throw new Error("Billing cycle days must be >= 1");
    if (props.prorationCredit < 0) throw new Error("Proration credit cannot be negative");
    if (props.expiresAt <= props.startedAt) throw new Error("expiresAt must be after startedAt");
  }

  get id()               { return this.props.id; }
  get customerId()       { return this.props.customerId; }
  get planId()           { return this.props.planId; }
  get planName()         { return this.props.planName; }
  get planType()         { return this.props.planType; }
  get status()           { return this.props.status; }
  get billingAmount()    { return this.props.billingAmount; }
  get billingCycle()     { return this.props.billingCycle; }
  get currency()         { return this.props.currency; }
  get billingCycleDays() { return this.props.billingCycleDays; }
  get startedAt()        { return this.props.startedAt; }
  get expiresAt()        { return this.props.expiresAt; }
  get renewsAt()         { return this.props.renewsAt; }
  get cancelledAt()      { return this.props.cancelledAt; }
  get cancelReason()     { return this.props.cancelReason; }
  get pausedAt()         { return this.props.pausedAt; }
  get pauseReason()      { return this.props.pauseReason; }
  get frozenFrom()       { return this.props.frozenFrom; }
  get frozenTo()         { return this.props.frozenTo; }
  get gracePeriodEndsAt() { return this.props.gracePeriodEndsAt; }
  get autoRenew()        { return this.props.autoRenew; }
  get pendingDowngradePlanId() { return this.props.pendingDowngradePlanId; }
  get familySeats()      { return this.props.familySeats.map(s => ({ ...s })); }
  get prorationCredit()  { return this.props.prorationCredit; }

  daysRemaining(at = new Date()): number {
    return Math.max(0, Math.ceil((this.props.expiresAt.getTime() - at.getTime()) / 86400000));
  }

  calculateProratedCredit(at = new Date()): number {
    const remaining = this.daysRemaining(at);
    if (remaining <= 0 || this.props.billingCycleDays === 0) return 0;
    return Math.round((remaining / this.props.billingCycleDays) * this.props.billingAmount * 100) / 100;
  }

  isInGracePeriod(at = new Date()): boolean {
    return this.props.status === "grace_period" &&
      this.props.gracePeriodEndsAt !== undefined &&
      this.props.gracePeriodEndsAt > at;
  }

  hasActiveFamilySeat(customerId: string): boolean {
    return this.props.familySeats.some(s => s.customerId === customerId && s.status === "active");
  }

  activeFamilySeatCount(): number {
    return this.props.familySeats.filter(s => s.status === "active").length;
  }

  // --- State machine ---
  activateTrial(): Subscription {
    if (this.props.status !== "trial") throw new Error("Can only activate a trial subscription");
    return new Subscription({ ...this.props, status: "active", updatedAt: new Date() });
  }

  pause(reason: string, at = new Date()): Subscription {
    if (!reason.trim()) throw new Error("Pause reason required");
    if (this.props.status !== "active") throw new Error("Can only pause an active subscription");
    return new Subscription({ ...this.props, status: "paused", pausedAt: at, pauseReason: reason, updatedAt: new Date() });
  }

  resume(at = new Date()): Subscription {
    if (this.props.status !== "paused") throw new Error("Can only resume a paused subscription");
    const pausedAt = this.props.pausedAt!;
    const pausedMs = at.getTime() - pausedAt.getTime();
    const newExpiresAt = new Date(this.props.expiresAt.getTime() + pausedMs);
    return new Subscription({ ...this.props, status: "active", pausedAt: undefined, pauseReason: undefined, expiresAt: newExpiresAt, updatedAt: new Date() });
  }

  freeze(from: Date, to: Date): Subscription {
    if (this.props.status !== "active") throw new Error("Can only freeze an active subscription");
    if (to <= from) throw new Error("Freeze end must be after freeze start");
    const frozenMs = to.getTime() - from.getTime();
    const newExpiresAt = new Date(this.props.expiresAt.getTime() + frozenMs);
    return new Subscription({ ...this.props, status: "frozen", frozenFrom: from, frozenTo: to, expiresAt: newExpiresAt, updatedAt: new Date() });
  }

  unfreeze(): Subscription {
    if (this.props.status !== "frozen") throw new Error("Can only unfreeze a frozen subscription");
    return new Subscription({ ...this.props, status: "active", frozenFrom: undefined, frozenTo: undefined, updatedAt: new Date() });
  }

  enterGracePeriod(graceDays: number): Subscription {
    if (graceDays < 1) throw new Error("Grace period must be at least 1 day");
    const gracePeriodEndsAt = new Date(Date.now() + graceDays * 86400000);
    return new Subscription({ ...this.props, status: "grace_period", gracePeriodEndsAt, updatedAt: new Date() });
  }

  expire(): Subscription {
    if (this.props.status === "cancelled") throw new Error("Cannot expire a cancelled subscription");
    return new Subscription({ ...this.props, status: "expired", updatedAt: new Date() });
  }

  cancel(reason: string): Subscription {
    if (!reason.trim()) throw new Error("Cancellation reason required");
    if (this.props.status === "cancelled") throw new Error("Already cancelled");
    return new Subscription({ ...this.props, status: "cancelled", cancelReason: reason, cancelledAt: new Date(), updatedAt: new Date() });
  }

  cancelWithCredit(reason: string, credit: number): Subscription {
    if (!reason.trim()) throw new Error("Cancellation reason required");
    if (credit < 0) throw new Error("Credit cannot be negative");
    if (this.props.status === "cancelled") throw new Error("Already cancelled");
    return new Subscription({ ...this.props, status: "cancelled", cancelReason: reason, cancelledAt: new Date(), prorationCredit: credit, updatedAt: new Date() });
  }

  scheduleDowngrade(planId: string): Subscription {
    if (!planId.trim()) throw new Error("Plan ID required");
    if (!["active", "paused"].includes(this.props.status)) throw new Error("Can only schedule downgrade for active or paused subscriptions");
    return new Subscription({ ...this.props, pendingDowngradePlanId: planId, updatedAt: new Date() });
  }

  setAutoRenew(enabled: boolean): Subscription {
    return new Subscription({ ...this.props, autoRenew: enabled, updatedAt: new Date() });
  }

  addFamilySeat(customerId: string, memberName: string, maxSeats: number): Subscription {
    if (!customerId.trim()) throw new Error("Customer ID required");
    if (this.activeFamilySeatCount() >= maxSeats) throw new Error(`Family seat limit (${maxSeats}) reached`);
    if (this.hasActiveFamilySeat(customerId)) throw new Error("Customer already has a family seat");
    const seat: FamilySeat = { customerId, memberName, addedAt: new Date(), status: "active" };
    return new Subscription({ ...this.props, familySeats: [...this.props.familySeats, seat], updatedAt: new Date() });
  }

  removeFamilySeat(customerId: string): Subscription {
    const seat = this.props.familySeats.find(s => s.customerId === customerId && s.status === "active");
    if (!seat) throw new Error("Active family seat not found");
    const updated = this.props.familySeats.map(s =>
      s.customerId === customerId ? { ...s, status: "removed" as const } : s
    );
    return new Subscription({ ...this.props, familySeats: updated, updatedAt: new Date() });
  }

  toJSON(): SubscriptionProps {
    return { ...this.props, familySeats: this.props.familySeats.map(s => ({ ...s })) };
  }
}
