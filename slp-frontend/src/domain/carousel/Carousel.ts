export type CarouselLocation =
  | "hero" | "testimonials" | "gallery" | "teachers"
  | "services" | "promotions" | "classes" | "partners"
  | "videos" | "products";

export type CarouselStatus = "draft" | "active" | "paused" | "archived";
export type CarouselEffect = "slide" | "fade" | "coverflow" | "cube" | "flip";

export interface CarouselBreakpoint {
  slidesPerView: number;
  spaceBetween: number;
}

export interface CarouselSettings {
  autoplay: boolean;
  autoplayDelay: number;
  pauseOnHover: boolean;
  loop: boolean;
  speed: number;
  effect: CarouselEffect;
  slidesPerView: number;
  spaceBetween: number;
  showArrows: boolean;
  showDots: boolean;
  touchEnabled: boolean;
  keyboardEnabled: boolean;
  lazyLoad: boolean;
  centerMode: boolean;
  breakpoints?: {
    640?: CarouselBreakpoint;
    768?: CarouselBreakpoint;
    1024?: CarouselBreakpoint;
    1280?: CarouselBreakpoint;
  };
}

export interface CarouselProps {
  id: string;
  name: string;
  location: CarouselLocation;
  status: CarouselStatus;
  slideIds: string[];
  settings: CarouselSettings;
  clickCount: number;
  viewCount: number;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  publishedAt?: Date;
}

const DEFAULT_SETTINGS: CarouselSettings = {
  autoplay: true,
  autoplayDelay: 5000,
  pauseOnHover: true,
  loop: true,
  speed: 600,
  effect: "slide",
  slidesPerView: 1,
  spaceBetween: 0,
  showArrows: true,
  showDots: true,
  touchEnabled: true,
  keyboardEnabled: true,
  lazyLoad: true,
  centerMode: false,
};

export { DEFAULT_SETTINGS as CAROUSEL_DEFAULT_SETTINGS };

export class Carousel {
  private readonly props: Readonly<CarouselProps>;

  constructor(props: CarouselProps) {
    if (!props.id?.trim())        throw new Error("id is required");
    if (!props.name?.trim())      throw new Error("name is required");
    if (!props.createdBy?.trim()) throw new Error("createdBy is required");
    if (props.clickCount < 0)     throw new Error("clickCount must be >= 0");
    if (props.viewCount < 0)      throw new Error("viewCount must be >= 0");
    if (props.settings.autoplayDelay < 500) {
      throw new Error("autoplayDelay must be >= 500ms");
    }
    if (props.settings.speed < 0) throw new Error("speed must be >= 0");
    if (props.settings.slidesPerView < 1) {
      throw new Error("slidesPerView must be >= 1");
    }
    if (props.settings.spaceBetween < 0) {
      throw new Error("spaceBetween must be >= 0");
    }
    this.props = {
      ...props,
      slideIds: [...props.slideIds],
      settings: { ...props.settings, breakpoints: props.settings.breakpoints ? { ...props.settings.breakpoints } : undefined },
    };
  }

  get id()          { return this.props.id; }
  get name()        { return this.props.name; }
  get location()    { return this.props.location; }
  get status()      { return this.props.status; }
  get slideIds()    { return [...this.props.slideIds]; }
  get settings()    { return { ...this.props.settings, breakpoints: this.props.settings.breakpoints ? { ...this.props.settings.breakpoints } : undefined }; }
  get clickCount()  { return this.props.clickCount; }
  get viewCount()   { return this.props.viewCount; }
  get createdBy()   { return this.props.createdBy; }
  get createdAt()   { return this.props.createdAt; }
  get updatedAt()   { return this.props.updatedAt; }
  get publishedAt() { return this.props.publishedAt; }

  ctr(): number {
    if (this.props.viewCount === 0) return 0;
    return Math.round((this.props.clickCount / this.props.viewCount) * 100 * 100) / 100;
  }

  slideCount(): number {
    return this.props.slideIds.length;
  }

  hasSlide(slideId: string): boolean {
    return this.props.slideIds.includes(slideId);
  }

  isActive(): boolean {
    return this.props.status === "active";
  }

  publish(at: Date = new Date()): Carousel {
    if (this.props.status === "archived") throw new Error("Archived carousels cannot be published");
    if (this.props.status === "active")   throw new Error("Carousel is already active");
    if (this.props.slideIds.length === 0) throw new Error("Cannot publish a carousel with no slides");
    return new Carousel({ ...this.props, slideIds: [...this.props.slideIds], settings: this.settings, status: "active", publishedAt: at, updatedAt: new Date() });
  }

  pause(): Carousel {
    if (this.props.status !== "active") throw new Error("Only active carousels can be paused");
    return new Carousel({ ...this.props, slideIds: [...this.props.slideIds], settings: this.settings, status: "paused", updatedAt: new Date() });
  }

  resume(): Carousel {
    if (this.props.status !== "paused") throw new Error("Only paused carousels can be resumed");
    return new Carousel({ ...this.props, slideIds: [...this.props.slideIds], settings: this.settings, status: "active", updatedAt: new Date() });
  }

  archive(): Carousel {
    if (this.props.status === "archived") throw new Error("Carousel is already archived");
    return new Carousel({ ...this.props, slideIds: [...this.props.slideIds], settings: this.settings, status: "archived", updatedAt: new Date() });
  }

  addSlide(slideId: string): Carousel {
    if (!slideId?.trim()) throw new Error("slideId is required");
    if (this.hasSlide(slideId)) return this;
    return new Carousel({ ...this.props, slideIds: [...this.props.slideIds, slideId], settings: this.settings, updatedAt: new Date() });
  }

  removeSlide(slideId: string): Carousel {
    if (!this.hasSlide(slideId)) return this;
    return new Carousel({ ...this.props, slideIds: this.props.slideIds.filter(id => id !== slideId), settings: this.settings, updatedAt: new Date() });
  }

  reorderSlides(orderedIds: string[]): Carousel {
    const current = new Set(this.props.slideIds);
    for (const id of orderedIds) {
      if (!current.has(id)) throw new Error(`Slide not in carousel: ${id}`);
    }
    if (orderedIds.length !== this.props.slideIds.length) {
      throw new Error("Reorder must include all existing slide IDs");
    }
    return new Carousel({ ...this.props, slideIds: [...orderedIds], settings: this.settings, updatedAt: new Date() });
  }

  updateSettings(partial: Partial<CarouselSettings>): Carousel {
    const merged: CarouselSettings = { ...this.props.settings, ...partial };
    return new Carousel({ ...this.props, slideIds: [...this.props.slideIds], settings: merged, updatedAt: new Date() });
  }

  recordView(): Carousel {
    return new Carousel({ ...this.props, slideIds: [...this.props.slideIds], settings: this.settings, viewCount: this.props.viewCount + 1 });
  }

  recordClick(): Carousel {
    return new Carousel({ ...this.props, slideIds: [...this.props.slideIds], settings: this.settings, clickCount: this.props.clickCount + 1 });
  }
}
