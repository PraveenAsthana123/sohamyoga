export type SurveyStatus     = "draft" | "active" | "paused" | "closed" | "archived";
export type SurveyVisibility = "public" | "authenticated" | "invite_only" | "anonymous";
export type SurveyType       =
  | "survey" | "questionnaire" | "form" | "quiz"
  | "assessment" | "poll" | "nps" | "feedback";

export interface SurveySettings {
  allowAnonymous: boolean;
  requireLogin: boolean;
  allowMultipleResponses: boolean;
  showProgressBar: boolean;
  randomizeQuestions: boolean;
  saveAndResume: boolean;
  responseLimit?: number;
  startDate?: Date;
  endDate?: Date;
  confirmationMessage?: string;
  redirectUrl?: string;
  language: string;
}

export interface SurveyProps {
  id: string;
  title: string;
  slug: string;
  description?: string;
  type: SurveyType;
  status: SurveyStatus;
  visibility: SurveyVisibility;
  questionIds: string[];
  settings: SurveySettings;
  responseCount: number;
  completionCount: number;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  publishedAt?: Date;
  closedAt?: Date;
}

const TERMINAL: SurveyStatus[] = ["archived"];

export class Survey {
  private readonly props: Readonly<SurveyProps>;

  constructor(props: SurveyProps) {
    if (!props.id?.trim())       throw new Error("id is required");
    if (!props.title?.trim())    throw new Error("title is required");
    if (!props.slug?.trim())     throw new Error("slug is required");
    if (!/^[a-z0-9-]+$/.test(props.slug)) throw new Error("slug must be lowercase kebab-case");
    if (!props.createdBy?.trim()) throw new Error("createdBy is required");
    if (props.responseCount < 0)  throw new Error("responseCount must be >= 0");
    if (props.completionCount < 0) throw new Error("completionCount must be >= 0");
    if (props.completionCount > props.responseCount) {
      throw new Error("completionCount cannot exceed responseCount");
    }
    if (props.settings.responseLimit !== undefined && props.settings.responseLimit < 1) {
      throw new Error("responseLimit must be >= 1");
    }
    if (props.settings.endDate && props.settings.startDate &&
        props.settings.endDate <= props.settings.startDate) {
      throw new Error("settings.endDate must be after startDate");
    }
    this.props = {
      ...props,
      questionIds: [...props.questionIds],
      settings: { ...props.settings },
    };
  }

  get id()              { return this.props.id; }
  get title()           { return this.props.title; }
  get slug()            { return this.props.slug; }
  get description()     { return this.props.description; }
  get type()            { return this.props.type; }
  get status()          { return this.props.status; }
  get visibility()      { return this.props.visibility; }
  get questionIds()     { return [...this.props.questionIds]; }
  get settings()        { return { ...this.props.settings }; }
  get responseCount()   { return this.props.responseCount; }
  get completionCount() { return this.props.completionCount; }
  get createdBy()       { return this.props.createdBy; }
  get createdAt()       { return this.props.createdAt; }
  get updatedAt()       { return this.props.updatedAt; }
  get publishedAt()     { return this.props.publishedAt; }
  get closedAt()        { return this.props.closedAt; }

  completionRate(): number {
    if (this.props.responseCount === 0) return 0;
    return Math.round((this.props.completionCount / this.props.responseCount) * 100 * 100) / 100;
  }

  isActive(at: Date = new Date()): boolean {
    if (this.props.status !== "active") return false;
    const { startDate, endDate, responseLimit } = this.props.settings;
    if (startDate && at < startDate) return false;
    if (endDate && at >= endDate) return false;
    if (responseLimit !== undefined && this.props.responseCount >= responseLimit) return false;
    return true;
  }

  isExpired(at: Date = new Date()): boolean {
    const { endDate } = this.props.settings;
    return endDate !== undefined && at >= endDate;
  }

  hasQuestion(questionId: string): boolean {
    return this.props.questionIds.includes(questionId);
  }

  publish(at: Date = new Date()): Survey {
    if (this.props.status === "archived") throw new Error("Archived surveys cannot be published");
    if (this.props.status === "active")   throw new Error("Survey is already active");
    if (this.props.questionIds.length === 0) throw new Error("Cannot publish a survey with no questions");
    return new Survey({
      ...this.props,
      questionIds: [...this.props.questionIds],
      settings: { ...this.props.settings },
      status: "active",
      publishedAt: at,
      updatedAt: new Date(),
    });
  }

  pause(): Survey {
    if (this.props.status !== "active") throw new Error("Only active surveys can be paused");
    return new Survey({
      ...this.props,
      questionIds: [...this.props.questionIds],
      settings: { ...this.props.settings },
      status: "paused",
      updatedAt: new Date(),
    });
  }

  resume(): Survey {
    if (this.props.status !== "paused") throw new Error("Only paused surveys can be resumed");
    return new Survey({
      ...this.props,
      questionIds: [...this.props.questionIds],
      settings: { ...this.props.settings },
      status: "active",
      updatedAt: new Date(),
    });
  }

  close(at: Date = new Date()): Survey {
    if (this.props.status === "archived") throw new Error("Archived surveys cannot be closed");
    if (this.props.status === "closed")   throw new Error("Survey is already closed");
    return new Survey({
      ...this.props,
      questionIds: [...this.props.questionIds],
      settings: { ...this.props.settings },
      status: "closed",
      closedAt: at,
      updatedAt: new Date(),
    });
  }

  archive(): Survey {
    if (this.props.status === "archived") throw new Error("Survey is already archived");
    return new Survey({
      ...this.props,
      questionIds: [...this.props.questionIds],
      settings: { ...this.props.settings },
      status: "archived",
      updatedAt: new Date(),
    });
  }

  addQuestion(questionId: string): Survey {
    if (!questionId?.trim()) throw new Error("questionId is required");
    if (this.hasQuestion(questionId)) return this;
    return new Survey({
      ...this.props,
      questionIds: [...this.props.questionIds, questionId],
      settings: { ...this.props.settings },
      updatedAt: new Date(),
    });
  }

  removeQuestion(questionId: string): Survey {
    if (!this.hasQuestion(questionId)) return this;
    return new Survey({
      ...this.props,
      questionIds: this.props.questionIds.filter(id => id !== questionId),
      settings: { ...this.props.settings },
      updatedAt: new Date(),
    });
  }

  reorderQuestions(orderedIds: string[]): Survey {
    const current = new Set(this.props.questionIds);
    for (const id of orderedIds) {
      if (!current.has(id)) throw new Error(`Question not in survey: ${id}`);
    }
    if (orderedIds.length !== this.props.questionIds.length) {
      throw new Error("Reorder must include all existing question IDs");
    }
    return new Survey({
      ...this.props,
      questionIds: [...orderedIds],
      settings: { ...this.props.settings },
      updatedAt: new Date(),
    });
  }

  recordResponse(completed: boolean): Survey {
    return new Survey({
      ...this.props,
      questionIds: [...this.props.questionIds],
      settings: { ...this.props.settings },
      responseCount: this.props.responseCount + 1,
      completionCount: this.props.completionCount + (completed ? 1 : 0),
      updatedAt: new Date(),
    });
  }
}
