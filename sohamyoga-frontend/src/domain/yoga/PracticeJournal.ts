// Custom yoga-specific: practice journal, mood tracking, wellness notes

export type MoodRating = 1 | 2 | 3 | 4 | 5;
export type EnergyLevel = "very_low" | "low" | "moderate" | "high" | "very_high";
export type JournalEntryType = "class" | "self_practice" | "meditation" | "pranayama" | "wellness_check";

export interface JournalEntryProps {
  id: string;
  studentId: string;
  type: JournalEntryType;
  title: string;
  date: Date;
  durationMinutes: number;

  // Wellness state
  moodBefore: MoodRating;
  moodAfter: MoodRating;
  energyBefore: EnergyLevel;
  energyAfter: EnergyLevel;
  stressLevel: MoodRating;    // 1=calm, 5=very stressed
  sleepHours?: number;
  waterIntakeLiters?: number;

  // Practice notes
  practiceNotes: string;
  intentionForSession: string;
  gratitudeNote: string;
  asanasAttempted: string[];   // asana IDs
  breakthrough?: string;       // "First time holding headstand!"
  challenges?: string;         // "Right hip very tight today"
  teacherFeedback?: string;

  // Linked session
  reservationId?: string;
  poseSessionId?: string;

  isPrivate: boolean;
  createdAt: Date;
}

export class JournalEntry {
  constructor(private readonly props: JournalEntryProps) {
    if (!props.title.trim()) throw new Error("Title is required");
    if (props.durationMinutes < 1) throw new Error("Duration must be >= 1 minute");
    if (props.moodBefore < 1 || props.moodBefore > 5) throw new Error("Mood must be 1–5");
    if (props.moodAfter < 1 || props.moodAfter > 5) throw new Error("Mood must be 1–5");
  }

  get id()                { return this.props.id; }
  get studentId()         { return this.props.studentId; }
  get type()              { return this.props.type; }
  get title()             { return this.props.title; }
  get date()              { return this.props.date; }
  get durationMinutes()   { return this.props.durationMinutes; }
  get moodBefore()        { return this.props.moodBefore; }
  get moodAfter()         { return this.props.moodAfter; }
  get energyBefore()      { return this.props.energyBefore; }
  get energyAfter()       { return this.props.energyAfter; }
  get stressLevel()       { return this.props.stressLevel; }
  get practiceNotes()     { return this.props.practiceNotes; }
  get intentionForSession(){ return this.props.intentionForSession; }
  get gratitudeNote()     { return this.props.gratitudeNote; }
  get asanasAttempted()   { return [...this.props.asanasAttempted]; }
  get breakthrough()      { return this.props.breakthrough; }
  get isPrivate()         { return this.props.isPrivate; }

  moodImproved(): boolean { return this.props.moodAfter > this.props.moodBefore; }
  moodDelta(): number     { return this.props.moodAfter - this.props.moodBefore; }
  energyImproved(): boolean {
    const levels: EnergyLevel[] = ["very_low","low","moderate","high","very_high"];
    return levels.indexOf(this.props.energyAfter) > levels.indexOf(this.props.energyBefore);
  }

  hasMilestone(): boolean { return !!this.props.breakthrough; }

  toJSON(): JournalEntryProps {
    return { ...this.props, asanasAttempted: [...this.props.asanasAttempted] };
  }
}
