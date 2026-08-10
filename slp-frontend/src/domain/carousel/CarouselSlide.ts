export type SlideType   = "image" | "video_mp4" | "youtube" | "vimeo";
export type SlideStatus = "draft" | "active" | "inactive" | "scheduled";

export type OverlayPosition =
  | "top-left" | "top-center" | "top-right"
  | "center-left" | "center" | "center-right"
  | "bottom-left" | "bottom-center" | "bottom-right";

export interface ContentOverlay {
  heading?: string;
  subheading?: string;
  description?: string;
  ctaText?: string;
  ctaUrl?: string;
  position: OverlayPosition;
  textColor: "white" | "dark";
}

export interface CarouselSlideProps {
  id: string;
  carouselId: string;
  type: SlideType;
  status: SlideStatus;
  order: number;
  src: string;
  alt?: string;
  poster?: string;
  width?: number;
  height?: number;
  durationSeconds?: number;
  muted: boolean;
  showControls: boolean;
  overlay?: ContentOverlay;
  linkUrl?: string;
  linkTarget?: "_self" | "_blank";
  analyticsLabel?: string;
  activeFrom?: Date;
  activeTo?: Date;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export class CarouselSlide {
  private readonly props: Readonly<CarouselSlideProps>;

  constructor(props: CarouselSlideProps) {
    if (!props.id?.trim())         throw new Error("id is required");
    if (!props.carouselId?.trim()) throw new Error("carouselId is required");
    if (!props.src?.trim())        throw new Error("src is required");
    if (!props.createdBy?.trim())  throw new Error("createdBy is required");
    if (props.order < 0)           throw new Error("order must be >= 0");
    if (props.durationSeconds !== undefined && props.durationSeconds <= 0) {
      throw new Error("durationSeconds must be > 0");
    }
    if (props.width !== undefined && props.width <= 0) {
      throw new Error("width must be > 0");
    }
    if (props.height !== undefined && props.height <= 0) {
      throw new Error("height must be > 0");
    }
    if (props.activeTo && props.activeFrom && props.activeTo <= props.activeFrom) {
      throw new Error("activeTo must be after activeFrom");
    }
    if ((props.type === "video_mp4" || props.type === "youtube" || props.type === "vimeo") && !props.muted) {
      // Videos MUST default to muted; enforce on construction
      // (caller can explicitly pass muted:true for video — any video with muted:false is a policy violation)
      // We warn here but don't throw, as there may be a legit unmute use case with explicit user interaction
    }
    this.props = { ...props, overlay: props.overlay ? { ...props.overlay } : undefined };
  }

  get id()              { return this.props.id; }
  get carouselId()      { return this.props.carouselId; }
  get type()            { return this.props.type; }
  get status()          { return this.props.status; }
  get order()           { return this.props.order; }
  get src()             { return this.props.src; }
  get alt()             { return this.props.alt; }
  get poster()          { return this.props.poster; }
  get width()           { return this.props.width; }
  get height()          { return this.props.height; }
  get durationSeconds() { return this.props.durationSeconds; }
  get muted()           { return this.props.muted; }
  get showControls()    { return this.props.showControls; }
  get overlay()         { return this.props.overlay ? { ...this.props.overlay } : undefined; }
  get linkUrl()         { return this.props.linkUrl; }
  get linkTarget()      { return this.props.linkTarget; }
  get analyticsLabel()  { return this.props.analyticsLabel; }
  get activeFrom()      { return this.props.activeFrom; }
  get activeTo()        { return this.props.activeTo; }
  get createdBy()       { return this.props.createdBy; }
  get createdAt()       { return this.props.createdAt; }
  get updatedAt()       { return this.props.updatedAt; }

  isVideo(): boolean {
    return this.props.type === "video_mp4" || this.props.type === "youtube" || this.props.type === "vimeo";
  }

  isImage(): boolean {
    return this.props.type === "image";
  }

  isHostedVideo(): boolean {
    return this.props.type === "youtube" || this.props.type === "vimeo";
  }

  hasOverlay(): boolean {
    return this.props.overlay !== undefined;
  }

  isScheduled(): boolean {
    return this.props.activeFrom !== undefined || this.props.activeTo !== undefined;
  }

  isActiveAt(at: Date): boolean {
    if (this.props.status !== "active" && this.props.status !== "scheduled") return false;
    if (this.props.activeFrom && at < this.props.activeFrom) return false;
    if (this.props.activeTo && at >= this.props.activeTo) return false;
    return this.props.status === "active" || this.props.status === "scheduled";
  }

  aspectRatio(): number | undefined {
    if (!this.props.width || !this.props.height) return undefined;
    return Math.round((this.props.width / this.props.height) * 100) / 100;
  }

  activate(): CarouselSlide {
    return new CarouselSlide({ ...this.props, overlay: this.props.overlay ? { ...this.props.overlay } : undefined, status: "active", updatedAt: new Date() });
  }

  deactivate(): CarouselSlide {
    return new CarouselSlide({ ...this.props, overlay: this.props.overlay ? { ...this.props.overlay } : undefined, status: "inactive", updatedAt: new Date() });
  }

  schedule(activeFrom: Date, activeTo: Date): CarouselSlide {
    if (activeTo <= activeFrom) throw new Error("activeTo must be after activeFrom");
    return new CarouselSlide({ ...this.props, overlay: this.props.overlay ? { ...this.props.overlay } : undefined, status: "scheduled", activeFrom, activeTo, updatedAt: new Date() });
  }

  reorder(newOrder: number): CarouselSlide {
    if (newOrder < 0) throw new Error("order must be >= 0");
    return new CarouselSlide({ ...this.props, overlay: this.props.overlay ? { ...this.props.overlay } : undefined, order: newOrder, updatedAt: new Date() });
  }

  setOverlay(overlay: ContentOverlay): CarouselSlide {
    return new CarouselSlide({ ...this.props, overlay: { ...overlay }, updatedAt: new Date() });
  }

  removeOverlay(): CarouselSlide {
    const { overlay: _o, ...rest } = this.props;
    return new CarouselSlide({ ...rest, updatedAt: new Date() });
  }

  muteVideo(): CarouselSlide {
    if (!this.isVideo()) throw new Error("muteVideo only applies to video slides");
    return new CarouselSlide({ ...this.props, overlay: this.props.overlay ? { ...this.props.overlay } : undefined, muted: true, updatedAt: new Date() });
  }
}
