import { SurveyAnalytics, SurveyAnalyticsProps, QuestionSummary } from "../../../domain/survey/SurveyAnalytics";

const NOW = new Date("2026-08-05");

const textSummary: QuestionSummary = {
  questionId: "q-1",
  questionText: "What did you enjoy?",
  type: "short_text",
  totalAnswers: 80,
  skippedCount: 20,
  textSample: ["Pranayama", "Asanas", "Meditation"],
};

const choiceSummary: QuestionSummary = {
  questionId: "q-2",
  questionText: "Pick your favourite class",
  type: "single_choice",
  totalAnswers: 90,
  skippedCount: 10,
  optionCounts: { "Morning Yoga": 45, "Evening Yoga": 30, "Yin Yoga": 15 },
};

const npsSummary: QuestionSummary = {
  questionId: "q-3",
  questionText: "How likely to recommend us?",
  type: "nps",
  totalAnswers: 95,
  skippedCount: 5,
  npsScore: 72,
  promoters: 75,
  passives: 15,
  detractors: 5,
};

function base(overrides: Partial<SurveyAnalyticsProps> = {}): SurveyAnalyticsProps {
  return {
    id: "an-1",
    surveyId: "sv-1",
    totalResponses: 100,
    completedResponses: 80,
    partialResponses: 15,
    completionRate: 80,
    averageTimeSeconds: 420,
    questionSummaries: [textSummary, choiceSummary],
    calculatedAt: NOW,
    ...overrides,
  };
}

describe("SurveyAnalytics — construction", () => {
  it("creates valid analytics", () => {
    const a = new SurveyAnalytics(base());
    expect(a.id).toBe("an-1");
    expect(a.totalResponses).toBe(100);
    expect(a.completionRate).toBe(80);
  });

  it("throws on empty id", () => {
    expect(() => new SurveyAnalytics(base({ id: "" }))).toThrow("id is required");
  });

  it("throws on empty surveyId", () => {
    expect(() => new SurveyAnalytics(base({ surveyId: "" }))).toThrow("surveyId is required");
  });

  it("throws on negative totalResponses", () => {
    expect(() => new SurveyAnalytics(base({ totalResponses: -1 }))).toThrow("totalResponses must be >= 0");
  });

  it("throws on negative completedResponses", () => {
    expect(() => new SurveyAnalytics(base({ completedResponses: -1 }))).toThrow("completedResponses must be >= 0");
  });

  it("throws on negative partialResponses", () => {
    expect(() => new SurveyAnalytics(base({ partialResponses: -1 }))).toThrow("partialResponses must be >= 0");
  });

  it("throws when completed + partial exceed total", () => {
    expect(() => new SurveyAnalytics(base({ completedResponses: 80, partialResponses: 30 }))).toThrow("cannot exceed totalResponses");
  });

  it("exactly equal completed + partial = total is valid", () => {
    expect(new SurveyAnalytics(base({ completedResponses: 85, partialResponses: 15 })).totalResponses).toBe(100);
  });

  it("throws on completionRate > 100", () => {
    expect(() => new SurveyAnalytics(base({ completionRate: 101 }))).toThrow("completionRate must be 0–100");
  });

  it("throws on completionRate < 0", () => {
    expect(() => new SurveyAnalytics(base({ completionRate: -1 }))).toThrow("completionRate must be 0–100");
  });

  it("throws on negative averageTimeSeconds", () => {
    expect(() => new SurveyAnalytics(base({ averageTimeSeconds: -1 }))).toThrow("averageTimeSeconds must be >= 0");
  });

  it("throws on npsScore > 100", () => {
    expect(() => new SurveyAnalytics(base({ npsScore: 101 }))).toThrow("npsScore must be -100 to 100");
  });

  it("throws on npsScore < -100", () => {
    expect(() => new SurveyAnalytics(base({ npsScore: -101 }))).toThrow("npsScore must be -100 to 100");
  });

  it("npsScore -100 is valid", () => {
    expect(new SurveyAnalytics(base({ npsScore: -100 })).npsScore).toBe(-100);
  });

  it("npsScore 100 is valid", () => {
    expect(new SurveyAnalytics(base({ npsScore: 100 })).npsScore).toBe(100);
  });

  it("questionSummaries getter returns defensive copy", () => {
    const a = new SurveyAnalytics(base());
    const qs = a.questionSummaries;
    qs.push(npsSummary);
    expect(a.questionSummaries).toHaveLength(2);
  });

  it("zero responses is valid", () => {
    const a = new SurveyAnalytics(base({ totalResponses: 0, completedResponses: 0, partialResponses: 0, completionRate: 0 }));
    expect(a.totalResponses).toBe(0);
  });
});

describe("SurveyAnalytics — npsCategory", () => {
  it("no_data when no npsScore", () => {
    expect(new SurveyAnalytics(base()).npsCategory()).toBe("no_data");
  });

  it("excellent when >= 70", () => {
    expect(new SurveyAnalytics(base({ npsScore: 70 })).npsCategory()).toBe("excellent");
  });

  it("excellent when 100", () => {
    expect(new SurveyAnalytics(base({ npsScore: 100 })).npsCategory()).toBe("excellent");
  });

  it("good when 30–69", () => {
    expect(new SurveyAnalytics(base({ npsScore: 30 })).npsCategory()).toBe("good");
    expect(new SurveyAnalytics(base({ npsScore: 69 })).npsCategory()).toBe("good");
  });

  it("needs_improvement when 0–29", () => {
    expect(new SurveyAnalytics(base({ npsScore: 0 })).npsCategory()).toBe("needs_improvement");
    expect(new SurveyAnalytics(base({ npsScore: 29 })).npsCategory()).toBe("needs_improvement");
  });

  it("critical when negative", () => {
    expect(new SurveyAnalytics(base({ npsScore: -1 })).npsCategory()).toBe("critical");
    expect(new SurveyAnalytics(base({ npsScore: -100 })).npsCategory()).toBe("critical");
  });
});

