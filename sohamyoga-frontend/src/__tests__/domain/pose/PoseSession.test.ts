import { PoseSession } from "@/domain/pose/PoseSession";

const base = {
  id: "pose_1",
  studentId: "student_1",
  poseName: "Warrior I",
  score: 78,
  feedback: {
    corrections: ["Straighten your back knee", "Lower your hips"],
    tip: "Ground through your back foot",
    bodyParts: ["knee", "hips"],
  },
  modelUsed: "mediapipe_v2+ollama:qwen2.5",
  durationSeconds: 30,
  sessionDate: new Date("2026-08-04"),
};

describe("PoseSession", () => {
  it("creates a valid session", () => {
    const s = new PoseSession(base);
    expect(s.score).toBe(78);
    expect(s.poseName).toBe("Warrior I");
  });

  it("grades correctly", () => {
    expect(new PoseSession({ ...base, score: 92 }).grade()).toBe("excellent");
    expect(new PoseSession({ ...base, score: 80 }).grade()).toBe("good");
    expect(new PoseSession({ ...base, score: 60 }).grade()).toBe("needs_work");
    expect(new PoseSession({ ...base, score: 40 }).grade()).toBe("poor");
  });

  it("detects corrections", () => {
    expect(new PoseSession(base).hasCorrections()).toBe(true);
    expect(new PoseSession({ ...base, feedback: { ...base.feedback, corrections: [] } }).hasCorrections()).toBe(false);
  });

  it("throws on score out of range", () => {
    expect(() => new PoseSession({ ...base, score: 101 })).toThrow("Score must be 0–100");
    expect(() => new PoseSession({ ...base, score: -1 })).toThrow("Score must be 0–100");
  });

  it("throws on blank pose name", () => {
    expect(() => new PoseSession({ ...base, poseName: "" })).toThrow("Pose name is required");
  });

  it("throws on duration < 1", () => {
    expect(() => new PoseSession({ ...base, durationSeconds: 0 })).toThrow("Duration must be at least 1 second");
  });

  it("toJSON does not include imageBase64", () => {
    const s = new PoseSession({ ...base, imageBase64: "base64data" });
    const json = s.toJSON() as Record<string, unknown>;
    expect("imageBase64" in json).toBe(false);
  });

  it("returns defensive copy of corrections", () => {
    const s = new PoseSession(base);
    s.feedback.corrections.push("hacked");
    expect(s.feedback.corrections).not.toContain("hacked");
  });
});
