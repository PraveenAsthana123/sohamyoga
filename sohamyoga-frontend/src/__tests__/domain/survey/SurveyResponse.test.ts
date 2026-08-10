import { SurveyResponse, SurveyResponseProps, Answer } from "../../../domain/survey/SurveyResponse";

const NOW    = new Date("2026-08-05T10:00:00Z");
const LATER  = new Date("2026-08-05T10:05:00Z");

const textAnswer: Answer = {
  questionId: "q-1",
  type: "short_text",
  value: "Pranayama",
};

const ratingAnswer: Answer = {
  questionId: "q-2",
  type: "rating_scale",
  value: 5,
};

const npsAnswer: Answer = {
  questionId: "q-3",
  type: "nps",
  value: 9,
};

function base(overrides: Partial<SurveyResponseProps> = {}): SurveyResponseProps {
  return {
    id: "resp-1",
    surveyId: "sv-1",
    status: "in_progress",
    answers: [],
    startedAt: NOW,
    completionPercent: 0,
    ...overrides,
  };
}

describe("SurveyResponse — construction", () => {
  it("creates a valid in-progress response", () => {
    const r = new SurveyResponse(base());
    expect(r.id).toBe("resp-1");
    expect(r.status).toBe("in_progress");
    expect(r.completionPercent).toBe(0);
    expect(r.isAnonymous()).toBe(true);
  });

  it("throws on empty id", () => {
    expect(() => new SurveyResponse(base({ id: "" }))).toThrow("id is required");
  });

  it("throws on empty surveyId", () => {
    expect(() => new SurveyResponse(base({ surveyId: "" }))).toThrow("surveyId is required");
  });

  it("throws on completionPercent < 0", () => {
    expect(() => new SurveyResponse(base({ completionPercent: -1 }))).toThrow("completionPercent must be 0–100");
  });

  it("throws on completionPercent > 100", () => {
    expect(() => new SurveyResponse(base({ completionPercent: 101 }))).toThrow("completionPercent must be 0–100");
  });

  it("throws on timeSpentSeconds < 0", () => {
    expect(() => new SurveyResponse(base({ timeSpentSeconds: -1 }))).toThrow("timeSpentSeconds must be >= 0");
  });

  it("throws when submitted but no submittedAt", () => {
    expect(() => new SurveyResponse(base({ status: "submitted" }))).toThrow("submittedAt is required when status is submitted");
  });

  it("submitted with submittedAt is valid", () => {
    const r = new SurveyResponse(base({ status: "submitted", submittedAt: LATER, completionPercent: 100 }));
    expect(r.status).toBe("submitted");
    expect(r.submittedAt).toEqual(LATER);
  });

  it("answers getter returns defensive copy", () => {
    const r = new SurveyResponse(base({ answers: [textAnswer] }));
    const answers = r.answers;
    answers.push(ratingAnswer);
    expect(r.answers).toHaveLength(1);
  });
});

describe("SurveyResponse — isAnonymous", () => {
  it("anonymous when no respondentId or email", () => {
    expect(new SurveyResponse(base()).isAnonymous()).toBe(true);
  });

  it("not anonymous when respondentId present", () => {
    expect(new SurveyResponse(base({ respondentId: "u-1" })).isAnonymous()).toBe(false);
  });

  it("not anonymous when email present", () => {
    expect(new SurveyResponse(base({ respondentEmail: "test@example.com" })).isAnonymous()).toBe(false);
  });
});

describe("SurveyResponse — isComplete", () => {
  it("not complete when in_progress", () => {
    expect(new SurveyResponse(base()).isComplete()).toBe(false);
  });

  it("not complete when submitted but 50%", () => {
    const r = new SurveyResponse(base({ status: "submitted", submittedAt: LATER, completionPercent: 50 }));
    expect(r.isComplete()).toBe(false);
  });

  it("complete when submitted and 100%", () => {
    const r = new SurveyResponse(base({ status: "submitted", submittedAt: LATER, completionPercent: 100 }));
    expect(r.isComplete()).toBe(true);
  });
});

describe("SurveyResponse — getAnswer and hasAnswered", () => {
  it("getAnswer returns undefined for missing question", () => {
    expect(new SurveyResponse(base()).getAnswer("q-1")).toBeUndefined();
  });

  it("getAnswer returns the answer", () => {
    const r = new SurveyResponse(base({ answers: [textAnswer] }));
    expect(r.getAnswer("q-1")).toEqual(textAnswer);
  });

  it("hasAnswered false when not answered", () => {
    expect(new SurveyResponse(base()).hasAnswered("q-1")).toBe(false);
  });

  it("hasAnswered false when value is null", () => {
    const r = new SurveyResponse(base({ answers: [{ ...textAnswer, value: null }] }));
    expect(r.hasAnswered("q-1")).toBe(false);
  });

  it("hasAnswered false when value is empty string", () => {
    const r = new SurveyResponse(base({ answers: [{ ...textAnswer, value: "" }] }));
    expect(r.hasAnswered("q-1")).toBe(false);
  });

  it("hasAnswered false when value is empty array", () => {
    const r = new SurveyResponse(base({ answers: [{ ...textAnswer, value: [] }] }));
    expect(r.hasAnswered("q-1")).toBe(false);
  });

  it("hasAnswered true for non-empty string", () => {
    const r = new SurveyResponse(base({ answers: [textAnswer] }));
    expect(r.hasAnswered("q-1")).toBe(true);
  });

  it("hasAnswered true for numeric value 0", () => {
    const r = new SurveyResponse(base({ answers: [{ ...ratingAnswer, value: 0 }] }));
    expect(r.hasAnswered("q-2")).toBe(true);
  });

  it("hasAnswered true for non-empty array", () => {
    const r = new SurveyResponse(base({ answers: [{ ...textAnswer, value: ["a", "b"] }] }));
    expect(r.hasAnswered("q-1")).toBe(true);
  });
});

