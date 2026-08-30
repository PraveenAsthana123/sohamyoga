export interface CompetitorPricePointProps {
  id: string;
  competitorId: string;
  serviceName: string;
  price: number;
  currency: string;
  effectiveDate: Date;
  notes: string;
  createdBy: string;
  createdAt: Date;
}

export class CompetitorPricePoint {
  private readonly props: CompetitorPricePointProps;

  constructor(props: CompetitorPricePointProps) {
    if (!props.serviceName.trim()) throw new Error('serviceName is required');
    if (props.price < 0) throw new Error('price cannot be negative');
    if (!/^[A-Z]{3}$/.test(props.currency)) throw new Error('currency must be a 3-letter ISO code');
    this.props = { ...props };
  }

  get id() { return this.props.id; }
  get competitorId() { return this.props.competitorId; }
  get serviceName() { return this.props.serviceName; }
  get price() { return this.props.price; }
  get currency() { return this.props.currency; }
  get effectiveDate() { return this.props.effectiveDate; }

  toJSON(): CompetitorPricePointProps {
    return { ...this.props };
  }
}
