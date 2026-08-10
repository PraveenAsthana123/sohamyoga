// Gamification: Points, Badges, Streaks, Achievements, Leaderboard
// Inspired by Habitica concepts — custom implementation for yoga context

export type BadgeCategory = "attendance" | "pose_mastery" | "streak" | "community" | "milestone" | "wellness" | "challenge" | "referral";

export interface BadgeProps {
  id: string;
  name: string;
  description: string;
  category: BadgeCategory;
  iconUrl?: string;
  emoji: string;
  xpReward: number;
  criteria: string;    // human-readable: "Attend 10 classes"
  isSecret: boolean;   // hidden until earned
}

export interface AchievementProps {
  id: string;
  userId: string;
  badgeId: string;
  earnedAt: Date;
  triggerEvent: string;  // "class_count_10", "first_headstand", etc.
  xpAwarded: number;
}

export interface StreakProps {
  userId: string;
  type: "daily_practice" | "weekly_classes" | "monthly_consistency";
  currentStreak: number;
  longestStreak: number;
  lastActivityDate: Date;
  freezesRemaining: number;   // streak freeze tokens (can miss 1 day)
  updatedAt: Date;
}

export interface PointsLedgerProps {
  id: string;
  userId: string;
  points: number;        // current balance
  totalEarned: number;   // lifetime
  totalSpent: number;    // redeemed for rewards
  level: number;         // computed from totalEarned
  xp: number;            // current XP toward next level
  xpToNextLevel: number;
}

// ---- Streak ----
export class Streak {
  constructor(private props: StreakProps) {
    if (props.currentStreak < 0) throw new Error("Streak cannot be negative");
    if (props.freezesRemaining < 0) throw new Error("Freezes cannot be negative");
  }

  get userId()          { return this.props.userId; }
  get type()            { return this.props.type; }
  get currentStreak()   { return this.props.currentStreak; }
  get longestStreak()   { return this.props.longestStreak; }
  get lastActivityDate(){ return this.props.lastActivityDate; }
  get freezesRemaining(){ return this.props.freezesRemaining; }

  isAtRisk(): boolean {
    const daysSince = Math.floor((Date.now() - this.props.lastActivityDate.getTime()) / 86400000);
    return daysSince >= 1 && this.props.freezesRemaining === 0;
  }

  daysSinceActivity(): number {
    return Math.floor((Date.now() - this.props.lastActivityDate.getTime()) / 86400000);
  }

  record(activityDate: Date): Streak {
    const daysSince = Math.floor((activityDate.getTime() - this.props.lastActivityDate.getTime()) / 86400000);
    if (daysSince < 1) return this; // already recorded today
    if (daysSince === 1) {
      const newStreak = this.props.currentStreak + 1;
      return new Streak({
        ...this.props,
        currentStreak: newStreak,
        longestStreak: Math.max(newStreak, this.props.longestStreak),
        lastActivityDate: activityDate,
        updatedAt: new Date(),
      });
    }
    if (daysSince === 2 && this.props.freezesRemaining > 0) {
      return new Streak({ ...this.props, currentStreak: this.props.currentStreak + 1, freezesRemaining: this.props.freezesRemaining - 1, lastActivityDate: activityDate, updatedAt: new Date() });
    }
    // streak broken
    return new Streak({ ...this.props, currentStreak: 1, lastActivityDate: activityDate, updatedAt: new Date() });
  }

  addFreeze(): Streak {
    return new Streak({ ...this.props, freezesRemaining: this.props.freezesRemaining + 1, updatedAt: new Date() });
  }

  toJSON(): StreakProps { return { ...this.props }; }
}

// ---- Points Ledger ----
const XP_PER_LEVEL = 500;

export class PointsLedger {
  constructor(private props: PointsLedgerProps) {
    if (props.points < 0) throw new Error("Points balance cannot be negative");
  }

  get userId()          { return this.props.userId; }
  get points()          { return this.props.points; }
  get totalEarned()     { return this.props.totalEarned; }
  get level()           { return this.props.level; }
  get xp()              { return this.props.xp; }
  get xpToNextLevel()   { return this.props.xpToNextLevel; }
  get totalSpent()      { return this.props.totalSpent; }

  xpPercent(): number { return Math.round((this.props.xp / this.props.xpToNextLevel) * 100); }

  earn(amount: number, xpAmount: number): PointsLedger {
    if (amount < 0 || xpAmount < 0) throw new Error("Earned amount must be >= 0");
    const newXP = this.props.xp + xpAmount;
    const levelsGained = Math.floor(newXP / XP_PER_LEVEL);
    return new PointsLedger({
      ...this.props,
      points: this.props.points + amount,
      totalEarned: this.props.totalEarned + amount,
      level: this.props.level + levelsGained,
      xp: newXP % XP_PER_LEVEL,
      xpToNextLevel: XP_PER_LEVEL,
    });
  }

  spend(amount: number): PointsLedger {
    if (amount > this.props.points) throw new Error("Insufficient points");
    return new PointsLedger({ ...this.props, points: this.props.points - amount, totalSpent: this.props.totalSpent + amount });
  }

  toJSON(): PointsLedgerProps { return { ...this.props }; }
}

// Badge seed data
export const SEED_BADGES: BadgeProps[] = [
  { id: "b1", name: "First Step",        emoji: "👣", category: "milestone",   xpReward: 50,  criteria: "Complete your first class",         isSecret: false, description: "Welcome to SohamYoga! Your journey begins." },
  { id: "b2", name: "10 Classes",         emoji: "🏅", category: "attendance",  xpReward: 100, criteria: "Attend 10 classes",                  isSecret: false, description: "A solid foundation. Keep it up!" },
  { id: "b3", name: "30 Classes",         emoji: "🥈", category: "attendance",  xpReward: 200, criteria: "Attend 30 classes",                  isSecret: false, description: "Consistency is the key to transformation." },
  { id: "b4", name: "100 Classes",        emoji: "🏆", category: "attendance",  xpReward: 500, criteria: "Attend 100 classes",                 isSecret: false, description: "You are a true yogi. Namaste." },
  { id: "b5", name: "7-Day Streak",       emoji: "🔥", category: "streak",      xpReward: 150, criteria: "Practice 7 days in a row",            isSecret: false, description: "A week of daily practice. You are unstoppable." },
  { id: "b6", name: "30-Day Streak",      emoji: "💎", category: "streak",      xpReward: 400, criteria: "Practice 30 days in a row",           isSecret: false, description: "30 consecutive days. Extraordinary dedication." },
  { id: "b7", name: "Warrior Star",       emoji: "⭐", category: "pose_mastery",xpReward: 120, criteria: "Score 85+ on Warrior I three times",  isSecret: false, description: "Your Warrior I alignment is excellent." },
  { id: "b8", name: "Inversion Achieved", emoji: "🙃", category: "pose_mastery",xpReward: 200, criteria: "First successful headstand",          isSecret: true,  description: "The world looks different from upside down!" },
  { id: "b9", name: "Community Pillar",   emoji: "💚", category: "community",   xpReward: 100, criteria: "Make 10 community posts",             isSecret: false, description: "Your words inspire others." },
  { id: "b10",name: "Ambassador",         emoji: "🌟", category: "referral",    xpReward: 300, criteria: "Refer 3 friends who sign up",         isSecret: false, description: "Thank you for growing our community!" },
];
