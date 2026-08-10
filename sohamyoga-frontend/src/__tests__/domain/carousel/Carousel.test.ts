import { Carousel, CarouselProps, CarouselSettings, CAROUSEL_DEFAULT_SETTINGS } from "../../../domain/carousel/Carousel";

const NOW    = new Date("2026-08-05");
const FUTURE = new Date("2027-01-01");

const defSettings: CarouselSettings = { ...CAROUSEL_DEFAULT_SETTINGS };

function base(overrides: Partial<CarouselProps> = {}): CarouselProps {
  return {
    id: "cr-1",
    name: "Homepage Hero",
    location: "hero",
    status: "draft",
    slideIds: ["sl-1", "sl-2"],
    settings: { ...defSettings },
    clickCount: 0,
    viewCount: 0,
    createdBy: "admin-1",
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

describe("Carousel — construction", () => {
  it("creates a valid carousel", () => {
    const c = new Carousel(base());
    expect(c.name).toBe("Homepage Hero");
    expect(c.status).toBe("draft");
    expect(c.slideIds).toHaveLength(2);
  });

  it("throws on empty id", () => {
    expect(() => new Carousel(base({ id: "" }))).toThrow("id is required");
  });

  it("throws on empty name", () => {
    expect(() => new Carousel(base({ name: "" }))).toThrow("name is required");
  });

  it("throws on empty createdBy", () => {
    expect(() => new Carousel(base({ createdBy: "" }))).toThrow("createdBy is required");
  });

  it("throws on negative clickCount", () => {
    expect(() => new Carousel(base({ clickCount: -1 }))).toThrow("clickCount must be >= 0");
  });

  it("throws on negative viewCount", () => {
    expect(() => new Carousel(base({ viewCount: -1 }))).toThrow("viewCount must be >= 0");
  });

  it("throws on autoplayDelay < 500", () => {
    expect(() => new Carousel(base({ settings: { ...defSettings, autoplayDelay: 400 } }))).toThrow("autoplayDelay must be >= 500ms");
  });

  it("throws on negative speed", () => {
    expect(() => new Carousel(base({ settings: { ...defSettings, speed: -1 } }))).toThrow("speed must be >= 0");
  });

  it("throws on slidesPerView < 1", () => {
    expect(() => new Carousel(base({ settings: { ...defSettings, slidesPerView: 0 } }))).toThrow("slidesPerView must be >= 1");
  });

  it("throws on negative spaceBetween", () => {
    expect(() => new Carousel(base({ settings: { ...defSettings, spaceBetween: -1 } }))).toThrow("spaceBetween must be >= 0");
  });

  it("slideIds getter returns defensive copy", () => {
    const c = new Carousel(base());
    const ids = c.slideIds;
    ids.push("injected");
    expect(c.slideIds).toHaveLength(2);
  });

  it("settings getter returns defensive copy", () => {
    const c = new Carousel(base());
    const s = c.settings;
    (s as { speed: number }).speed = 9999;
    expect(c.settings.speed).toBe(defSettings.speed);
  });
});

describe("Carousel — ctr and counts", () => {
  it("ctr is 0 with no views", () => {
    expect(new Carousel(base()).ctr()).toBe(0);
  });

  it("ctr calculates correctly", () => {
    const c = new Carousel(base({ viewCount: 1000, clickCount: 50 }));
    expect(c.ctr()).toBe(5);
  });

  it("slideCount returns slide count", () => {
    expect(new Carousel(base()).slideCount()).toBe(2);
  });

  it("hasSlide returns true for existing", () => {
    expect(new Carousel(base()).hasSlide("sl-1")).toBe(true);
  });

  it("hasSlide returns false for missing", () => {
    expect(new Carousel(base()).hasSlide("sl-99")).toBe(false);
  });

  it("isActive returns false for draft", () => {
    expect(new Carousel(base()).isActive()).toBe(false);
  });

  it("isActive returns true for active status", () => {
    expect(new Carousel(base({ status: "active" })).isActive()).toBe(true);
  });
});

describe("Carousel — publish", () => {
  it("draft → active on publish", () => {
    const c = new Carousel(base()).publish(NOW);
    expect(c.status).toBe("active");
    expect(c.publishedAt).toEqual(NOW);
  });

  it("publish is immutable", () => {
    const c = new Carousel(base());
    c.publish(NOW);
    expect(c.status).toBe("draft");
  });

  it("throws when publishing with no slides", () => {
    expect(() => new Carousel(base({ slideIds: [] })).publish()).toThrow("no slides");
  });

  it("throws when already active", () => {
    expect(() => new Carousel(base({ status: "active" })).publish()).toThrow("already active");
  });

  it("throws when archived", () => {
    expect(() => new Carousel(base({ status: "archived" })).publish()).toThrow("cannot be published");
  });
});

describe("Carousel — pause and resume", () => {
  it("active → paused", () => {
    expect(new Carousel(base({ status: "active" })).pause().status).toBe("paused");
  });

  it("throws when pausing non-active", () => {
    expect(() => new Carousel(base()).pause()).toThrow("Only active carousels can be paused");
  });

  it("paused → active on resume", () => {
    expect(new Carousel(base({ status: "paused" })).resume().status).toBe("active");
  });

  it("throws when resuming non-paused", () => {
    expect(() => new Carousel(base()).resume()).toThrow("Only paused carousels can be resumed");
  });
});

describe("Carousel — archive", () => {
  it("active → archived", () => {
    expect(new Carousel(base({ status: "active" })).archive().status).toBe("archived");
  });

  it("throws when already archived", () => {
    expect(() => new Carousel(base({ status: "archived" })).archive()).toThrow("already archived");
  });
});

describe("Carousel — slide management", () => {
  it("addSlide appends new id", () => {
    const c = new Carousel(base()).addSlide("sl-3");
    expect(c.slideIds).toContain("sl-3");
    expect(c.slideIds).toHaveLength(3);
  });

  it("addSlide is idempotent for duplicate", () => {
    const c = new Carousel(base()).addSlide("sl-1");
    expect(c.slideIds).toHaveLength(2);
  });

  it("addSlide throws on empty id", () => {
    expect(() => new Carousel(base()).addSlide("")).toThrow("slideId is required");
  });

  it("removeSlide removes existing", () => {
    const c = new Carousel(base()).removeSlide("sl-1");
    expect(c.slideIds).not.toContain("sl-1");
    expect(c.slideIds).toHaveLength(1);
  });

  it("removeSlide is no-op for missing id", () => {
    expect(new Carousel(base()).removeSlide("sl-99").slideIds).toHaveLength(2);
  });

  it("reorderSlides reorders correctly", () => {
    const c = new Carousel(base()).reorderSlides(["sl-2", "sl-1"]);
    expect(c.slideIds[0]).toBe("sl-2");
    expect(c.slideIds[1]).toBe("sl-1");
  });

  it("reorderSlides throws on unknown id", () => {
    expect(() => new Carousel(base()).reorderSlides(["sl-1", "sl-99"])).toThrow("not in carousel");
  });

  it("reorderSlides throws on wrong count", () => {
    expect(() => new Carousel(base()).reorderSlides(["sl-1"])).toThrow("all existing slide IDs");
  });
});

describe("Carousel — updateSettings", () => {
  it("updates single setting", () => {
    const c = new Carousel(base()).updateSettings({ autoplayDelay: 8000 });
    expect(c.settings.autoplayDelay).toBe(8000);
  });

  it("throws via constructor on invalid setting", () => {
    expect(() => new Carousel(base()).updateSettings({ autoplayDelay: 100 })).toThrow("autoplayDelay must be >= 500ms");
  });

  it("is immutable", () => {
    const c = new Carousel(base());
    c.updateSettings({ autoplayDelay: 8000 });
    expect(c.settings.autoplayDelay).toBe(defSettings.autoplayDelay);
  });

  it("can disable autoplay", () => {
    expect(new Carousel(base()).updateSettings({ autoplay: false }).settings.autoplay).toBe(false);
  });

  it("can set different effects", () => {
    for (const effect of ["slide", "fade", "coverflow", "cube", "flip"] as const) {
      expect(new Carousel(base()).updateSettings({ effect }).settings.effect).toBe(effect);
    }
  });
});

describe("Carousel — recordView and recordClick", () => {
  it("recordView increments viewCount", () => {
    expect(new Carousel(base()).recordView().viewCount).toBe(1);
  });

  it("recordClick increments clickCount", () => {
    expect(new Carousel(base()).recordClick().clickCount).toBe(1);
  });

  it("both are immutable", () => {
    const c = new Carousel(base());
    c.recordView(); c.recordClick();
    expect(c.viewCount).toBe(0);
    expect(c.clickCount).toBe(0);
  });

  it("ctr after views and clicks", () => {
    const c = new Carousel(base({ viewCount: 200, clickCount: 10 }));
    expect(c.ctr()).toBe(5);
  });
});

describe("Carousel — all locations accepted", () => {
  const LOCATIONS = ["hero","testimonials","gallery","teachers","services","promotions","classes","partners","videos","products"] as const;
  it.each(LOCATIONS)("location: %s", (loc) => {
    expect(new Carousel(base({ location: loc })).location).toBe(loc);
  });
});
