import { Asana, SEED_ASANAS } from "@/domain/yoga/Asana";

const base = {
  id: "tadasana",
  englishName: "Mountain Pose",
  sanskritName: "Tadasana",
  category: "standing" as const,
  level: "Beginner" as const,
  bodyFocus: ["full_body" as const],
  durationSeconds: { min: 30, max: 120 },
  description: "Foundation pose",
  benefits: ["Improves posture"],
  contraindications: ["Headache"],
  props: [],
  preparatoryPoses: [],
  followUpPoses: [],
  breathInstruction: "Breathe evenly",
  doshaBalance: ["tridosha" as const],
  cues: ["Press all four corners"],
  modifications: ["Use wall"],
  isActive: true,
  createdById: "admin",
};

describe("Asana", () => {
  it("creates valid asana", () => {
    const a = new Asana(base);
    expect(a.englishName).toBe("Mountain Pose");
    expect(a.sanskritName).toBe("Tadasana");
    expect(a.level).toBe("Beginner");
  });

  it("throws on empty english name", () => {
    expect(() => new Asana({ ...base, englishName: " " })).toThrow("English name is required");
  });

  it("throws on invalid duration (min > max)", () => {
    expect(() => new Asana({ ...base, durationSeconds: { min: 100, max: 50 } })).toThrow("Min duration cannot exceed max");
  });

  it("throws on empty body focus", () => {
    expect(() => new Asana({ ...base, bodyFocus: [] })).toThrow("At least one body focus required");
  });

  it("isSafeFor — safe when no matching contraindication", () => {
    const a = new Asana(base);
    expect(a.isSafeFor(["knee pain"])).toBe(true);
  });

  it("isSafeFor — unsafe when condition matches contraindication", () => {
    const a = new Asana(base);
    expect(a.isSafeFor(["headache"])).toBe(false);
  });

  it("requiresProps — false when no props needed", () => {
    expect(new Asana(base).requiresProps()).toBe(false);
  });

  it("requiresProps — true when props listed", () => {
    expect(new Asana({ ...base, props: ["Block"] }).requiresProps()).toBe(true);
  });

  it("isInversion — false for standing", () => {
    expect(new Asana(base).isInversion()).toBe(false);
  });

  it("isInversion — true for inversion category", () => {
    expect(new Asana({ ...base, category: "inversion" }).isInversion()).toBe(true);
  });

  it("returns defensive copy of arrays", () => {
    const a = new Asana(base);
    const bf = a.bodyFocus;
    bf.push("arms");
    expect(a.bodyFocus).toHaveLength(1);
  });

  it("SEED_ASANAS has 5 entries", () => {
    expect(SEED_ASANAS).toHaveLength(5);
  });

  it("all seed asanas have non-empty benefits", () => {
    SEED_ASANAS.forEach(s => expect(s.benefits.length).toBeGreaterThan(0));
  });
});
