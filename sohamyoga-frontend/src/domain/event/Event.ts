export type EventType = 'event' | 'webinar' | 'workshop' | 'seminar';
export type EventFormat = 'in_person' | 'online' | 'hybrid';
export type EventStatus = 'draft' | 'published' | 'cancelled' | 'completed';

export interface EventProps {
  id: string;
  slug: string;
  title: string;
  description: string;
  type: EventType;
  format: EventFormat;
  location?: string;
  joinUrl?: string;
  startsAt: Date;
  endsAt: Date;
  capacity?: number;
  status: EventStatus;
  registrationCount: number;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export class Event {
  private readonly props: EventProps;

  constructor(props: EventProps) {
    if (!props.title.trim()) throw new Error('title is required');
    if (!/^[a-z0-9-]+$/.test(props.slug)) throw new Error('slug must be lowercase letters, numbers, and hyphens');
    if (props.endsAt <= props.startsAt) throw new Error('endsAt must be after startsAt');
    if (props.format !== 'in_person' && !props.joinUrl) throw new Error('joinUrl is required for online/hybrid events');
    if (props.format !== 'online' && !props.location) throw new Error('location is required for in_person/hybrid events');
    if (props.capacity !== undefined && props.capacity <= 0) throw new Error('capacity must be positive');
    this.props = { ...props };
  }

  get id() { return this.props.id; }
  get slug() { return this.props.slug; }
  get title() { return this.props.title; }
  get status() { return this.props.status; }
  get capacity() { return this.props.capacity; }
  get registrationCount() { return this.props.registrationCount; }
  get startsAt() { return this.props.startsAt; }

  get isFull(): boolean {
    return this.props.capacity !== undefined && this.props.registrationCount >= this.props.capacity;
  }

  get acceptsRegistrations(): boolean {
    return this.props.status === 'published' && !this.isFull;
  }

  publish(): Event {
    if (this.props.status !== 'draft') throw new Error('Only a draft event can be published.');
    return new Event({ ...this.props, status: 'published', updatedAt: new Date() });
  }

  cancel(): Event {
    if (this.props.status === 'completed') throw new Error('Cannot cancel a completed event.');
    return new Event({ ...this.props, status: 'cancelled', updatedAt: new Date() });
  }

  complete(): Event {
    if (this.props.status !== 'published') throw new Error('Only a published event can be marked completed.');
    return new Event({ ...this.props, status: 'completed', updatedAt: new Date() });
  }

  recordRegistration(): Event {
    if (!this.acceptsRegistrations) throw new Error('This event is not accepting registrations.');
    return new Event({ ...this.props, registrationCount: this.props.registrationCount + 1, updatedAt: new Date() });
  }

  toJSON(): EventProps {
    return { ...this.props };
  }
}
