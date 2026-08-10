// Community poll feature — teachers/admins post polls, students vote

export type PollStatus = "DRAFT" | "ACTIVE" | "CLOSED";

export interface PollOption {
  id: string;
  text: string;
  votes: string[];  // voter userIds
}

export interface PollProps {
  id: string;
  createdById: string;
  question: string;
  options: PollOption[];
  status: PollStatus;
  allowMultipleVotes: boolean;
  showResultsBeforeClose: boolean;
  endsAt?: Date;
  createdAt: Date;
  targetSegment: "all" | "students" | "enrolled_in_class";
  targetClassId?: string;
}

export class Poll {
  constructor(private props: PollProps) {
    if (!props.question.trim()) throw new Error("Question is required");
    if (props.options.length < 2) throw new Error("Poll must have at least 2 options");
    if (new Set(props.options.map(o => o.text.trim())).size !== props.options.length)
      throw new Error("Poll options must be unique");
  }

  get id()                      { return this.props.id; }
  get question()                { return this.props.question; }
  get status()                  { return this.props.status; }
  get options()                 { return this.props.options.map(o => ({ ...o, votes: [...o.votes] })); }
  get endsAt()                  { return this.props.endsAt; }
  get showResultsBeforeClose()  { return this.props.showResultsBeforeClose; }
  get allowMultipleVotes()      { return this.props.allowMultipleVotes; }
  get createdAt()               { return this.props.createdAt; }

  isActive(): boolean { return this.props.status === "ACTIVE" && (!this.props.endsAt || this.props.endsAt > new Date()); }

  totalVotes(): number { return this.props.options.reduce((sum, o) => sum + o.votes.length, 0); }

  percentForOption(optionId: string): number {
    const total = this.totalVotes();
    if (total === 0) return 0;
    const option = this.props.options.find(o => o.id === optionId);
    return option ? Math.round((option.votes.length / total) * 100) : 0;
  }

  hasVoted(userId: string): boolean {
    return this.props.options.some(o => o.votes.includes(userId));
  }

  vote(userId: string, optionId: string): Poll {
    if (!this.isActive()) throw new Error("Poll is not active");
    if (!this.props.allowMultipleVotes && this.hasVoted(userId))
      throw new Error("User has already voted");

    const updatedOptions = this.props.options.map(o => {
      if (o.id !== optionId) return o;
      if (o.votes.includes(userId)) return o; // idempotent
      return { ...o, votes: [...o.votes, userId] };
    });
    return new Poll({ ...this.props, options: updatedOptions });
  }

  close(): Poll {
    return new Poll({ ...this.props, status: "CLOSED" });
  }

  activate(): Poll {
    if (this.props.status === "CLOSED") throw new Error("Cannot reactivate a closed poll");
    return new Poll({ ...this.props, status: "ACTIVE" });
  }

  getShareLink(baseUrl: string): string {
    return `${baseUrl}/community/poll/${this.props.id}`;
  }

  toJSON(): PollProps {
    return {
      ...this.props,
      options: this.props.options.map(o => ({ ...o, votes: [...o.votes] })),
    };
  }
}
