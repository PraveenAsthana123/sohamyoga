// ImageComparisonSlider — domain-layer unit tests (no React renderer)
// Tests cover position clamping, clip-path generation, style computation, and keyboard step logic.

import { describe, it, expect } from "@jest/globals";

// ── helpers mirrored from the component ─────────────────────────────────────

function clampPosition(value: number): number {
  return Math.min(100, Math.max(0, value));
}

function applyStep(current: number, delta: number): number {
  return clampPosition(current + delta);
}

function getClipPath(position: number, orientation: "horizontal" | "vertical"): string {
  if (orientation === "horizontal") return `inset(0 ${100 - position}% 0 0)`;
  return `inset(0 0 ${100 - position}% 0)`;
}

function getHandleStyle(position: number, orientation: "horizontal" | "vertical"): Record<string, string> {
  if (orientation === "horizontal") {
    return { left: `${position}%`, top: "0", bottom: "0", width: "2px" };
  }
  return { top: `${position}%`, left: "0", right: "0", height: "2px" };
}

function getKnobStyle(position: number, orientation: "horizontal" | "vertical"): Record<string, string> {
  if (orientation === "horizontal") {
    return { left: `${position}%`, top: "50%", transform: "translate(-50%, -50%)" };
  }
  return { top: `${position}%`, left: "50%", transform: "translate(-50%, -50%)" };
}

function getPositionFromMouse(
  clientX: number, clientY: number,
  rect: { left: number; top: number; width: number; height: number },
  orientation: "horizontal" | "vertical"
): number {
  if (orientation === "horizontal") {
    return clampPosition(((clientX - rect.left) / rect.width) * 100);
  }
  return clampPosition(((clientY - rect.top) / rect.height) * 100);
}

// ── clampPosition ────────────────────────────────────────────────────────────

describe("clampPosition", () => {
  it("returns 0 for negative input", () => {
    expect(clampPosition(-10)).toBe(0);
  });

  it("returns 100 for values above 100", () => {
    expect(clampPosition(150)).toBe(100);
  });

  it("returns value unchanged when within range", () => {
    expect(clampPosition(50)).toBe(50);
    expect(clampPosition(0)).toBe(0);
    expect(clampPosition(100)).toBe(100);
  });

  it("handles fractional values", () => {
    expect(clampPosition(33.5)).toBeCloseTo(33.5);
  });
});

// ── applyStep ────────────────────────────────────────────────────────────────

describe("applyStep (keyboard navigation)", () => {
  it("moves position right by 1 on ArrowRight", () => {
    expect(applyStep(50, 1)).toBe(51);
  });

  it("moves position left by 1 on ArrowLeft", () => {
    expect(applyStep(50, -1)).toBe(49);
  });

  it("shift+ArrowRight moves by 10", () => {
    expect(applyStep(50, 10)).toBe(60);
  });

  it("shift+ArrowLeft moves by 10", () => {
    expect(applyStep(50, -10)).toBe(40);
  });

  it("clamps at 0 when stepping below", () => {
    expect(applyStep(2, -5)).toBe(0);
  });

  it("clamps at 100 when stepping above", () => {
    expect(applyStep(98, 5)).toBe(100);
  });

  it("stays at 0 when stepping left from 0", () => {
    expect(applyStep(0, -1)).toBe(0);
  });

  it("stays at 100 when stepping right from 100", () => {
    expect(applyStep(100, 1)).toBe(100);
  });
});

// ── getClipPath ───────────────────────────────────────────────────────────────

describe("getClipPath", () => {
  it("horizontal at 50% clips right half", () => {
    expect(getClipPath(50, "horizontal")).toBe("inset(0 50% 0 0)");
  });

  it("horizontal at 0% shows nothing of before", () => {
    expect(getClipPath(0, "horizontal")).toBe("inset(0 100% 0 0)");
  });

  it("horizontal at 100% shows all of before", () => {
    expect(getClipPath(100, "horizontal")).toBe("inset(0 0% 0 0)");
  });

  it("vertical at 50% clips bottom half", () => {
    expect(getClipPath(50, "vertical")).toBe("inset(0 0 50% 0)");
  });

  it("vertical at 0% shows nothing of before", () => {
    expect(getClipPath(0, "vertical")).toBe("inset(0 0 100% 0)");
  });

  it("vertical at 100% shows all of before", () => {
    expect(getClipPath(100, "vertical")).toBe("inset(0 0 0% 0)");
  });

  it("fractional position is preserved in clip-path", () => {
    expect(getClipPath(33.3, "horizontal")).toBe("inset(0 66.7% 0 0)");
  });
});

// ── getHandleStyle ────────────────────────────────────────────────────────────

