// Teacher performance metrics — aggregated per period from PostHog + Metabase + LimeSurvey

export type PerformancePeriod = "monthly" | "quarterly" | "yearly";
export type NpsCategory = "promoter" | "passive" | "detractor" | "no_data";

export interface TeacherPerformanceProps {
  id: string;
  teacherId: string;
  teacherName: string;
  period: PerformancePeriod;
  periodStart: Date;
  periodEnd: Date;

  // Class metrics
  totalScheduledClasses: number;
  totalCancelledClasses: number;
  totalCompletedClasses: number;

  // Student metrics
  totalStudentAttendees: number;     // sum across all completed classes
  uniqueStudents: number;
  newStudents: number;
  returningStudents: number;
  droppedStudents: number;           // attended last period but not this one

  // Rating metrics (LimeSurvey / Formbricks)
  avgStudentRating: number;          // 0–5
  totalRatings: number;
  npsScore: number | null;           // –100 to +100; null = no data

  // Revenue (ERPNext)
  totalRevenue: number;
  currency: string;

  createdAt: Date;
}

export class TeacherPerformance {
  constructor(private props: TeacherPerformanceProps) {
    if (!props.teacherId.trim()) throw new Error("Teacher ID required");
    if (props.periodEnd <= props.periodStart) throw new Error("Period end must be after start");
    if (props.totalScheduledClasses < 0) throw new Error("Scheduled classes cannot be negative");
    if (props.totalCancelledClasses > props.totalScheduledClasses) throw new Error("Cancelled cannot exceed scheduled");
    if (props.avgStudentRating < 0 || props.avgStudentRating > 5) throw new Error("Rating must be 0–5");
    if (props.npsScore !== null && (props.npsScore < -100 || props.npsScore > 100)) throw new Error("NPS must be –100 to +100");
    if (props.totalRevenue < 0) throw new Error("Revenue cannot be negative");
  }

  get id()                    { return this.props.id; }
  get teacherId()              { return this.props.teacherId; }
  get teacherName()            { return this.props.teacherName; }
  get period()                 { return this.props.period; }
  get periodStart()            { return this.props.periodStart; }
  get periodEnd()              { return this.props.periodEnd; }
  get totalScheduledClasses()  { return this.props.totalScheduledClasses; }
  get totalCancelledClasses()  { return this.props.totalCancelledClasses; }
  get totalCompletedClasses()  { return this.props.totalCompletedClasses; }
  get totalStudentAttendees()  { return this.props.totalStudentAttendees; }
  get uniqueStudents()         { return this.props.uniqueStudents; }
  get avgStudentRating()       { return this.props.avgStudentRating; }
  get totalRatings()           { return this.props.totalRatings; }
  get npsScore()               { return this.props.npsScore; }
  get totalRevenue()           { return this.props.totalRevenue; }
  get currency()               { return this.props.currency; }

  cancellationRate(): number {
    if (this.props.totalScheduledClasses === 0) return 0;
    return Math.round((this.props.totalCancelledClasses / this.props.totalScheduledClasses) * 100);
  }

  completionRate(): number {
    if (this.props.totalScheduledClasses === 0) return 0;
    return Math.round((this.props.totalCompletedClasses / this.props.totalScheduledClasses) * 100);
  }

  avgAttendeesPerClass(): number {
    if (this.props.totalCompletedClasses === 0) return 0;
    return Math.round(this.props.totalStudentAttendees / this.props.totalCompletedClasses);
  }

  retentionRate(): number {
    const denominator = this.props.returningStudents + this.props.droppedStudents;
    if (denominator === 0) return 0;
    return Math.round((this.props.returningStudents / denominator) * 100);
  }

  npsCategory(): NpsCategory {
    if (this.props.npsScore === null) return "no_data";
    if (this.props.npsScore >= 50) return "promoter";
    if (this.props.npsScore >= 0) return "passive";
    return "detractor";
  }

  isHighPerformer(): boolean {
    return this.props.avgStudentRating >= 4.5 && this.completionRate() >= 90;
  }

  revenuePerClass(): number {
    if (this.props.totalCompletedClasses === 0) return 0;
    return Math.round(this.props.totalRevenue / this.props.totalCompletedClasses);
  }

  toJSON(): TeacherPerformanceProps { return { ...this.props }; }
}
