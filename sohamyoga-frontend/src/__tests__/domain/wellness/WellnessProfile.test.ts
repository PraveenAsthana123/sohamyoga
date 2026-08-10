import { WellnessProfile } from "@/domain/wellness/WellnessProfile";

const base = {
  userId: "u1",
  heightCm: 170,
  weightKg: 65,
  ageYears: 35,
  fitnessLevel: "moderately_active" as const,
  conditions: [],
  injuries: [],
  medications: [],
  doctorApproved: false,
  pregnancyMode: false,
  primaryGoals: ["stress_relief" as const],
  practiceFrequency: "2_3_per_week" as const,
  prefersMorning: true,
  yogaExperienceYears: 2,
  shareWithTeacher: true,
  shareWithAdmin: false,
  updatedAt: new Date(),
};

describe("WellnessProfile", () => {
  it("creates valid profile", () => {
    const p = new WellnessProfile(base);
    expect(p.userId).toBe("u1");
    expect(p.fitnessLevel).toBe("moderately_active");
  });

  it("throws on negative height", () => {
    expect(() => new WellnessProfile({ ...base, heightCm: -1 })).toThrow("Height must be positive");
  });

  it("throws on negative weight", () => {
    expect(() => new WellnessProfile({ ...base, weightKg: 0 })).toThrow("Weight must be positive");
  });

  it("throws on negative experience years", () => {
    expect(() => new WellnessProfile({ ...base, yogaExperienceYears: -1 })).toThrow("Experience years cannot be negative");
  });

  it("calculates BMI correctly", () => {
    const p = new WellnessProfile(base);
    expect(p.bmi()).toBe(22.5); // 65 / (1.7^2)
  });

  it("bmiCategory normal for BMI 22.5", () => {
    expect(new WellnessProfile(base).bmiCategory()).toBe("normal");
  });

  it("bmiCategory unknown when height/weight missing", () => {
    const p = new WellnessProfile({ ...base, heightCm: undefined, weightKg: undefined });
    expect(p.bmiCategory()).toBe("unknown");
  });

  it("hasCondition — false when not in list", () => {
    expect(new WellnessProfile(base).hasCondition("pregnancy")).toBe(false);
  });

  it("hasCondition — true when in list", () => {
    const p = new WellnessProfile({ ...base, conditions: ["pregnancy"] });
    expect(p.hasCondition("pregnancy")).toBe(true);
  });

  it("isHighRisk — true for pregnancy", () => {
    const p = new WellnessProfile({ ...base, conditions: ["pregnancy"] });
    expect(p.isHighRisk()).toBe(true);
  });

  it("requiresDoctorApproval — true when high risk and not approved", () => {
    const p = new WellnessProfile({ ...base, conditions: ["hypertension"], doctorApproved: false });
    expect(p.requiresDoctorApproval()).toBe(true);
  });

  it("requiresDoctorApproval — false when approved", () => {
    const p = new WellnessProfile({ ...base, conditions: ["hypertension"], doctorApproved: true });
    expect(p.requiresDoctorApproval()).toBe(false);
  });

  it("update returns new instance with patched fields", () => {
    const p = new WellnessProfile(base);
    const p2 = p.update({ yogaExperienceYears: 5 });
    expect(p2.yogaExperienceYears).toBe(5);
    expect(p.yogaExperienceYears).toBe(2); // original unchanged
  });
});
