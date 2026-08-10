import { describe, it, expect } from "@jest/globals";
import { TrackingEvent, SENSITIVE_KEY_FRAGMENTS, CONVERSION_EVENT_TYPES, type EventType } from "../../../domain/analytics/TrackingEvent";

const NOW = new Date("2026-08-05T10:00:00Z");

function makeEvent(overrides: Partial<ConstructorParameters<typeof TrackingEvent>[0]> = {}): TrackingEvent {
  return new TrackingEvent({
    id: "ev-1",
    sessionId: "sess-1",
    anonymousId: "anon-abc",
    eventType: "page_view",
    name: "Page Viewed",
    url: "https://sohamyoga.ca/classes",
    properties: {},
    status: "pending",
    consentLevel: "analytics",
    createdAt: NOW,
    ...overrides,
  });
}

// ── Construction validation ──────────────────────────────────────────────────

describe("TrackingEvent — construction", () => {
  it("creates a valid event", () => {
    const ev = makeEvent();
    expect(ev.id).toBe("ev-1");
    expect(ev.eventType).toBe("page_view");
  });

  it("throws when id is missing", () => {
    expect(() => makeEvent({ id: "" })).toThrow("id is required");
  });

  it("throws when sessionId is missing", () => {
    expect(() => makeEvent({ sessionId: "" })).toThrow("sessionId is required");
  });

  it("throws when anonymousId is missing", () => {
    expect(() => makeEvent({ anonymousId: "" })).toThrow("anonymousId is required");
  });

  it("throws when name is missing", () => {
    expect(() => makeEvent({ name: "" })).toThrow("name is required");
  });

  it("throws when url is missing", () => {
    expect(() => makeEvent({ url: "" })).toThrow("url is required");
  });

  it("accepts optional userId", () => {
    const ev = makeEvent({ userId: "user-1" });
    expect(ev.userId).toBe("user-1");
  });

  it("accepts optional referrer", () => {
    const ev = makeEvent({ referrer: "https://google.com" });
    expect(ev.referrer).toBe("https://google.com");
  });

  it("properties getter returns defensive copy", () => {
    const ev = makeEvent({ properties: { page: "classes" } });
    const p = ev.properties;
    p["injected"] = "hack";
    expect(ev.properties["injected"]).toBeUndefined();
  });
});

// ── Event type predicates ────────────────────────────────────────────────────

describe("TrackingEvent — type predicates", () => {
  it("isPageView true for page_view", () => {
    expect(makeEvent({ eventType: "page_view" }).isPageView()).toBe(true);
  });

  it("isPageView false for click", () => {
    expect(makeEvent({ eventType: "click" }).isPageView()).toBe(false);
  });

  it("isError true for error", () => {
    expect(makeEvent({ eventType: "error" }).isError()).toBe(true);
  });

  it("isScrollDepth true for scroll_depth", () => {
    expect(makeEvent({ eventType: "scroll_depth" }).isScrollDepth()).toBe(true);
  });

  const conversionTypes: EventType[] = [
    "booking_completed", "payment_completed", "subscription_started",
  ];

  it.each(conversionTypes)("isConversion true for %s", type => {
    expect(makeEvent({ eventType: type }).isConversion()).toBe(true);
  });

  it("isConversion false for page_view", () => {
    expect(makeEvent({ eventType: "page_view" }).isConversion()).toBe(false);
  });

  it("isAnonymous true when no userId", () => {
    expect(makeEvent().isAnonymous()).toBe(true);
  });

  it("isAnonymous false when userId present", () => {
    expect(makeEvent({ userId: "u1" }).isAnonymous()).toBe(false);
  });

  it("isDropped true for dropped status", () => {
    expect(makeEvent({ status: "dropped" }).isDropped()).toBe(true);
  });

  it("isMasked true for masked status", () => {
    expect(makeEvent({ status: "masked" }).isMasked()).toBe(true);
  });
});

// ── CONVERSION_EVENT_TYPES ───────────────────────────────────────────────────

describe("CONVERSION_EVENT_TYPES constant", () => {
  it("contains exactly booking_completed, payment_completed, subscription_started", () => {
    expect(CONVERSION_EVENT_TYPES).toContain("booking_completed");
    expect(CONVERSION_EVENT_TYPES).toContain("payment_completed");
    expect(CONVERSION_EVENT_TYPES).toContain("subscription_started");
  });

  it("does not contain page_view", () => {
    expect(CONVERSION_EVENT_TYPES).not.toContain("page_view");
  });
});

// ── maskedProperties ─────────────────────────────────────────────────────────

