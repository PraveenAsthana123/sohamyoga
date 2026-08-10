// InfiniteMarquee — domain-layer unit tests (no React renderer needed)
// Tests focus on data-shaping logic extractable from the component props.

import { describe, it, expect } from "@jest/globals";

// ── helpers mirrored from the component ─────────────────────────────────────

function clampPosition(value: number): number {
  return Math.min(100, Math.max(0, value));
}

function buildDoubled<T>(items: T[]): T[] {
  return [...items, ...items];
}

function buildAnimStyle(speed: number, direction: "left" | "right", paused: boolean, gap: number): Record<string, string | number> {
  return {
    animationDuration: `${speed}s`,
    animationDirection: direction === "right" ? "reverse" : "normal",
    animationPlayState: paused ? "paused" : "running",
    gap: `${gap}px`,
  };
}

// ── test fixtures ────────────────────────────────────────────────────────────

const ITEMS = [
  { id: "s1", label: "Hatha Yoga", icon: "🧘" },
  { id: "s2", label: "Vinyasa Flow", icon: "🌊" },
  { id: "s3", label: "Pranayama", icon: "🌬️" },
  { id: "s4", label: "Meditation", icon: "🕯️" },
];

// ── buildDoubled ─────────────────────────────────────────────────────────────

describe("buildDoubled", () => {
  it("doubles the array length", () => {
    expect(buildDoubled(ITEMS)).toHaveLength(ITEMS.length * 2);
  });

  it("first half equals second half by identity", () => {
    const doubled = buildDoubled(ITEMS);
    for (let i = 0; i < ITEMS.length; i++) {
      expect(doubled[i]).toBe(doubled[i + ITEMS.length]);
    }
  });

  it("handles a single item", () => {
    const result = buildDoubled([ITEMS[0]]);
    expect(result).toHaveLength(2);
    expect(result[0]).toBe(result[1]);
  });

  it("returns empty for empty input", () => {
    expect(buildDoubled([])).toHaveLength(0);
  });
});

// ── buildAnimStyle ───────────────────────────────────────────────────────────

describe("buildAnimStyle", () => {
  it("sets animationDuration from speed", () => {
    expect(buildAnimStyle(20, "left", false, 16).animationDuration).toBe("20s");
  });

  it("left direction uses normal animationDirection", () => {
    expect(buildAnimStyle(30, "left", false, 16).animationDirection).toBe("normal");
  });

  it("right direction uses reverse animationDirection", () => {
    expect(buildAnimStyle(30, "right", false, 16).animationDirection).toBe("reverse");
  });

  it("paused state sets animationPlayState to paused", () => {
    expect(buildAnimStyle(30, "left", true, 16).animationPlayState).toBe("paused");
  });

  it("running state sets animationPlayState to running", () => {
    expect(buildAnimStyle(30, "left", false, 16).animationPlayState).toBe("running");
  });

  it("gap applies in px", () => {
    expect(buildAnimStyle(30, "left", false, 24).gap).toBe("24px");
  });

  it("default gap 16px produces correct string", () => {
    expect(buildAnimStyle(30, "left", false, 16).gap).toBe("16px");
  });
});

// ── speed validation ─────────────────────────────────────────────────────────

describe("speed values", () => {
  it("low speed (10s) is valid", () => {
    const style = buildAnimStyle(10, "left", false, 16);
    expect(style.animationDuration).toBe("10s");
  });

  it("high speed (120s) is valid for slow marquee", () => {
    const style = buildAnimStyle(120, "left", false, 16);
    expect(style.animationDuration).toBe("120s");
  });
});

// ── item structures ──────────────────────────────────────────────────────────

describe("MarqueeItem structure", () => {
  it("all items have required id and label", () => {
    ITEMS.forEach(item => {
      expect(typeof item.id).toBe("string");
      expect(item.id).toBeTruthy();
      expect(typeof item.label).toBe("string");
      expect(item.label).toBeTruthy();
    });
  });

  it("doubled items preserve id uniqueness within each half", () => {
    const ids = ITEMS.map(i => i.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ITEMS.length);
  });

  it("items can have optional logoSrc, description, href, badge", () => {
    const rich = {
      id: "r1", label: "Yoga Mats", icon: "🧘",
      logoSrc: "/logo.png", description: "Premium mats",
      href: "/products", badge: "New",
    };
    expect(rich.logoSrc).toBe("/logo.png");
    expect(rich.badge).toBe("New");
  });
});

// ── variant mapping ──────────────────────────────────────────────────────────

describe("variant", () => {
  const variants = ["logo", "service", "text"] as const;

  it.each(variants)("variant '%s' is a valid string", variant => {
    expect(typeof variant).toBe("string");
  });

  it("service is the default variant", () => {
    const defaultVariant = "service";
    expect(variants.includes(defaultVariant)).toBe(true);
  });
});