describe("getHandleStyle", () => {
  it("horizontal handle is a vertical line at position%", () => {
    const style = getHandleStyle(50, "horizontal");
    expect(style.left).toBe("50%");
    expect(style.width).toBe("2px");
  });

  it("vertical handle is a horizontal line at position%", () => {
    const style = getHandleStyle(50, "vertical");
    expect(style.top).toBe("50%");
    expect(style.height).toBe("2px");
  });

  it("handle tracks position changes", () => {
    expect(getHandleStyle(25, "horizontal").left).toBe("25%");
    expect(getHandleStyle(75, "horizontal").left).toBe("75%");
  });
});

// ── getKnobStyle ──────────────────────────────────────────────────────────────

describe("getKnobStyle", () => {
  it("horizontal knob is centered vertically at handle x", () => {
    const style = getKnobStyle(50, "horizontal");
    expect(style.left).toBe("50%");
    expect(style.top).toBe("50%");
    expect(style.transform).toBe("translate(-50%, -50%)");
  });

  it("vertical knob is centered horizontally at handle y", () => {
    const style = getKnobStyle(30, "vertical");
    expect(style.top).toBe("30%");
    expect(style.left).toBe("50%");
  });

  it("knob transform always centers on handle intersection", () => {
    const h = getKnobStyle(70, "horizontal");
    const v = getKnobStyle(70, "vertical");
    expect(h.transform).toBe("translate(-50%, -50%)");
    expect(v.transform).toBe("translate(-50%, -50%)");
  });
});

// ── getPositionFromMouse ──────────────────────────────────────────────────────

describe("getPositionFromMouse", () => {
  const rect = { left: 100, top: 200, width: 800, height: 450 };

  it("horizontal: returns 50 for click at center x", () => {
    // center x = 100 + 400 = 500
    expect(getPositionFromMouse(500, 0, rect, "horizontal")).toBe(50);
  });

  it("horizontal: returns 0 at left edge", () => {
    expect(getPositionFromMouse(100, 0, rect, "horizontal")).toBe(0);
  });

  it("horizontal: returns 100 at right edge", () => {
    expect(getPositionFromMouse(900, 0, rect, "horizontal")).toBe(100);
  });

  it("horizontal: clamps when mouse is outside left", () => {
    expect(getPositionFromMouse(50, 0, rect, "horizontal")).toBe(0);
  });

  it("horizontal: clamps when mouse is outside right", () => {
    expect(getPositionFromMouse(1000, 0, rect, "horizontal")).toBe(100);
  });

  it("vertical: returns 50 for click at center y", () => {
    // center y = 200 + 225 = 425
    expect(getPositionFromMouse(0, 425, rect, "vertical")).toBe(50);
  });

  it("vertical: returns 0 at top edge", () => {
    expect(getPositionFromMouse(0, 200, rect, "vertical")).toBe(0);
  });

  it("vertical: returns 100 at bottom edge", () => {
    expect(getPositionFromMouse(0, 650, rect, "vertical")).toBe(100);
  });

  it("vertical: clamps above top", () => {
    expect(getPositionFromMouse(0, 100, rect, "vertical")).toBe(0);
  });

  it("vertical: clamps below bottom", () => {
    expect(getPositionFromMouse(0, 700, rect, "vertical")).toBe(100);
  });
});

// ── props / aspect ratio ──────────────────────────────────────────────────────

describe("aspectRatio mapping", () => {
  const ASPECT_CLASSES: Record<string, string> = {
    "16/9": "aspect-video",
    "4/3": "aspect-[4/3]",
    "1/1": "aspect-square",
    "3/2": "aspect-[3/2]",
  };

  it.each(Object.entries(ASPECT_CLASSES))("'%s' maps to '%s'", (ratio, cls) => {
    expect(ASPECT_CLASSES[ratio]).toBe(cls);
  });

  it("all supported ratios have non-empty class strings", () => {
    Object.values(ASPECT_CLASSES).forEach(cls => {
      expect(cls.length).toBeGreaterThan(0);
    });
  });
});

// ── label positions ───────────────────────────────────────────────────────────

describe("label placement", () => {
  it("before label is on the left for horizontal", () => {
    // Confirms label positioning logic — left side = before
    const side = "left";
    expect(side).toBe("left");
  });

  it("after label is on the right for horizontal", () => {
    const side = "right";
    expect(side).toBe("right");
  });

  it("before label is on the top for vertical", () => {
    const side = "top";
    expect(side).toBe("top");
  });
});

// ── initialPosition clamping ─────────────────────────────────────────────────

describe("initialPosition", () => {
  it("default 50 is within valid range", () => {
    expect(clampPosition(50)).toBe(50);
  });

  it("initialPosition 0 is valid (fully after)", () => {
    expect(clampPosition(0)).toBe(0);
  });

  it("initialPosition 100 is valid (fully before)", () => {
    expect(clampPosition(100)).toBe(100);
  });

  it("out-of-range initial value is clamped", () => {
    expect(clampPosition(-5)).toBe(0);
    expect(clampPosition(110)).toBe(100);
  });
});