describe("SurveyResponse — addAnswer", () => {
  it("adds a new answer", () => {
    const r = new SurveyResponse(base()).addAnswer(textAnswer);
    expect(r.answers).toHaveLength(1);
    expect(r.answers[0].questionId).toBe("q-1");
  });

  it("replaces existing answer", () => {
    const r = new SurveyResponse(base())
      .addAnswer(textAnswer)
      .addAnswer({ ...textAnswer, value: "Updated answer" });
    expect(r.answers).toHaveLength(1);
    expect(r.answers[0].value).toBe("Updated answer");
  });

  it("addAnswer is immutable", () => {
    const r = new SurveyResponse(base());
    r.addAnswer(textAnswer);
    expect(r.answers).toHaveLength(0);
  });

  it("throws on empty questionId", () => {
    expect(() => new SurveyResponse(base()).addAnswer({ ...textAnswer, questionId: "" })).toThrow("answer.questionId is required");
  });

  it("throws on submitted response", () => {
    const submitted = new SurveyResponse(base({ status: "submitted", submittedAt: LATER, completionPercent: 100 }));
    expect(() => submitted.addAnswer(textAnswer)).toThrow("Cannot modify a submitted response");
  });

  it("accumulates multiple answers", () => {
    const r = new SurveyResponse(base())
      .addAnswer(textAnswer)
      .addAnswer(ratingAnswer)
      .addAnswer(npsAnswer);
    expect(r.answers).toHaveLength(3);
  });
});

describe("SurveyResponse — updateCompletion", () => {
  it("updates completion percent", () => {
    const r = new SurveyResponse(base()).updateCompletion(50);
    expect(r.completionPercent).toBe(50);
  });

  it("sets status to partial when < 100", () => {
    const r = new SurveyResponse(base()).updateCompletion(50);
    expect(r.status).toBe("partial");
  });

  it("stays in_progress when updated to 100 (not submitted)", () => {
    const r = new SurveyResponse(base()).updateCompletion(100);
    expect(r.completionPercent).toBe(100);
    expect(r.status).toBe("in_progress");
  });

  it("throws on invalid percent", () => {
    expect(() => new SurveyResponse(base()).updateCompletion(101)).toThrow("completionPercent must be 0–100");
  });

  it("throws on submitted response", () => {
    const submitted = new SurveyResponse(base({ status: "submitted", submittedAt: LATER, completionPercent: 100 }));
    expect(() => submitted.updateCompletion(50)).toThrow("Cannot update completion of submitted response");
  });
});

describe("SurveyResponse — submit", () => {
  it("submits an in-progress response", () => {
    const r = new SurveyResponse(base()).submit(LATER);
    expect(r.status).toBe("submitted");
    expect(r.submittedAt).toEqual(LATER);
    expect(r.completionPercent).toBe(100);
  });

  it("submit is immutable", () => {
    const r = new SurveyResponse(base());
    r.submit(LATER);
    expect(r.status).toBe("in_progress");
  });

  it("throws when already submitted", () => {
    const submitted = new SurveyResponse(base({ status: "submitted", submittedAt: LATER, completionPercent: 100 }));
    expect(() => submitted.submit(LATER)).toThrow("already submitted");
  });

  it("uses provided date", () => {
    const customDate = new Date("2026-08-05T11:00:00Z");
    expect(new SurveyResponse(base()).submit(customDate).submittedAt).toEqual(customDate);
  });
});

describe("SurveyResponse — durationSeconds", () => {
  it("returns timeSpentSeconds when provided", () => {
    const r = new SurveyResponse(base({ timeSpentSeconds: 120 }));
    expect(r.durationSeconds(LATER)).toBe(120);
  });

  it("calculates from submittedAt when available", () => {
    const r = new SurveyResponse(base({ status: "submitted", submittedAt: LATER, completionPercent: 100 }));
    const duration = r.durationSeconds(new Date("2026-08-05T11:00:00Z"));
    expect(duration).toBe(300); // 5 minutes
  });

  it("calculates from provided at when not submitted", () => {
    const r = new SurveyResponse(base());
    expect(r.durationSeconds(LATER)).toBe(300); // 5 minutes
  });

  it("returns 0 for same start and end time", () => {
    expect(new SurveyResponse(base()).durationSeconds(NOW)).toBe(0);
  });
});
