import { Question, QuestionProps, QuestionOption, MatrixRow, ConditionalLogic } from "../../../domain/survey/Question";

const NOW = new Date("2026-08-05");

const twoOptions: QuestionOption[] = [
  { id: "o-1", label: "Option A", value: "a" },
  { id: "o-2", label: "Option B", value: "b" },
];

const twoMatrixCols: QuestionOption[] = [
  { id: "c-1", label: "Agree", value: "agree" },
  { id: "c-2", label: "Disagree", value: "disagree" },
];

const oneMatrixRow: MatrixRow[] = [{ id: "r-1", label: "Question 1" }];

function textBase(overrides: Partial<QuestionProps> = {}): QuestionProps {
  return {
    id: "q-1",
    surveyId: "sv-1",
    type: "short_text",
    text: "What is your name?",
    isRequired: true,
    order: 0,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function choiceBase(overrides: Partial<QuestionProps> = {}): QuestionProps {
  return {
    ...textBase(),
    type: "single_choice",
    text: "Pick one option",
    options: twoOptions,
    ...overrides,
  };
}

function npsBase(): QuestionProps {
  return {
    ...textBase(),
    type: "nps",
    text: "How likely are you to recommend us?",
    ratingMin: 0,
    ratingMax: 10,
  };
}

function ratingBase(): QuestionProps {
  return {
    ...textBase(),
    type: "rating_scale",
    text: "Rate your experience",
    ratingMin: 1,
    ratingMax: 5,
  };
}

describe("Question — construction", () => {
  it("creates a valid text question", () => {
    const q = new Question(textBase());
    expect(q.id).toBe("q-1");
    expect(q.type).toBe("short_text");
    expect(q.isRequired).toBe(true);
  });

  it("throws on empty id", () => {
    expect(() => new Question(textBase({ id: "" }))).toThrow("id is required");
  });

  it("throws on empty surveyId", () => {
    expect(() => new Question(textBase({ surveyId: "" }))).toThrow("surveyId is required");
  });

  it("throws on empty text", () => {
    expect(() => new Question(textBase({ text: "" }))).toThrow("text is required");
  });

  it("throws on negative order", () => {
    expect(() => new Question(textBase({ order: -1 }))).toThrow("order must be >= 0");
  });

  it("allows order 0", () => {
    expect(new Question(textBase({ order: 0 })).order).toBe(0);
  });

  it("options getter returns defensive copy", () => {
    const q = new Question(choiceBase());
    const opts = q.options!;
    opts.push({ id: "injected", label: "bad", value: "bad" });
    expect(q.options).toHaveLength(2);
  });
});

describe("Question — choice type validation", () => {
  it("single_choice requires ≥2 options", () => {
    expect(() => new Question(choiceBase({ options: [twoOptions[0]] }))).toThrow("at least 2 options");
  });

  it("multiple_choice requires ≥2 options", () => {
    expect(() => new Question({ ...choiceBase(), type: "multiple_choice", options: [twoOptions[0]] })).toThrow("at least 2 options");
  });

  it("checkbox requires ≥2 options", () => {
    expect(() => new Question({ ...choiceBase(), type: "checkbox", options: [] })).toThrow("at least 2 options");
  });

  it("single_choice with 3 options is valid", () => {
    const opts = [...twoOptions, { id: "o-3", label: "C", value: "c" }];
    expect(new Question(choiceBase({ options: opts })).options).toHaveLength(3);
  });
});

describe("Question — matrix_grid validation", () => {
  it("matrix_grid requires ≥2 column options", () => {
    expect(() => new Question(textBase({
      type: "matrix_grid",
      options: [twoMatrixCols[0]],
      matrixRows: oneMatrixRow,
    }))).toThrow("at least 2 column options");
  });

  it("matrix_grid requires ≥1 row", () => {
    expect(() => new Question(textBase({
      type: "matrix_grid",
      options: twoMatrixCols,
      matrixRows: [],
    }))).toThrow("at least 1 row");
  });

  it("valid matrix_grid", () => {
    const q = new Question(textBase({ type: "matrix_grid", options: twoMatrixCols, matrixRows: oneMatrixRow }));
    expect(q.type).toBe("matrix_grid");
    expect(q.matrixRows).toHaveLength(1);
  });
});

describe("Question — rating validation", () => {
  it("rating_scale requires ratingMin and ratingMax", () => {
    expect(() => new Question(textBase({ type: "rating_scale" }))).toThrow("ratingMin and ratingMax");
  });

  it("ratingMin must be < ratingMax", () => {
    expect(() => new Question(textBase({ type: "rating_scale", ratingMin: 5, ratingMax: 5 }))).toThrow("ratingMin must be less than ratingMax");
  });

  it("valid rating_scale 1–5", () => {
    const q = new Question(ratingBase());
    expect(q.ratingMin).toBe(1);
    expect(q.ratingMax).toBe(5);
  });

  it("NPS requires ratingMin=0", () => {
    expect(() => new Question(textBase({ type: "nps", ratingMin: 1, ratingMax: 10 }))).toThrow("ratingMin=0");
  });

  it("NPS requires ratingMax=10", () => {
    expect(() => new Question(textBase({ type: "nps", ratingMin: 0, ratingMax: 9 }))).toThrow("ratingMax=10");
  });

  it("valid NPS 0–10", () => {
    const q = new Question(npsBase());
    expect(q.ratingMin).toBe(0);
    expect(q.ratingMax).toBe(10);
  });
});

describe("Question — file / text constraints", () => {
  it("throws on maxLength < 1", () => {
    expect(() => new Question(textBase({ maxLength: 0 }))).toThrow("maxLength must be >= 1");
  });

  it("allows maxLength 1", () => {
    expect(new Question(textBase({ maxLength: 1 })).maxLength).toBe(1);
  });

  it("throws on maxFileSizeMb <= 0", () => {
    expect(() => new Question(textBase({ type: "file_upload", maxFileSizeMb: 0 }))).toThrow("maxFileSizeMb must be > 0");
  });

  it("allows maxFileSizeMb 5", () => {
    expect(new Question(textBase({ type: "file_upload", maxFileSizeMb: 5 })).maxFileSizeMb).toBe(5);
  });
});

describe("Question — type checks", () => {
  it("isChoiceQuestion for single_choice", () => {
    expect(new Question(choiceBase()).isChoiceQuestion()).toBe(true);
  });

  it("isChoiceQuestion for matrix_grid", () => {
    expect(new Question(textBase({ type: "matrix_grid", options: twoMatrixCols, matrixRows: oneMatrixRow })).isChoiceQuestion()).toBe(true);
  });

  it("isChoiceQuestion false for short_text", () => {
    expect(new Question(textBase()).isChoiceQuestion()).toBe(false);
  });

  it("isRatingQuestion for rating_scale", () => {
    expect(new Question(ratingBase()).isRatingQuestion()).toBe(true);
  });

  it("isRatingQuestion for nps", () => {
    expect(new Question(npsBase()).isRatingQuestion()).toBe(true);
  });

  it("isRatingQuestion false for short_text", () => {
    expect(new Question(textBase()).isRatingQuestion()).toBe(false);
  });

  it("isTextQuestion for short_text", () => {
    expect(new Question(textBase()).isTextQuestion()).toBe(true);
  });

  it("isTextQuestion for email", () => {
    expect(new Question(textBase({ type: "email" })).isTextQuestion()).toBe(true);
  });

  it("isTextQuestion false for rating_scale", () => {
    expect(new Question(ratingBase()).isTextQuestion()).toBe(false);
  });
});

describe("Question — makeRequired / makeOptional", () => {
  it("makeRequired returns required question", () => {
    const q = new Question(textBase({ isRequired: false })).makeRequired();
    expect(q.isRequired).toBe(true);
  });

  it("makeRequired is immutable", () => {
    const q = new Question(textBase({ isRequired: false }));
    q.makeRequired();
    expect(q.isRequired).toBe(false);
  });

  it("makeOptional returns optional question", () => {
    const q = new Question(textBase({ isRequired: true })).makeOptional();
    expect(q.isRequired).toBe(false);
  });
});

describe("Question — reorder", () => {
  it("reorder sets new order", () => {
    const q = new Question(textBase({ order: 0 })).reorder(5);
    expect(q.order).toBe(5);
  });

  it("reorder is immutable", () => {
    const q = new Question(textBase({ order: 0 }));
    q.reorder(5);
    expect(q.order).toBe(0);
  });

  it("reorder throws on negative", () => {
    expect(() => new Question(textBase()).reorder(-1)).toThrow("order must be >= 0");
  });
});

describe("Question — conditional logic", () => {
  const logic: ConditionalLogic = {
    dependsOnQuestionId: "q-0",
    operator: "equals",
    value: "yes",
    action: "show",
  };

  it("hasConditionalLogic false by default", () => {
    expect(new Question(textBase()).hasConditionalLogic()).toBe(false);
  });

  it("addConditionalLogic sets logic", () => {
    const q = new Question(textBase()).addConditionalLogic(logic);
    expect(q.hasConditionalLogic()).toBe(true);
    expect(q.conditionalLogic?.dependsOnQuestionId).toBe("q-0");
    expect(q.conditionalLogic?.action).toBe("show");
  });

  it("addConditionalLogic is immutable", () => {
    const q = new Question(textBase());
    q.addConditionalLogic(logic);
    expect(q.hasConditionalLogic()).toBe(false);
  });

  it("addConditionalLogic throws on empty dependsOnQuestionId", () => {
    expect(() => new Question(textBase()).addConditionalLogic({ ...logic, dependsOnQuestionId: "" })).toThrow("dependsOnQuestionId is required");
  });

  it("addConditionalLogic throws on empty value", () => {
    expect(() => new Question(textBase()).addConditionalLogic({ ...logic, value: "" })).toThrow("conditional logic value is required");
  });

  it("removeConditionalLogic clears logic", () => {
    const q = new Question(textBase()).addConditionalLogic(logic).removeConditionalLogic();
    expect(q.hasConditionalLogic()).toBe(false);
  });

  it("removeConditionalLogic on question without logic is no-op", () => {
    const q = new Question(textBase()).removeConditionalLogic();
    expect(q.hasConditionalLogic()).toBe(false);
  });

  it("all operators are accepted", () => {
    const operators = ["equals", "not_equals", "contains", "greater_than", "less_than"] as const;
    for (const op of operators) {
      expect(() => new Question(textBase()).addConditionalLogic({ ...logic, operator: op })).not.toThrow();
    }
  });
});
