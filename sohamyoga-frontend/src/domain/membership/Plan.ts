export type BillingInterval = "free" | "monthly" | "annual";
export type PlanFeature =
  | "unlimited_classes"
  | "ai_pose_coach"
  | "ai_flow_generator"
  | "one_on_one_sessions"
  | "whatsapp_reminders"
  | "offline_downloads"
  | "community_access"
  | "priority_booking"
  | "teacher_feedback"
  | "custom_ai_routines"
  | "progress_dashboard";

export interface PlanProps {
  id: string;
  name: string;
  priceCAD: number;
  interval: BillingInterval;
  classesPerMonth: number | "unlimited";
  features: PlanFeature[];
  trialDays: number;
  isActive: boolean;
}

export class Plan {
  constructor(private readonly props: PlanProps) {
    if (props.priceCAD < 0) throw new Error("Price cannot be negative");
    if (props.trialDays < 0) throw new Error("Trial days cannot be negative");
  }

  get id()               { return this.props.id; }
  get name()             { return this.props.name; }
  get priceCAD()         { return this.props.priceCAD; }
  get interval()         { return this.props.interval; }
  get classesPerMonth()  { return this.props.classesPerMonth; }
  get features()         { return [...this.props.features]; }
  get trialDays()        { return this.props.trialDays; }
  get isActive()         { return this.props.isActive; }

  isFree(): boolean { return this.props.interval === "free" || this.props.priceCAD === 0; }
  hasFeature(f: PlanFeature): boolean { return this.props.features.includes(f); }
  hasUnlimitedClasses(): boolean { return this.props.classesPerMonth === "unlimited"; }

  annualSavingsVsMonthly(monthlyPlan: Plan): number {
    if (this.props.interval !== "annual") return 0;
    return monthlyPlan.priceCAD * 12 - this.props.priceCAD;
  }

  toJSON(): PlanProps { return { ...this.props, features: [...this.props.features] }; }
}

// Seed plans used in tests and UI
export const SEED_PLANS: PlanProps[] = [
  {
    id: "plan_free",
    name: "Free",
    priceCAD: 0,
    interval: "free",
    classesPerMonth: 2,
    features: ["community_access", "progress_dashboard"],
    trialDays: 0,
    isActive: true,
  },
  {
    id: "plan_monthly",
    name: "Monthly",
    priceCAD: 49,
    interval: "monthly",
    classesPerMonth: "unlimited",
    features: [
      "unlimited_classes", "ai_pose_coach", "ai_flow_generator",
      "whatsapp_reminders", "teacher_feedback", "community_access",
      "progress_dashboard",
    ],
    trialDays: 7,
    isActive: true,
  },
  {
    id: "plan_annual",
    name: "Annual",
    priceCAD: 399,
    interval: "annual",
    classesPerMonth: "unlimited",
    features: [
      "unlimited_classes", "ai_pose_coach", "ai_flow_generator",
      "one_on_one_sessions", "whatsapp_reminders", "offline_downloads",
      "community_access", "priority_booking", "teacher_feedback",
      "custom_ai_routines", "progress_dashboard",
    ],
    trialDays: 7,
    isActive: true,
  },
];