describe("maskedProperties", () => {
  it("masks email key", () => {
    const ev = makeEvent({ properties: { email: "user@example.com", page: "/home" } });
    expect(ev.maskedProperties()["email"]).toBe("***");
    expect(ev.maskedProperties()["page"]).toBe("/home");
  });

  it("masks phone key", () => {
    const ev = makeEvent({ properties: { phone: "416-555-0000" } });
    expect(ev.maskedProperties()["phone"]).toBe("***");
  });

  it("masks password key", () => {
    const ev = makeEvent({ properties: { password: "secret" } });
    expect(ev.maskedProperties()["password"]).toBe("***");
  });

  it("masks card key", () => {
    const ev = makeEvent({ properties: { cardNumber: "4111111111111111" } });
    expect(ev.maskedProperties()["cardNumber"]).toBe("***");
  });

  it("masks name key", () => {
    const ev = makeEvent({ properties: { name: "Praveen" } });
    expect(ev.maskedProperties()["name"]).toBe("***");
  });

  it("masks health key", () => {
    const ev = makeEvent({ properties: { healthCondition: "epilepsy" } });
    expect(ev.maskedProperties()["healthCondition"]).toBe("***");
  });

  it("masks message key", () => {
    const ev = makeEvent({ properties: { message: "I have a question" } });
    expect(ev.maskedProperties()["message"]).toBe("***");
  });

  it("does not mask non-sensitive keys", () => {
    const ev = makeEvent({ properties: { page: "/classes", clicked: "book-now" } });
    const masked = ev.maskedProperties();
    expect(masked["page"]).toBe("/classes");
    expect(masked["clicked"]).toBe("book-now");
  });

  it("masks case-insensitively (EMAIL → masked)", () => {
    const ev = makeEvent({ properties: { EMAIL: "x@y.com" } });
    expect(ev.maskedProperties()["EMAIL"]).toBe("***");
  });

  it("returns empty object for empty properties", () => {
    expect(makeEvent().maskedProperties()).toEqual({});
  });
});

// ── SENSITIVE_KEY_FRAGMENTS ───────────────────────────────────────────────────

describe("SENSITIVE_KEY_FRAGMENTS", () => {
  const required = ["name", "email", "phone", "password", "card", "health", "message"];
  it.each(required)("includes fragment '%s'", f => {
    expect(SENSITIVE_KEY_FRAGMENTS).toContain(f as typeof SENSITIVE_KEY_FRAGMENTS[number]);
  });
});

// ── mask() ────────────────────────────────────────────────────────────────────

describe("mask()", () => {
  it("returns new event with status=masked", () => {
    const ev = makeEvent({ properties: { email: "x@y.com" } });
    const masked = ev.mask();
    expect(masked.status).toBe("masked");
  });

  it("masks sensitive properties", () => {
    const ev = makeEvent({ properties: { email: "x@y.com", page: "/home" } });
    expect(ev.mask().properties["email"]).toBe("***");
  });

  it("does not mutate original", () => {
    const ev = makeEvent({ properties: { email: "x@y.com" } });
    ev.mask();
    expect(ev.status).toBe("pending");
    expect(ev.properties["email"]).toBe("x@y.com");
  });
});

// ── collect() ─────────────────────────────────────────────────────────────────

describe("collect()", () => {
  it("transitions pending → collected", () => {
    expect(makeEvent({ status: "pending" }).collect().status).toBe("collected");
  });

  it("throws when not pending (already collected)", () => {
    expect(() => makeEvent({ status: "collected" }).collect()).toThrow("only pending events");
  });

  it("throws when dropped", () => {
    expect(() => makeEvent({ status: "dropped" }).collect()).toThrow("only pending events");
  });

  it("throws when masked", () => {
    expect(() => makeEvent({ status: "masked" }).collect()).toThrow("only pending events");
  });
});

// ── drop() ───────────────────────────────────────────────────────────────────

describe("drop()", () => {
  it("sets status to dropped", () => {
    expect(makeEvent().drop().status).toBe("dropped");
  });

  it("can drop a collected event", () => {
    expect(makeEvent({ status: "collected" }).drop().status).toBe("dropped");
  });

  it("does not mutate original", () => {
    const ev = makeEvent();
    ev.drop();
    expect(ev.status).toBe("pending");
  });
});

// ── withUser() ────────────────────────────────────────────────────────────────

describe("withUser()", () => {
  it("sets userId on anonymous event", () => {
    const ev = makeEvent().withUser("user-99");
    expect(ev.userId).toBe("user-99");
  });

  it("does not mutate original", () => {
    const ev = makeEvent();
    ev.withUser("u1");
    expect(ev.userId).toBeUndefined();
  });
});

// ── toJSON() ──────────────────────────────────────────────────────────────────

describe("toJSON()", () => {
  it("returns an object with all expected fields", () => {
    const json = makeEvent().toJSON();
    expect(json).toHaveProperty("id");
    expect(json).toHaveProperty("sessionId");
    expect(json).toHaveProperty("eventType");
  });

  it("toJSON masks sensitive properties", () => {
    const ev = makeEvent({ properties: { password: "secret" } });
    expect(ev.toJSON().properties["password"]).toBe("***");
  });
});
