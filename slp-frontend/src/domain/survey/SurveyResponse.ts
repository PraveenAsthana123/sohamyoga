import type { QuestionType } from "./Question";

export type ResponseStatus = "in_progress" | "submitted" | "partial";

export interface Answer {
  questionId: string;
  type: QuestionType;
  value: string | string[] | number | null;
  fileUrl?: string;
}

export interface SurveyResponseProps {
  id: string;
  surveyId: string;
  respondentId?: string;
  respondentEmail?: string;
  status: ResponseStatus;
  answers: Answer[];
  startedAt: Date;
  submittedAt?: Date;
  completionPercent: number;
  ipAddress?: string;
  userAgent?: string;
  referrer?: string;
  timeSpentSeconds?: number;
}

export class SurveyResponse {
  private readonly props: Readonly<SurveyResponseProps>;

  constructor(props: SurveyResponseProps) {
    if (!props.id?.trim())       throw new Error("id is required");
    if (!props.surveyId?.trim()) throw new Error("surveyId is required");
    if (props.completionPercent < 0 || props.completionPercent > 100) {
      throw new Error("completionPercent must be 0–100");
    }
    if (props.timeSpentSeconds !== undefined && props.timeSpentSeconds < 0) {
      throw new Error("timeSpentSeconds must be >= 0");
    }
    if (props.status === "submitted" && !props.submittedAt) {
      throw new Error("submittedAt is required when status is submitted");
    }
    this.props = { ...props, answers: [...props.answers] };
  }

  get id()                { return this.props.id; }
  get surveyId()          { return this.props.surveyId; }
  get respondentId()      { return this.props.respondentId; }
  get respondentEmail()   { return this.props.respondentEmail; }
  get status()            { return this.props.status; }
  get answers()           { return [...this.props.answers]; }
  get startedAt()         { return this.props.startedAt; }
  get submittedAt()       { return this.props.submittedAt; }
  get completionPercent() { return this.props.completionPercent; }
  get ipAddress()         { return this.props.ipAddress; }
  get userAgent()         { return this.props.userAgent; }
  get referrer()          { return this.props.referrer; }
  get timeSpentSeconds()  { return this.props.timeSpentSeconds; }

  isAnonymous(): boolean {
    return !this.props.respondentId && !this.props.respondentEmail;
  }

  isComplete(): boolean {
    return this.props.status === "submitted" && this.props.completionPercent === 100;
  }

  getAnswer(questionId: string): Answer | undefined {
    return this.props.answers.find(a => a.questionId === questionId);
  }

  hasAnswered(questionId: string): boolean {
    const answer = this.getAnswer(questionId);
    if (!answer) return false;
    if (answer.value === null || answer.value === "") return false;
    if (Array.isArray(answer.value) && answer.value.length === 0) return false;
    return true;
  }

  addAnswer(answer: Answer): SurveyResponse {
    if (!answer.questionId?.trim()) throw new Error("answer.questionId is required");
    if (this.props.status === "submitted") throw new Error("Cannot modify a submitted response");
    const existing = this.props.answers.findIndex(a => a.questionId === answer.questionId);
    const updated = [...this.props.answers];
    if (existing >= 0) {
      updated[existing] = answer;
    } else {
      updated.push(answer);
    }
    return new SurveyResponse({
      ...this.props,
      answers: updated,
    });
  }

  updateCompletion(percent: number): SurveyResponse {
    if (percent < 0 || percent > 100) throw new Error("completionPercent must be 0–100");
    if (this.props.status === "submitted") throw new Error("Cannot update completion of submitted response");
    return new SurveyResponse({
      ...this.props,
      answers: [...this.props.answers],
      completionPercent: percent,
      status: percent === 100 ? "in_progress" : "partial",
    });
  }

  submit(at: Date = new Date()): SurveyResponse {
    if (this.props.status === "submitted") throw new Error("Response is already submitted");
    return new SurveyResponse({
      ...this.props,
      answers: [...this.props.answers],
      status: "submitted",
      submittedAt: at,
      completionPercent: 100,
    });
  }

  durationSeconds(at: Date = new Date()): number {
    if (this.props.timeSpentSeconds !== undefined) return this.props.timeSpentSeconds;
    const end = this.props.submittedAt ?? at;
    return Math.round((end.getTime() - this.props.startedAt.getTime()) / 1000);
  }
}
