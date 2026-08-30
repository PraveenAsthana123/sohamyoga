export interface CompetitorProps {
  id: string;
  name: string;
  website?: string;
  notes: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export class Competitor {
  private readonly props: CompetitorProps;

  constructor(props: CompetitorProps) {
    if (!props.name.trim()) throw new Error('name is required');
    if (props.website) {
      try { new URL(props.website); } catch { throw new Error('website must be a valid absolute URL'); }
    }
    this.props = { ...props };
  }

  get id() { return this.props.id; }
  get name() { return this.props.name; }
  get website() { return this.props.website; }

  rename(name: string): Competitor {
    return new Competitor({ ...this.props, name, updatedAt: new Date() });
  }

  toJSON(): CompetitorProps {
    return { ...this.props };
  }
}
