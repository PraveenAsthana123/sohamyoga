import { CarouselSlide, CarouselSlideProps, ContentOverlay } from "../../../domain/carousel/CarouselSlide";

const NOW    = new Date("2026-08-05T10:00:00Z");
const FUTURE = new Date("2027-01-01");
const PAST   = new Date("2025-01-01");

const defaultOverlay: ContentOverlay = {
  heading: "Morning Yoga",
  subheading: "Join us every day at 7am",
  position: "center",
  textColor: "white",
};

function imgBase(overrides: Partial<CarouselSlideProps> = {}): CarouselSlideProps {
  return {
    id: "sl-1",
    carouselId: "cr-1",
    type: "image",
    status: "active",
    order: 0,
    src: "/images/yoga-hero.jpg",
    alt: "Morning yoga class",
    muted: false,
    showControls: false,
    createdBy: "admin-1",
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function videoBase(overrides: Partial<CarouselSlideProps> = {}): CarouselSlideProps {
  return {
    ...imgBase(),
    type: "video_mp4",
    src: "/videos/yoga-intro.mp4",
    alt: undefined,
    poster: "/images/yoga-poster.jpg",
    muted: true,
    showControls: true,
    durationSeconds: 30,
    ...overrides,
  };
}

describe("CarouselSlide — construction", () => {
  it("creates a valid image slide", () => {
    const s = new CarouselSlide(imgBase());
    expect(s.type).toBe("image");
    expect(s.status).toBe("active");
    expect(s.muted).toBe(false);
  });

  it("creates a valid video slide", () => {
    const s = new CarouselSlide(videoBase());
    expect(s.type).toBe("video_mp4");
    expect(s.muted).toBe(true);
    expect(s.durationSeconds).toBe(30);
  });

  it("throws on empty id", () => {
    expect(() => new CarouselSlide(imgBase({ id: "" }))).toThrow("id is required");
  });

  it("throws on empty carouselId", () => {
    expect(() => new CarouselSlide(imgBase({ carouselId: "" }))).toThrow("carouselId is required");
  });

  it("throws on empty src", () => {
    expect(() => new CarouselSlide(imgBase({ src: "" }))).toThrow("src is required");
  });

  it("throws on empty createdBy", () => {
    expect(() => new CarouselSlide(imgBase({ createdBy: "" }))).toThrow("createdBy is required");
  });

  it("throws on negative order", () => {
    expect(() => new CarouselSlide(imgBase({ order: -1 }))).toThrow("order must be >= 0");
  });

  it("throws on durationSeconds <= 0", () => {
    expect(() => new CarouselSlide(videoBase({ durationSeconds: 0 }))).toThrow("durationSeconds must be > 0");
  });

  it("throws on width <= 0", () => {
    expect(() => new CarouselSlide(imgBase({ width: 0 }))).toThrow("width must be > 0");
  });

  it("throws on height <= 0", () => {
    expect(() => new CarouselSlide(imgBase({ height: 0 }))).toThrow("height must be > 0");
  });

  it("throws when activeTo <= activeFrom", () => {
    expect(() => new CarouselSlide(imgBase({ activeFrom: FUTURE, activeTo: FUTURE }))).toThrow("activeTo must be after activeFrom");
  });

  it("overlay getter returns defensive copy", () => {
    const s = new CarouselSlide(imgBase({ overlay: defaultOverlay }));
    const o = s.overlay!;
    (o as { heading: string }).heading = "hacked";
    expect(s.overlay!.heading).toBe("Morning Yoga");
  });
});

describe("CarouselSlide — type checks", () => {
  it("isImage for image", () => {
    expect(new CarouselSlide(imgBase()).isImage()).toBe(true);
  });

  it("isImage false for video", () => {
    expect(new CarouselSlide(videoBase()).isImage()).toBe(false);
  });

  it("isVideo for video_mp4", () => {
    expect(new CarouselSlide(videoBase()).isVideo()).toBe(true);
  });

  it("isVideo for youtube", () => {
    expect(new CarouselSlide(videoBase({ type: "youtube" })).isVideo()).toBe(true);
  });

  it("isVideo for vimeo", () => {
    expect(new CarouselSlide(videoBase({ type: "vimeo" })).isVideo()).toBe(true);
  });

  it("isVideo false for image", () => {
    expect(new CarouselSlide(imgBase()).isVideo()).toBe(false);
  });

  it("isHostedVideo for youtube", () => {
    expect(new CarouselSlide(videoBase({ type: "youtube" })).isHostedVideo()).toBe(true);
  });

  it("isHostedVideo for vimeo", () => {
    expect(new CarouselSlide(videoBase({ type: "vimeo" })).isHostedVideo()).toBe(true);
  });

  it("isHostedVideo false for video_mp4", () => {
    expect(new CarouselSlide(videoBase()).isHostedVideo()).toBe(false);
  });

  it("isHostedVideo false for image", () => {
    expect(new CarouselSlide(imgBase()).isHostedVideo()).toBe(false);
  });
});

describe("CarouselSlide — hasOverlay and isScheduled", () => {
  it("hasOverlay false when no overlay", () => {
    expect(new CarouselSlide(imgBase()).hasOverlay()).toBe(false);
  });

  it("hasOverlay true when overlay provided", () => {
    expect(new CarouselSlide(imgBase({ overlay: defaultOverlay })).hasOverlay()).toBe(true);
  });

  it("isScheduled false when no dates", () => {
    expect(new CarouselSlide(imgBase()).isScheduled()).toBe(false);
  });

  it("isScheduled true when activeFrom set", () => {
    expect(new CarouselSlide(imgBase({ activeFrom: FUTURE })).isScheduled()).toBe(true);
  });

  it("isScheduled true when activeTo set", () => {
    expect(new CarouselSlide(imgBase({ activeTo: FUTURE })).isScheduled()).toBe(true);
  });
});

describe("CarouselSlide — isActiveAt", () => {
  it("true when active and no date constraints", () => {
    expect(new CarouselSlide(imgBase({ status: "active" })).isActiveAt(NOW)).toBe(true);
  });

  it("false when inactive", () => {
    expect(new CarouselSlide(imgBase({ status: "inactive" })).isActiveAt(NOW)).toBe(false);
  });

  it("false when draft", () => {
    expect(new CarouselSlide(imgBase({ status: "draft" })).isActiveAt(NOW)).toBe(false);
  });

  it("false before activeFrom", () => {
    const s = new CarouselSlide(imgBase({ status: "active", activeFrom: FUTURE }));
    expect(s.isActiveAt(NOW)).toBe(false);
  });

  it("false after activeTo", () => {
    const s = new CarouselSlide(imgBase({ status: "active", activeFrom: new Date("2024-01-01"), activeTo: PAST }));
    expect(s.isActiveAt(NOW)).toBe(false);
  });

  it("true when scheduled and within range", () => {
    const s = new CarouselSlide(imgBase({ status: "scheduled", activeFrom: PAST, activeTo: FUTURE }));
    expect(s.isActiveAt(NOW)).toBe(true);
  });
});

describe("CarouselSlide — aspectRatio", () => {
  it("undefined when no dimensions", () => {
    expect(new CarouselSlide(imgBase()).aspectRatio()).toBeUndefined();
  });

  it("calculates 16:9 ratio", () => {
    const s = new CarouselSlide(imgBase({ width: 1920, height: 1080 }));
    expect(s.aspectRatio()).toBeCloseTo(1.78, 1);
  });

  it("calculates square ratio", () => {
    expect(new CarouselSlide(imgBase({ width: 800, height: 800 })).aspectRatio()).toBe(1);
  });
});

describe("CarouselSlide — activate and deactivate", () => {
  it("activates a draft slide", () => {
    expect(new CarouselSlide(imgBase({ status: "draft" })).activate().status).toBe("active");
  });

  it("activate is immutable", () => {
    const s = new CarouselSlide(imgBase({ status: "draft" }));
    s.activate();
    expect(s.status).toBe("draft");
  });

  it("deactivates an active slide", () => {
    expect(new CarouselSlide(imgBase()).deactivate().status).toBe("inactive");
  });
});

describe("CarouselSlide — schedule", () => {
  it("sets scheduled status with dates", () => {
    const s = new CarouselSlide(imgBase()).schedule(PAST, FUTURE);
    expect(s.status).toBe("scheduled");
    expect(s.activeFrom).toEqual(PAST);
    expect(s.activeTo).toEqual(FUTURE);
  });

  it("throws when activeTo <= activeFrom", () => {
    expect(() => new CarouselSlide(imgBase()).schedule(FUTURE, FUTURE)).toThrow("activeTo must be after activeFrom");
  });

  it("is immutable", () => {
    const s = new CarouselSlide(imgBase());
    s.schedule(PAST, FUTURE);
    expect(s.status).toBe("active");
  });
});

describe("CarouselSlide — reorder", () => {
  it("sets new order", () => {
    expect(new CarouselSlide(imgBase()).reorder(5).order).toBe(5);
  });

  it("throws on negative order", () => {
    expect(() => new CarouselSlide(imgBase()).reorder(-1)).toThrow("order must be >= 0");
  });

  it("is immutable", () => {
    const s = new CarouselSlide(imgBase({ order: 0 }));
    s.reorder(5);
    expect(s.order).toBe(0);
  });
});

describe("CarouselSlide — overlay management", () => {
  it("setOverlay adds overlay", () => {
    const s = new CarouselSlide(imgBase()).setOverlay(defaultOverlay);
    expect(s.hasOverlay()).toBe(true);
    expect(s.overlay!.heading).toBe("Morning Yoga");
  });

  it("setOverlay is immutable", () => {
    const s = new CarouselSlide(imgBase());
    s.setOverlay(defaultOverlay);
    expect(s.hasOverlay()).toBe(false);
  });

  it("removeOverlay clears overlay", () => {
    const s = new CarouselSlide(imgBase({ overlay: defaultOverlay })).removeOverlay();
    expect(s.hasOverlay()).toBe(false);
  });

  it("all overlay positions are valid", () => {
    const positions = ["top-left","top-center","top-right","center-left","center","center-right","bottom-left","bottom-center","bottom-right"] as const;
    for (const position of positions) {
      const s = new CarouselSlide(imgBase()).setOverlay({ ...defaultOverlay, position });
      expect(s.overlay!.position).toBe(position);
    }
  });
});

describe("CarouselSlide — muteVideo", () => {
  it("mutes an unmuted video", () => {
    const s = new CarouselSlide(videoBase({ muted: false })).muteVideo();
    expect(s.muted).toBe(true);
  });

  it("throws on image slide", () => {
    expect(() => new CarouselSlide(imgBase()).muteVideo()).toThrow("muteVideo only applies to video slides");
  });

  it("is immutable", () => {
    const s = new CarouselSlide(videoBase({ muted: false }));
    s.muteVideo();
    expect(s.muted).toBe(false);
  });
});
