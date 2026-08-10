import { YogaClass } from "@/domain/booking/YogaClass";

const base = {
  id: "cls_1",
  title: "Morning Flow",
  teacherId: "teacher_1",
  style: "Hatha" as const,
  level: "Beginner" as const,
  description: "Gentle morning sequence",
  durationMinutes: 60,
  capacity: 15,
  priceCAD: 15,
  isOnline: false,
  locationOrUrl: "Studio A",
  tags: ["morning", "beginner"],
  isActive: true,
  createdAt: new Date("2026-01-01"),
};

describe("YogaClass", () => {
  it("creates a valid class", () => {
    const cls = new YogaClass(base);
    expect(cls.title).toBe("Morning Flow");
    expect(cls.isFree()).toBe(false);
    expect(cls.isActive).toBe(true);
  });

  it("creates a free class when price is 0", () => {
    const cls = new YogaClass({ ...base, priceCAD: 0 });
    expect(cls.isFree()).toBe(true);
  });

  it("throws on capacity < 1", () => {
    expect(() => new YogaClass({ ...base, capacity: 0 })).toThrow("Capacity must be at least 1");
  });

  it("throws on negative price", () => {
    expect(() => new YogaClass({ ...base, priceCAD: -1 })).toThrow("Price cannot be negative");
  });

  it("throws when duration is below 15 minutes", () => {
    expect(() => new YogaClass({ ...base, durationMinutes: 10 })).toThrow("Duration must be between 15 and 240 minutes");
  });

  it("throws when duration exceeds 240 minutes", () => {
    expect(() => new YogaClass({ ...base, durationMinutes: 300 })).toThrow("Duration must be between 15 and 240 minutes");
  });

  it("throws when title is blank", () => {
    expect(() => new YogaClass({ ...base, title: "   " })).toThrow("Title is required");
  });

  it("deactivates a class immutably", () => {
    const cls = new YogaClass(base);
    const deactivated = cls.deactivate();
    expect(deactivated.isActive).toBe(false);
    expect(cls.isActive).toBe(true); // original unchanged
  });

  it("updates capacity immutably", () => {
    const cls = new YogaClass(base);
    const updated = cls.updateCapacity(20);
    expect(updated.capacity).toBe(20);
    expect(cls.capacity).toBe(15);
  });

  it("throws on updateCapacity < 1", () => {
    const cls = new YogaClass(base);
    expect(() => cls.updateCapacity(0)).toThrow("Capacity must be at least 1");
  });

  it("returns defensive copy of tags", () => {
    const cls = new YogaClass(base);
    const tags = cls.tags;
    tags.push("hacked");
    expect(cls.tags).not.toContain("hacked");
  });

  it("serializes to plain JSON without mutation", () => {
    const cls = new YogaClass(base);
    const json = cls.toJSON();
    expect(json.title).toBe("Morning Flow");
    expect(json).not.toBe(cls); // not same reference
  });
});
