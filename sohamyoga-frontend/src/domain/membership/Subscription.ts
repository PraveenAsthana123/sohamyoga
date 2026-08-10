export type SubscriptionStatus =
  | "TRIALING"
  | "ACTIVE"
  | "PAST_DUE"
  | "CANCELLED"
  | "PAUSED"
  | "EXPIRED";

export interface SubscriptionProps {
  id: string;
  memberId: string;
  planId: string;
  status: SubscriptionStatus;
  stripeSubscriptionId?: string;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
  trialEnd?: Date;
  pausedUntil?: Date;
  createdAt: Date;
}

export class SubscriptionStartedEvent {
  readonly type = "SubscriptionStarted" as const;
  constructor(public readonly memberId: string, public readonly planId: string) {}
}
export class SubscriptionCancelledEvent {
  readonly type = "SubscriptionCancelled" as const;
  constructor(public readonly memberId: string, public readonly atPeriodEnd: boolean) {}
}
export class SubscriptionPausedEvent {
  readonly type = "SubscriptionPaused" as const;
  constructor(public readonly memberId: string, public readonly until: Date) {}
}

export class Subscription {
  private _events: (SubscriptionStartedEvent | SubscriptionCancelledEvent | SubscriptionPausedEvent)[] = [];

  constructor(private props: SubscriptionProps) {}

  get id()                  { return this.props.id; }
  get memberId()            { return this.props.memberId; }
  get planId()              { return this.props.planId; }
  get status()              { return this.props.status; }
  get stripeSubscriptionId(){ return this.props.stripeSubscriptionId; }
  get currentPeriodEnd()    { return this.props.currentPeriodEnd; }
  get cancelAtPeriodEnd()   { return this.props.cancelAtPeriodEnd; }
  get trialEnd()            { return this.props.trialEnd; }
  get domainEvents()        { return [...this._events]; }

  isActive(): boolean {
    return this.props.status === "ACTIVE" || this.props.status === "TRIALING";
  }

  isTrialing(): boolean {
    return this.props.status === "TRIALING" && !!this.props.trialEnd && this.props.trialEnd > new Date();
  }

  daysUntilRenewal(): number {
    return Math.ceil((this.props.currentPeriodEnd.getTime() - Date.now()) / 86400000);
  }

  cancelAtEndOfPeriod(): Subscription {
    if (!this.isActive()) throw new Error("Cannot cancel an inactive subscription");
    this.props = { ...this.props, cancelAtPeriodEnd: true };
    this._events.push(new SubscriptionCancelledEvent(this.props.memberId, true));
    return this;
  }

  cancelImmediately(): Subscription {
    this.props = { ...this.props, status: "CANCELLED", cancelAtPeriodEnd: false };
    this._events.push(new SubscriptionCancelledEvent(this.props.memberId, false));
    return this;
  }

  pause(until: Date): Subscription {
    if (!this.isActive()) throw new Error("Only active subscriptions can be paused");
    if (until <= new Date()) throw new Error("Pause end date must be in the future");
    this.props = { ...this.props, status: "PAUSED", pausedUntil: until };
    this._events.push(new SubscriptionPausedEvent(this.props.memberId, until));
    return this;
  }

  resume(): Subscription {
    if (this.props.status !== "PAUSED") throw new Error("Only paused subscriptions can be resumed");
    this.props = { ...this.props, status: "ACTIVE", pausedUntil: undefined };
    return this;
  }

  static create(props: Omit<SubscriptionProps, "createdAt" | "cancelAtPeriodEnd">): Subscription {
    const s = new Subscription({ ...props, createdAt: new Date(), cancelAtPeriodEnd: false });
    s._events.push(new SubscriptionStartedEvent(props.memberId, props.planId));
    return s;
  }

  toJSON(): SubscriptionProps { return { ...this.props }; }
}
