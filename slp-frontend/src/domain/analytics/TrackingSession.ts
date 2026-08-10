export type SessionStatus = "active" | "idle" | "ended";
export type DeviceType = "desktop" | "mobile" | "tablet" | "unknown";
export type TrafficSource = "direct" | "search" | "social" | "email" | "referral" | "paid";

export interface SessionDevice {
  type: DeviceType;
  browser: string;
  os: string;
  screenWidth?: number;
  screenHeight?: number;
}

export interface TrackingSessionProps {
  id: string;
  anonymousId: string;
  userId?: string;
  status: SessionStatus;
  startedAt: Date;
  lastSeenAt: Date;
  endedAt?: Date;
  pageCount: number;
  eventCount: number;
  device: SessionDevice;
  country?: string;
  referrer?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  landingUrl: string;
  exitUrl?: string;
  scrollDepthPct?: number;   // 0–100, max reached across session
  replayAvailable?: boolean;
}

export class TrackingSession {
  constructor(private readonly props: TrackingSessionProps) {
    if (!props.id)          throw new Error("id is required");
    if (!props.anonymousId) throw new Error("anonymousId is required");
    if (!props.landingUrl)  throw new Error("landingUrl is required");
    if (props.pageCount < 0)  throw new Error("pageCount must be >= 0");
    if (props.eventCount < 0) throw new Error("eventCount must be >= 0");
    if (props.endedAt && props.endedAt <= props.startedAt)
      throw new Error("endedAt must be after startedAt");
    if (props.scrollDepthPct !== undefined && (props.scrollDepthPct < 0 || props.scrollDepthPct > 100))
      throw new Error("scrollDepthPct must be 0–100");
  }

  get id()              { return this.props.id; }
  get anonymousId()     { return this.props.anonymousId; }
  get userId()          { return this.props.userId; }
  get status()          { return this.props.status; }
  get startedAt()       { return this.props.startedAt; }
  get lastSeenAt()      { return this.props.lastSeenAt; }
  get endedAt()         { return this.props.endedAt; }
  get pageCount()       { return this.props.pageCount; }
  get eventCount()      { return this.props.eventCount; }
  get device()          { return { ...this.props.device }; }
  get country()         { return this.props.country; }
  get referrer()        { return this.props.referrer; }
  get utmSource()       { return this.props.utmSource; }
  get utmMedium()       { return this.props.utmMedium; }
  get utmCampaign()     { return this.props.utmCampaign; }
  get landingUrl()      { return this.props.landingUrl; }
  get exitUrl()         { return this.props.exitUrl; }
  get scrollDepthPct()  { return this.props.scrollDepthPct; }
  get replayAvailable() { return this.props.replayAvailable ?? false; }

  isActive():          boolean { return this.props.status === "active"; }
  isEnded():           boolean { return this.props.status === "ended"; }
  isAuthenticated():   boolean { return !!this.props.userId; }
  isBounce():          boolean { return this.props.pageCount <= 1 && this.props.status === "ended"; }

  durationSeconds(at?: Date): number {
    const end = this.props.endedAt ?? at ?? this.props.lastSeenAt;
    return Math.max(0, Math.round((end.getTime() - this.props.startedAt.getTime()) / 1000));
  }

  durationMinutes(at?: Date): number {
    return Math.round((this.durationSeconds(at) / 60) * 10) / 10;
  }

  trafficSource(): TrafficSource {
    const med = (this.props.utmMedium ?? "").toLowerCase();
    const src = (this.props.utmSource ?? "").toLowerCase();
    const ref = (this.props.referrer ?? "").toLowerCase();

    if (med === "email" || src === "email") return "email";
    if (med === "cpc" || med === "paid" || med === "ppc") return "paid";
    if (med === "social" || ["instagram", "facebook", "twitter", "linkedin", "youtube"].includes(src)) return "social";
    if (src === "google" || src === "bing" || ref.includes("google.") || ref.includes("bing.")) return "search";
    if (!ref && !src) return "direct";
    return "referral";
  }

  end(exitUrl: string, endedAt: Date): TrackingSession {
    if (this.props.status === "ended") throw new Error("session already ended");
    if (endedAt <= this.props.startedAt) throw new Error("endedAt must be after startedAt");
    return new TrackingSession({ ...this.props, status: "ended", endedAt, exitUrl });
  }

  markIdle(): TrackingSession {
    if (this.props.status === "ended") throw new Error("cannot idle an ended session");
    return new TrackingSession({ ...this.props, status: "idle" });
  }

  resume(lastSeenAt: Date): TrackingSession {
    return new TrackingSession({ ...this.props, status: "active", lastSeenAt });
  }

  recordPageView(lastSeenAt: Date): TrackingSession {
    return new TrackingSession({
      ...this.props,
      pageCount: this.props.pageCount + 1,
      eventCount: this.props.eventCount + 1,
      lastSeenAt,
    });
  }

  recordEvent(lastSeenAt: Date): TrackingSession {
    return new TrackingSession({
      ...this.props,
      eventCount: this.props.eventCount + 1,
      lastSeenAt,
    });
  }

  updateScrollDepth(pct: number): TrackingSession {
    if (pct < 0 || pct > 100) throw new Error("scrollDepthPct must be 0–100");
    const current = this.props.scrollDepthPct ?? 0;
    return new TrackingSession({
      ...this.props,
      scrollDepthPct: Math.max(current, pct),
    });
  }

  identify(userId: string): TrackingSession {
    if (!userId) throw new Error("userId is required");
    return new TrackingSession({ ...this.props, userId });
  }

  markReplayAvailable(): TrackingSession {
    return new TrackingSession({ ...this.props, replayAvailable: true });
  }
}
