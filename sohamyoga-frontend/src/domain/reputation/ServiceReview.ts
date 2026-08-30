export type ServiceReviewStatus = 'pending' | 'published' | 'hidden';

export interface ServiceReviewProps {
  id: string;
  bookingId: string;
  reviewerName: string;
  reviewerEmail: string;
  starRating: number;
  comment: string;
  status: ServiceReviewStatus;
  staffResponse?: string;
  respondedAt?: Date;
  createdAt: Date;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export class ServiceReview {
  private readonly props: ServiceReviewProps;

  constructor(props: ServiceReviewProps) {
    if (!props.reviewerName.trim()) throw new Error('reviewerName is required');
    if (!EMAIL_RE.test(props.reviewerEmail)) throw new Error('reviewerEmail must be a valid email address');
    if (!Number.isInteger(props.starRating) || props.starRating < 1 || props.starRating > 5) {
      throw new Error('starRating must be an integer between 1 and 5');
    }
    this.props = { ...props };
  }

  get id() { return this.props.id; }
  get bookingId() { return this.props.bookingId; }
  get status() { return this.props.status; }
  get starRating() { return this.props.starRating; }

  publish(): ServiceReview {
    if (this.props.status === 'published') throw new Error('Review is already published.');
    return new ServiceReview({ ...this.props, status: 'published' });
  }

  hide(): ServiceReview {
    return new ServiceReview({ ...this.props, status: 'hidden' });
  }

  respond(staffResponse: string): ServiceReview {
    if (!staffResponse.trim()) throw new Error('staffResponse cannot be empty');
    return new ServiceReview({ ...this.props, staffResponse, respondedAt: new Date() });
  }

  toJSON(): ServiceReviewProps {
    return { ...this.props };
  }
}
