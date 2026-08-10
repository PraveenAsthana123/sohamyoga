import { JournalEntry } from "@/domain/yoga/PracticeJournal";

const base = {
  id: "j1",
  studentId: "s1",
  type: "class" as const,
  title: "Morning Hatha",
  date: new Date("2026-01-15"),
  durationMinutes: 60,
  moodBefore: 2 as const,
  moodAfter: 4 as const,
  energyBefore: "low" as const,
  energyAfter: "high" as const,
  stressLevel: 3 as const,
  practiceNotes: "Great class today",
  intentionForSession: "Find stillness",
  gratitudeNote: "Grateful for the teacher",
  asanasAttempted: ["tadasana", "adho_mukha_svanasana"],
  isPrivate: false,
  createdAt: new Date(),
};

describe("JournalEntry", () => {
  it("creates valid entry", () => {
    const e = new JournalEntry(base);
    expect(e.title).toBe("Morning Hatha");
    expect(e.durationMinutes).toBe(60);
  });

  it("throws on blank title", () => {
    expect(() => new JournalEntry({ ...base, title: "  " })).toThrow("Title is required");
  });

  it("throws on zero duration", () => {
    expect(() => new JournalEntry({ ...base, durationMinutes: 0 })).toThrow("Duration must be >= 1 minute");
  });

  it("moodImproved — true when after > before", () => {
    expect(new JournalEntry(base).moodImproved()).toBe(true);
  });

  it("moodImproved — false when after <= before", () => {
    expect(new JournalEntry({ ...base, moodAfter: 2 as const }).moodImproved()).toBe(false);
  });

  it("moodDelta returns correct delta", () => {
    expect(new JournalEntry(base).moodDelta()).toBe(2); // 4-2
  });

  it("energyImproved — true when after is higher tier", () => {
    expect(new JournalEntry(base).energyImproved()).toBe(true);
  });

  it("energyImproved — false when same", () => {
    expect(new JournalEntry({ ...base, energyAfter: "low" as const }).energyImproved()).toBe(false);
  });

  it("hasMilestone — false when no breakthrough", () => {
    expect(new JournalEntry(base).hasMilestone()).toBe(false);
  });

  it("hasMilestone — true when breakthrough set", () => {
    expect(new JournalEntry({ ...base, breakthrough: "First headstand!" }).hasMilestone()).toBe(true);
  });

  it("returns defensive copy of asanasAttempted", () => {
    const e = new JournalEntry(base);
    const arr = e.asanasAttempted;
    arr.push("extra");
    expect(e.asanasAttempted).toHaveLength(2);
  });
});
