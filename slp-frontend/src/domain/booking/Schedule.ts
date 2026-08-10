export type RecurrenceRule = "none" | "daily" | "weekly" | "bi-weekly";

export interface ScheduleProps {
  id: string;
  classId: string;
  startTime: Date;
  endTime: Date;
  recurrence: RecurrenceRule;
  timezone: string;
  isCancelled: boolean;
  cancelReason?: string;
}

export class Schedule {
  constructor(private readonly props: ScheduleProps) {
    if (props.endTime <= props.startTime)
      throw new Error("End time must be after start time");
    if (!props.timezone.trim())
      throw new Error("Timezone is required");
  }

  get id()          { return this.props.id; }
  get classId()     { return this.props.classId; }
  get startTime()   { return this.props.startTime; }
  get endTime()     { return this.props.endTime; }
  get recurrence()  { return this.props.recurrence; }
  get timezone()    { return this.props.timezone; }
  get isCancelled() { return this.props.isCancelled; }
  get cancelReason(){ return this.props.cancelReason; }

  durationMinutes(): number {
    return Math.round((this.props.endTime.getTime() - this.props.startTime.getTime()) / 60000);
  }

  isUpcoming(): boolean { return this.props.startTime > new Date(); }

  isWithinCancellationWindow(hoursNotice = 2): boolean {
    const cutoff = new Date(this.props.startTime.getTime() - hoursNotice * 3600 * 1000);
    return new Date() < cutoff;
  }

  cancel(reason: string): Schedule {
    if (!this.isWithinCancellationWindow(0))
      throw new Error("Cannot cancel a class that has already started");
    return new Schedule({ ...this.props, isCancelled: true, cancelReason: reason });
  }

  toJSON(): ScheduleProps { return { ...this.props }; }
}
