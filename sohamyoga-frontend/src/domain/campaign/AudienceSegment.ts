export type SegmentCriteria = {
  field: "membership_plan" | "class_count" | "last_active_days" | "pose_score_avg" |
         "preferred_style" | "location" | "signup_days_ago" | "total_spend_cad" |
         "challenge_completed" | "has_referrals" | "birthday_month";
  operator: "eq" | "ne" | "gt" | "lt" | "gte" | "lte" | "in" | "not_in" | "contains";
  value: string | number | string[];
};

export type SegmentLogic = "AND" | "OR";

export interface AudienceSegmentProps {
  id: string;
  name: string;
  description: string;
  criteria: SegmentCriteria[];
  logic: SegmentLogic;
  estimatedSize: number;      // last computed count
  lastComputedAt?: Date;
  isDynamic: boolean;         // re-computed on use vs static snapshot
  createdById: string;
  createdAt: Date;
}

export class AudienceSegment {
  constructor(private props: AudienceSegmentProps) {
    if (!props.name.trim()) throw new Error("Segment name is required");
    if (props.criteria.length === 0) throw new Error("At least one criterion required");
  }

  get id()              { return this.props.id; }
  get name()            { return this.props.name; }
  get description()     { return this.props.description; }
  get criteria()        { return this.props.criteria.map(c => ({ ...c })); }
  get logic()           { return this.props.logic; }
  get estimatedSize()   { return this.props.estimatedSize; }
  get isDynamic()       { return this.props.isDynamic; }

  addCriterion(c: SegmentCriteria): AudienceSegment {
    return new AudienceSegment({ ...this.props, criteria: [...this.props.criteria, c] });
  }

  updateEstimate(size: number): AudienceSegment {
    return new AudienceSegment({ ...this.props, estimatedSize: size, lastComputedAt: new Date() });
  }

  isLargeAudience(): boolean { return this.props.estimatedSize > 1000; }

  toJSON(): AudienceSegmentProps { return { ...this.props, criteria: this.props.criteria.map(c => ({ ...c })) }; }
}

// Pre-built segments used in admin UI
export const PRESET_SEGMENTS: Omit<AudienceSegmentProps, "id" | "createdById" | "createdAt" | "lastComputedAt">[] = [
  {
    name: "Active Members",
    description: "Users who attended a class in the last 30 days",
    criteria: [{ field: "last_active_days", operator: "lte", value: 30 }],
    logic: "AND",
    estimatedSize: 284,
    isDynamic: true,
  },
  {
    name: "Free Plan Users",
    description: "Users on the Free plan — prime conversion targets",
    criteria: [{ field: "membership_plan", operator: "eq", value: "plan_free" }],
    logic: "AND",
    estimatedSize: 512,
    isDynamic: true,
  },
  {
    name: "At-Risk Churn",
    description: "Previously active users with no activity in 30–60 days",
    criteria: [
      { field: "last_active_days", operator: "gte", value: 30 },
      { field: "last_active_days", operator: "lte", value: 60 },
    ],
    logic: "AND",
    estimatedSize: 97,
    isDynamic: true,
  },
  {
    name: "High-Value Annual Members",
    description: "Annual plan subscribers with 20+ classes attended",
    criteria: [
      { field: "membership_plan", operator: "eq", value: "plan_annual" },
      { field: "class_count", operator: "gte", value: 20 },
    ],
    logic: "AND",
    estimatedSize: 63,
    isDynamic: true,
  },
  {
    name: "Birthday This Month",
    description: "Users whose birthday falls this month — for birthday campaigns",
    criteria: [{ field: "birthday_month", operator: "eq", value: new Date().getMonth() + 1 }],
    logic: "AND",
    estimatedSize: 41,
    isDynamic: true,
  },
];
