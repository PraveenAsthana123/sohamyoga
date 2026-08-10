// Health & Wellness profile — custom yoga-specific, HIPAA-adjacent (local only)

export type HealthCondition =
  | "back_pain" | "neck_pain" | "knee_injury" | "shoulder_injury"
  | "hypertension" | "diabetes" | "asthma" | "anxiety" | "depression"
  | "pregnancy" | "postpartum" | "osteoporosis" | "arthritis"
  | "vertigo" | "heart_condition" | "none";

export type FitnessLevel = "sedentary" | "lightly_active" | "moderately_active" | "very_active" | "athlete";
export type YogaGoal = "stress_relief" | "flexibility" | "strength" | "weight_loss" | "sleep" | "back_pain_relief" | "mental_clarity" | "spiritual_growth" | "injury_recovery" | "general_wellness";
export type PracticeFrequency = "daily" | "4_5_per_week" | "2_3_per_week" | "once_per_week" | "occasional";

export interface WellnessProfileProps {
  userId: string;

  // Physical
  heightCm?: number;
  weightKg?: number;
  ageYears?: number;
  fitnessLevel: FitnessLevel;

  // Health
  conditions: HealthCondition[];
  injuries: string[];           // free text
  medications: string[];        // free text (optional)
  doctorApproved: boolean;
  pregnancyMode: boolean;
  pregnancyWeek?: number;

  // Yoga goals
  primaryGoals: YogaGoal[];
  practiceFrequency: PracticeFrequency;
  prefersMorning: boolean;
  yogaExperienceYears: number;

  // Wellness tracking (latest readings)
  sleepHoursAvg?: number;
  stressLevelAvg?: number;      // 1–5
  moodAvg?: number;             // 1–5

  // Ayurveda
  primaryDosha?: "vata" | "pitta" | "kapha";

  // Privacy
  shareWithTeacher: boolean;
  shareWithAdmin: boolean;

  updatedAt: Date;
}

export class WellnessProfile {
  constructor(private props: WellnessProfileProps) {
    if (props.heightCm !== undefined && props.heightCm <= 0)
      throw new Error("Height must be positive");
    if (props.weightKg !== undefined && props.weightKg <= 0)
      throw new Error("Weight must be positive");
    if (props.yogaExperienceYears < 0)
      throw new Error("Experience years cannot be negative");
  }

  get userId()             { return this.props.userId; }
  get conditions()         { return [...this.props.conditions]; }
  get injuries()           { return [...this.props.injuries]; }
  get fitnessLevel()       { return this.props.fitnessLevel; }
  get primaryGoals()       { return [...this.props.primaryGoals]; }
  get practiceFrequency()  { return this.props.practiceFrequency; }
  get doctorApproved()     { return this.props.doctorApproved; }
  get pregnancyMode()      { return this.props.pregnancyMode; }
  get primaryDosha()       { return this.props.primaryDosha; }
  get shareWithTeacher()      { return this.props.shareWithTeacher; }
  get yogaExperienceYears()   { return this.props.yogaExperienceYears; }

  bmi(): number | null {
    if (!this.props.heightCm || !this.props.weightKg) return null;
    const hM = this.props.heightCm / 100;
    return Math.round((this.props.weightKg / (hM * hM)) * 10) / 10;
  }

  bmiCategory(): string {
    const b = this.bmi();
    if (b === null) return "unknown";
    if (b < 18.5) return "underweight";
    if (b < 25)   return "normal";
    if (b < 30)   return "overweight";
    return "obese";
  }

  hasCondition(c: HealthCondition): boolean { return this.props.conditions.includes(c); }
  isHighRisk(): boolean {
    return ["hypertension", "heart_condition", "pregnancy", "osteoporosis"].some(c =>
      this.hasCondition(c as HealthCondition)
    );
  }

  requiresDoctorApproval(): boolean {
    return this.isHighRisk() && !this.props.doctorApproved;
  }

  suitableGoalLabel(): string {
    if (this.props.primaryGoals.length === 0) return "General wellness";
    return this.props.primaryGoals[0].replace(/_/g, " ");
  }

  update(patch: Partial<Omit<WellnessProfileProps, "userId">>): WellnessProfile {
    return new WellnessProfile({ ...this.props, ...patch, updatedAt: new Date() });
  }

  toJSON(): WellnessProfileProps {
    return {
      ...this.props,
      conditions: [...this.props.conditions],
      injuries: [...this.props.injuries],
      medications: [...this.props.medications],
      primaryGoals: [...this.props.primaryGoals],
    };
  }
}