describe("SurveyAnalytics — dropOffRate", () => {
  it("0 when no responses", () => {
    const a = new SurveyAnalytics(base({ totalResponses: 0, completedResponses: 0, partialResponses: 0, completionRate: 0 }));
    expect(a.dropOffRate()).toBe(0);
  });

  it("calculates drop-off correctly", () => {
    // 100 total, 80 completed → 20% drop-off
    expect(new SurveyAnalytics(base()).dropOffRate()).toBe(20);
  });

  it("0% drop-off when all completed", () => {
    const a = new SurveyAnalytics(base({ completedResponses: 100, partialResponses: 0, completionRate: 100 }));
    expect(a.dropOffRate()).toBe(0);
  });

  it("100% drop-off when none completed", () => {
    const a = new SurveyAnalytics(base({ completedResponses: 0, partialResponses: 0, completionRate: 0 }));
    expect(a.dropOffRate()).toBe(100);
  });
});

describe("SurveyAnalytics — getSummary", () => {
  it("returns summary by questionId", () => {
    expect(new SurveyAnalytics(base()).getSummary("q-1")?.questionText).toBe("What did you enjoy?");
  });

  it("returns undefined for missing questionId", () => {
    expect(new SurveyAnalytics(base()).getSummary("q-99")).toBeUndefined();
  });
});

describe("SurveyAnalytics — topOptions", () => {
  it("returns empty array for missing question", () => {
    expect(new SurveyAnalytics(base()).topOptions("q-99")).toEqual([]);
  });

  it("returns empty array for question without optionCounts", () => {
    expect(new SurveyAnalytics(base()).topOptions("q-1")).toEqual([]);
  });

  it("returns options sorted by count desc", () => {
    const a = new SurveyAnalytics(base({ questionSummaries: [choiceSummary] }));
    const top = a.topOptions("q-2");
    expect(top[0]).toEqual({ option: "Morning Yoga", count: 45 });
    expect(top[1]).toEqual({ option: "Evening Yoga", count: 30 });
    expect(top[2]).toEqual({ option: "Yin Yoga", count: 15 });
  });

  it("respects limit parameter", () => {
    const a = new SurveyAnalytics(base({ questionSummaries: [choiceSummary] }));
    expect(a.topOptions("q-2", 2)).toHaveLength(2);
  });

  it("defaults limit to 5", () => {
    const opts: Record<string, number> = { a: 10, b: 8, c: 6, d: 4, e: 3, f: 1 };
    const qs: QuestionSummary = { ...choiceSummary, questionId: "q-big", optionCounts: opts };
    const a = new SurveyAnalytics(base({ questionSummaries: [qs] }));
    expect(a.topOptions("q-big")).toHaveLength(5);
  });
});

describe("SurveyAnalytics — averageMinutes", () => {
  it("converts seconds to minutes", () => {
    // 420 seconds = 7.0 minutes
    expect(new SurveyAnalytics(base()).averageMinutes()).toBe(7);
  });

  it("rounds to 1 decimal", () => {
    const a = new SurveyAnalytics(base({ averageTimeSeconds: 90 })); // 1.5 minutes
    expect(a.averageMinutes()).toBe(1.5);
  });

  it("returns 0 for 0 seconds", () => {
    expect(new SurveyAnalytics(base({ averageTimeSeconds: 0 })).averageMinutes()).toBe(0);
  });
});

describe("SurveyAnalytics — withUpdatedSummary", () => {
  it("updates existing summary", () => {
    const updated: QuestionSummary = { ...textSummary, totalAnswers: 99 };
    const a = new SurveyAnalytics(base()).withUpdatedSummary(updated);
    expect(a.getSummary("q-1")?.totalAnswers).toBe(99);
    expect(a.questionSummaries).toHaveLength(2);
  });

  it("appends new summary", () => {
    const a = new SurveyAnalytics(base()).withUpdatedSummary(npsSummary);
    expect(a.questionSummaries).toHaveLength(3);
    expect(a.getSummary("q-3")).toBeDefined();
  });

  it("is immutable", () => {
    const a = new SurveyAnalytics(base());
    a.withUpdatedSummary({ ...textSummary, totalAnswers: 999 });
    expect(a.getSummary("q-1")?.totalAnswers).toBe(80);
  });
});

describe("SurveyAnalytics — refresh", () => {
  it("updates counts and recalculates completionRate", () => {
    const a = new SurveyAnalytics(base()).refresh(200, 160, 25, 360);
    expect(a.totalResponses).toBe(200);
    expect(a.completedResponses).toBe(160);
    expect(a.completionRate).toBe(80);
    expect(a.averageTimeSeconds).toBe(360);
  });

  it("refresh is immutable", () => {
    const a = new SurveyAnalytics(base());
    a.refresh(200, 160, 25, 360);
    expect(a.totalResponses).toBe(100);
  });

  it("completionRate is 0 when total is 0", () => {
    const a = new SurveyAnalytics(base()).refresh(0, 0, 0, 0);
    expect(a.completionRate).toBe(0);
  });

  it("preserves questionSummaries after refresh", () => {
    const a = new SurveyAnalytics(base()).refresh(200, 160, 25, 360);
    expect(a.questionSummaries).toHaveLength(2);
  });
});
