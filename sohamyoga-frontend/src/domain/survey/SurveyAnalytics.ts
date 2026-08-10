import type { QuestionType } from "./Question";

export interface QuestionSummary {
  questionId: string;
  questionText: string;
  type: QuestionType;
  totalAnswers: number;
  skippedCount: number;
  optionCounts?: Record<string, number>;
  averageRating?: number;
  npsScore?: number;
  promoters?: number;
  passives?: number;
  detractors?: number;
  textSample?: string[];
}

export interface SurveyAnalyticsProps {
  id: string;
  surveyId: string;
  totalResponses: number;
  completedResponses: number;
  partialResponses: number;
  completionRate: number;
  averageTimeSeconds: number;
  npsScore?: number;
  questionSummaries: QuestionSummary[];
  calculatedAt: Date;
}

export class SurveyAnalytics {
  private readonly props: Readonly<SurveyAnalyticsProps>;

  constructor(props: SurveyAnalyticsProps) {
    if (!props.id?.trim())       throw new Error("id is required");
    if (!props.surveyId?.trim()) throw new Error("surveyId is required");
    if (props.totalResponses < 0)   throw new Error("totalResponses must be >= 0");
    if (props.completedResponses < 0) throw new Error("completedResponses must be >= 0");
    if (props.partialResponses < 0) throw new Error("partialResponses must be >= 0");
    if (props.completedResponses + props.partialResponses > props.totalResponses) {
      throw new Error("completedResponses + partialResponses cannot exceed totalResponses");
    }
    if (props.completionRate < 0 || props.completionRate > 100) {
      throw new Error("completionRate must be 0–100");
    }
    if (props.averageTimeSeconds < 0) throw new Error("averageTimeSeconds must be >= 0");
    if (props.npsScore !== undefined &&
       (props.npsScore < -100 || props.npsScore > 100)) {
      throw new Error("npsScore must be -100 to 100");
    }
    this.props = {
      ...props,
      questionSummaries: props.questionSummaries.map(q => ({ ...q })),
    };
  }

  get id()                  { return this.props.id; }
  get surveyId()            { return this.props.surveyId; }
  get totalResponses()      { return this.props.totalResponses; }
  get completedResponses()  { return this.props.completedResponses; }
  get partialResponses()    { return this.props.partialResponses; }
  get completionRate()      { return this.props.completionRate; }
  get averageTimeSeconds()  { return this.props.averageTimeSeconds; }
  get npsScore()            { return this.props.npsScore; }
  get questionSummaries()   { return this.props.questionSummaries.map(q => ({ ...q })); }
  get calculatedAt()        { return this.props.calculatedAt; }

  npsCategory(): "excellent" | "good" | "needs_improvement" | "critical" | "no_data" {
    if (this.props.npsScore === undefined) return "no_data";
    if (this.props.npsScore >= 70) return "excellent";
    if (this.props.npsScore >= 30) return "good";
    if (this.props.npsScore >= 0)  return "needs_improvement";
    return "critical";
  }

  dropOffRate(): number {
    if (this.props.totalResponses === 0) return 0;
    return Math.round(
      ((this.props.totalResponses - this.props.completedResponses) / this.props.totalResponses) * 100 * 100
    ) / 100;
  }

  getSummary(questionId: string): QuestionSummary | undefined {
    return this.props.questionSummaries.find(q => q.questionId === questionId);
  }

  topOptions(questionId: string, limit = 5): Array<{ option: string; count: number }> {
    const summary = this.getSummary(questionId);
    if (!summary?.optionCounts) return [];
    return Object.entries(summary.optionCounts)
      .map(([option, count]) => ({ option, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }

  averageMinutes(): number {
    return Math.round((this.props.averageTimeSeconds / 60) * 10) / 10;
  }

  withUpdatedSummary(summary: QuestionSummary): SurveyAnalytics {
    const existing = this.props.questionSummaries.findIndex(q => q.questionId === summary.questionId);
    const updated = this.props.questionSummaries.map(q => ({ ...q }));
    if (existing >= 0) {
      updated[existing] = { ...summary };
    } else {
      updated.push({ ...summary });
    }
    return new SurveyAnalytics({
      ...this.props,
      questionSummaries: updated,
      calculatedAt: new Date(),
    });
  }

  refresh(
    totalResponses: number,
    completedResponses: number,
    partialResponses: number,
    averageTimeSeconds: number,
  ): SurveyAnalytics {
    const completionRate = totalResponses > 0
      ? Math.round((completedResponses / totalResponses) * 100 * 100) / 100
      : 0;
    return new SurveyAnalytics({
      ...this.props,
      questionSummaries: this.props.questionSummaries.map(q => ({ ...q })),
      totalResponses,
      completedResponses,
      partialResponses,
      completionRate,
      averageTimeSeconds,
      calculatedAt: new Date(),
    });
  }
}
