import { Survey, SurveyProps, SurveySettings } from "../../../domain/survey/Survey";

const NOW    = new Date("2026-08-05");
const FUTURE = new Date("2027-01-01");
const PAST   = new Date("2025-01-01");

const defaultSettings: SurveySettings = {
  allowAnonymous: true,
  requireLogin: false,
  allowMultipleResponses: false,
  showProgressBar: true,
  randomizeQuestions: false,
  saveAndResume: true,
  language: "en",
};

function base(overrides: Partial<SurveyProps> = {}): SurveyProps {
  return {
    id: "sv-1",
    title: "Yoga Satisfaction Survey",
    slug: "yoga-satisfaction-survey",
    type: "survey",
    status: "draft",
    visibility: "public",
    questionIds: ["q-1", "q-2"],
    settings: { ...defaultSettings },
    responseCount: 0,
    completionCount: 0,
    createdBy: "admin-1",
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

describe("Survey — construction", () => {
  it("creates a valid survey", () => {
    const s = new Survey(base());
    expect(s.title).toBe("Yoga Satisfaction Survey");
    expect(s.status).toBe("draft");
    expect(s.questionIds).toHaveLength(2);
  });

  it("throws on empty id", () => {
    expect(() => new Survey(base({ id: "" }))).toThrow("id is required");
  });

  it("throws on empty title", () => {
    expect(() => new Survey(base({ title: "" }))).toThrow("title is required");
  });

  it("throws on empty slug", () => {
    expect(() => new Survey(base({ slug: "" }))).toThrow("slug is required");
  });

  it("throws on invalid slug (uppercase)", () => {
    expect(() => new Survey(base({ slug: "Yoga-Survey" }))).toThrow("lowercase kebab-case");
  });

  it("throws on empty createdBy", () => {
    expect(() => new Survey(base({ createdBy: "" }))).toThrow("createdBy is required");
  });

  it("throws on negative responseCount", () => {
    expect(() => new Survey(base({ responseCount: -1 }))).toThrow("responseCount must be >= 0");
  });

  it("throws when completionCount exceeds responseCount", () => {
    expect(() => new Survey(base({ responseCount: 5, completionCount: 6 }))).toThrow("completionCount cannot exceed responseCount");
  });

  it("throws on responseLimit < 1", () => {
    expect(() => new Survey(base({ settings: { ...defaultSettings, responseLimit: 0 } }))).toThrow("responseLimit must be >= 1");
  });

  it("throws when endDate <= startDate", () => {
    expect(() => new Survey(base({
      settings: { ...defaultSettings, startDate: FUTURE, endDate: FUTURE },
    }))).toThrow("endDate must be after startDate");
  });

  it("questionIds getter returns defensive copy", () => {
    const s = new Survey(base());
    const ids = s.questionIds;
    ids.push("injected");
    expect(s.questionIds).toHaveLength(2);
  });
});

describe("Survey — completionRate and isActive", () => {
  it("completionRate is 0 when no responses", () => {
    expect(new Survey(base()).completionRate()).toBe(0);
  });

  it("completionRate calculates correctly", () => {
    const s = new Survey(base({ responseCount: 100, completionCount: 75 }));
    expect(s.completionRate()).toBe(75);
  });

  it("isActive false when draft", () => {
    expect(new Survey(base()).isActive(NOW)).toBe(false);
  });

  it("isActive true when active and in range", () => {
    const s = new Survey(base({ status: "active", settings: { ...defaultSettings, startDate: PAST, endDate: FUTURE } }));
    expect(s.isActive(NOW)).toBe(true);
  });

  it("isActive false before startDate", () => {
    const s = new Survey(base({ status: "active", settings: { ...defaultSettings, startDate: FUTURE } }));
    expect(s.isActive(NOW)).toBe(false);
  });

  it("isActive false after endDate", () => {
    const s = new Survey(base({ status: "active", settings: { ...defaultSettings, startDate: new Date("2024-01-01"), endDate: PAST } }));
    expect(s.isActive(NOW)).toBe(false);
  });

  it("isActive false when responseLimit reached", () => {
    const s = new Survey(base({ status: "active", responseCount: 100, settings: { ...defaultSettings, responseLimit: 100 } }));
    expect(s.isActive(NOW)).toBe(false);
  });

  it("isExpired true after endDate", () => {
    const s = new Survey(base({ settings: { ...defaultSettings, endDate: PAST } }));
    expect(s.isExpired(NOW)).toBe(true);
  });

  it("isExpired false with no endDate", () => {
    expect(new Survey(base()).isExpired(NOW)).toBe(false);
  });
});

describe("Survey — publish", () => {
  it("draft → active on publish", () => {
    const s = new Survey(base()).publish(NOW);
    expect(s.status).toBe("active");
    expect(s.publishedAt).toEqual(NOW);
  });

  it("publish is immutable", () => {
    const s = new Survey(base());
    s.publish(NOW);
    expect(s.status).toBe("draft");
  });

  it("throws when publishing with no questions", () => {
    expect(() => new Survey(base({ questionIds: [] })).publish()).toThrow("no questions");
  });

  it("throws when publishing already active", () => {
    expect(() => new Survey(base({ status: "active" })).publish()).toThrow("already active");
  });

  it("throws when publishing archived", () => {
    expect(() => new Survey(base({ status: "archived" })).publish()).toThrow("Archived surveys cannot be published");
  });
});

describe("Survey — pause and resume", () => {
  it("active → paused", () => {
    expect(new Survey(base({ status: "active" })).pause().status).toBe("paused");
  });

  it("pause throws when not active", () => {
    expect(() => new Survey(base()).pause()).toThrow("Only active surveys can be paused");
  });

  it("paused → active on resume", () => {
    expect(new Survey(base({ status: "paused" })).resume().status).toBe("active");
  });

  it("resume throws when not paused", () => {
    expect(() => new Survey(base()).resume()).toThrow("Only paused surveys can be resumed");
  });
});

describe("Survey — close", () => {
  it("active → closed", () => {
    const s = new Survey(base({ status: "active" })).close(NOW);
    expect(s.status).toBe("closed");
    expect(s.closedAt).toEqual(NOW);
  });

  it("throws when already closed", () => {
    expect(() => new Survey(base({ status: "closed" })).close()).toThrow("already closed");
  });

  it("throws when archived", () => {
    expect(() => new Survey(base({ status: "archived" })).close()).toThrow("Archived surveys cannot be closed");
  });
});

describe("Survey — archive", () => {
  it("closed → archived", () => {
    expect(new Survey(base({ status: "closed" })).archive().status).toBe("archived");
  });

  it("throws when already archived", () => {
    expect(() => new Survey(base({ status: "archived" })).archive()).toThrow("already archived");
  });
});

describe("Survey — question management", () => {
  it("addQuestion appends new questionId", () => {
    const s = new Survey(base()).addQuestion("q-3");
    expect(s.questionIds).toContain("q-3");
    expect(s.questionIds).toHaveLength(3);
  });

  it("addQuestion is idempotent for duplicate", () => {
    const s = new Survey(base()).addQuestion("q-1");
    expect(s.questionIds).toHaveLength(2);
  });

  it("addQuestion throws on empty id", () => {
    expect(() => new Survey(base()).addQuestion("")).toThrow("questionId is required");
  });

  it("removeQuestion removes existing question", () => {
    const s = new Survey(base()).removeQuestion("q-1");
    expect(s.questionIds).not.toContain("q-1");
    expect(s.questionIds).toHaveLength(1);
  });

  it("removeQuestion is no-op for non-existent", () => {
    const s = new Survey(base()).removeQuestion("q-99");
    expect(s.questionIds).toHaveLength(2);
  });

  it("hasQuestion returns true for existing", () => {
    expect(new Survey(base()).hasQuestion("q-1")).toBe(true);
  });

  it("hasQuestion returns false for missing", () => {
    expect(new Survey(base()).hasQuestion("q-99")).toBe(false);
  });

  it("reorderQuestions reorders correctly", () => {
    const s = new Survey(base()).reorderQuestions(["q-2", "q-1"]);
    expect(s.questionIds[0]).toBe("q-2");
    expect(s.questionIds[1]).toBe("q-1");
  });

  it("reorderQuestions throws on unknown id", () => {
    expect(() => new Survey(base()).reorderQuestions(["q-1", "q-99"])).toThrow("not in survey");
  });

  it("reorderQuestions throws on wrong count", () => {
    expect(() => new Survey(base()).reorderQuestions(["q-1"])).toThrow("all existing question IDs");
  });
});

describe("Survey — recordResponse", () => {
  it("increments responseCount", () => {
    const s = new Survey(base()).recordResponse(false);
    expect(s.responseCount).toBe(1);
    expect(s.completionCount).toBe(0);
  });

  it("increments both when completed", () => {
    const s = new Survey(base()).recordResponse(true);
    expect(s.responseCount).toBe(1);
    expect(s.completionCount).toBe(1);
  });

  it("accumulates multiple responses", () => {
    const s = new Survey(base())
      .recordResponse(true)
      .recordResponse(true)
      .recordResponse(false);
    expect(s.responseCount).toBe(3);
    expect(s.completionCount).toBe(2);
    expect(s.completionRate()).toBeCloseTo(66.67, 1);
  });
});
