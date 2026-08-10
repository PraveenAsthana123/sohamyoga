export interface WaitlistEntryProps {
  id: string;
  scheduleId: string;
  classId: string;
  studentId: string;
  position: number;
  addedAt: Date;
  notifiedAt?: Date;
  expired: boolean;
}

export class WaitlistEntry {
  constructor(private props: WaitlistEntryProps) {
    if (props.position < 1) throw new Error("Position must be >= 1");
  }

  get id()          { return this.props.id; }
  get scheduleId()  { return this.props.scheduleId; }
  get classId()     { return this.props.classId; }
  get studentId()   { return this.props.studentId; }
  get position()    { return this.props.position; }
  get addedAt()     { return this.props.addedAt; }
  get notifiedAt()  { return this.props.notifiedAt; }
  get expired()     { return this.props.expired; }

  notify(): WaitlistEntry {
    return new WaitlistEntry({ ...this.props, notifiedAt: new Date() });
  }

  expire(): WaitlistEntry {
    return new WaitlistEntry({ ...this.props, expired: true });
  }

  promote(newPosition: number): WaitlistEntry {
    return new WaitlistEntry({ ...this.props, position: newPosition });
  }

  toJSON(): WaitlistEntryProps { return { ...this.props }; }
}

export class WaitlistPromotedEvent {
  readonly type = "WaitlistPromoted" as const;
  constructor(public readonly studentId: string, public readonly scheduleId: string, public readonly position: number) {}
}
