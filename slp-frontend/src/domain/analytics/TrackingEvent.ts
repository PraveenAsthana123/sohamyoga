export type EventType =
  | "page_view" | "click" | "form_start" | "form_submit" | "download"
  | "booking_started" | "booking_completed"
  | "payment_initiated" | "payment_completed"
  | "subscription_started" | "error" | "scroll_depth" | "custom";

export type EventStatus = "pending" | "collected" | "masked" | "dropped";

// Any property key matching these fragments is masked before storage
export const SENSITIVE_KEY_FRAGMENTS = [
  "name", "email", "phone", "password", "card", "cvv", "health",
  "diagnosis", "message", "address", "dob", "ssn", "payment",
] as const;

export const CONVERSION_EVENT_TYPES: EventType[] = [
  "booking_completed", "payment_completed", "subscription_started",
];

export interface TrackingEventProps {
  id: string;
  sessionId: string;
  anonymousId: string;
  userId?: string;
  eventType: EventType;
  name: string;
  url: string;
  referrer?: string;
  properties: Record<string, unknown>;
  status: EventStatus;
  consentLevel: string;
  createdAt: Date;
}

export class TrackingEvent {
  constructor(private readonly props: TrackingEventProps) {
    if (!props.id)          throw new Error("id is required");
    if (!props.sessionId)   throw new Error("sessionId is required");
    if (!props.anonymousId) throw new Error("anonymousId is required");
    if (!props.name)        throw new Error("name is required");
    if (!props.url)         throw new Error("url is required");
  }

  get id()           { return this.props.id; }
  get sessionId()    { return this.props.sessionId; }
  get anonymousId()  { return this.props.anonymousId; }
  get userId()       { return this.props.userId; }
  get eventType()    { return this.props.eventType; }
  get name()         { return this.props.name; }
  get url()          { return this.props.url; }
  get referrer()     { return this.props.referrer; }
  get properties()   { return { ...this.props.properties }; }
  get status()       { return this.props.status; }
  get consentLevel() { return this.props.consentLevel; }
  get createdAt()    { return this.props.createdAt; }

  isPageView():   boolean { return this.props.eventType === "page_view"; }
  isError():      boolean { return this.props.eventType === "error"; }
  isScrollDepth():boolean { return this.props.eventType === "scroll_depth"; }
  isConversion(): boolean { return CONVERSION_EVENT_TYPES.includes(this.props.eventType); }
  isAnonymous():  boolean { return !this.props.userId; }
  isDropped():    boolean { return this.props.status === "dropped"; }
  isMasked():     boolean { return this.props.status === "masked"; }

  maskedProperties(): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(this.props.properties)) {
      const lk = key.toLowerCase();
      const isSensitive = SENSITIVE_KEY_FRAGMENTS.some(f => lk.includes(f));
      result[key] = isSensitive ? "***" : value;
    }
    return result;
  }

  mask(): TrackingEvent {
    return new TrackingEvent({
      ...this.props,
      properties: this.maskedProperties(),
      status: "masked",
    });
  }

  collect(): TrackingEvent {
    if (this.props.status !== "pending")
      throw new Error("only pending events can be collected");
    return new TrackingEvent({ ...this.props, status: "collected" });
  }

  drop(): TrackingEvent {
    return new TrackingEvent({ ...this.props, status: "dropped" });
  }

  withUser(userId: string): TrackingEvent {
    return new TrackingEvent({ ...this.props, userId });
  }

  toJSON(): TrackingEventProps {
    return { ...this.props, properties: this.maskedProperties() };
  }
}
