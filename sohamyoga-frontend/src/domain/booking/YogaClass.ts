export type YogaStyle = "Hatha" | "Vinyasa" | "Yin" | "Ashtanga" | "Kundalini" | "Restorative" | "Power";
export type YogaLevel = "Beginner" | "Intermediate" | "Advanced" | "All Levels";

export interface YogaClassProps {
  id: string;
  title: string;
  teacherId: string;
  style: YogaStyle;
  level: YogaLevel;
  description: string;
  durationMinutes: number;
  capacity: number;
  priceCAD: number;
  isOnline: boolean;
  locationOrUrl: string;
  tags: string[];
  isActive: boolean;
  createdAt: Date;
}

export class YogaClass {
  constructor(private readonly props: YogaClassProps) {
    if (props.capacity < 1) throw new Error("Capacity must be at least 1");
    if (props.priceCAD < 0) throw new Error("Price cannot be negative");
    if (props.durationMinutes < 15 || props.durationMinutes > 240)
      throw new Error("Duration must be between 15 and 240 minutes");
    if (!props.title.trim()) throw new Error("Title is required");
  }

  get id()              { return this.props.id; }
  get title()           { return this.props.title; }
  get teacherId()       { return this.props.teacherId; }
  get style()           { return this.props.style; }
  get level()           { return this.props.level; }
  get description()     { return this.props.description; }
  get durationMinutes() { return this.props.durationMinutes; }
  get capacity()        { return this.props.capacity; }
  get priceCAD()        { return this.props.priceCAD; }
  get isOnline()        { return this.props.isOnline; }
  get locationOrUrl()   { return this.props.locationOrUrl; }
  get tags()            { return [...this.props.tags]; }
  get isActive()        { return this.props.isActive; }
  get createdAt()       { return this.props.createdAt; }

  isFree(): boolean { return this.props.priceCAD === 0; }

  deactivate(): YogaClass {
    return new YogaClass({ ...this.props, isActive: false });
  }

  updateCapacity(newCapacity: number): YogaClass {
    if (newCapacity < 1) throw new Error("Capacity must be at least 1");
    return new YogaClass({ ...this.props, capacity: newCapacity });
  }

  toJSON(): YogaClassProps { return { ...this.props, tags: [...this.props.tags] }; }
}
