// Ayurveda Dosha Assessment — fully custom, no open-source equivalent

export type Dosha = "vata" | "pitta" | "kapha";
export type DoshaType = "mono" | "dual" | "tri"; // e.g. Vata-Pitta, Tridosha

export interface DoshaQuestion {
  id: string;
  category: "body" | "mind" | "digestion" | "sleep" | "emotions" | "skin" | "energy";
  question: string;
  options: {
    text: string;
    dosha: Dosha;
    score: number;
  }[];
}

export interface DoshaAssessmentProps {
  id: string;
  studentId: string;
  answers: { questionId: string; selectedDosha: Dosha; score: number }[];
  vataScore: number;
  pittaScore: number;
  kaphaScore: number;
  primaryDosha: Dosha;
  secondaryDosha?: Dosha;
  type: DoshaType;
  recommendations: {
    yogaStyles: string[];
    avoidStyles: string[];
    bestPracticeTime: string;
    nutritionNote: string;
    lifestyleTip: string;
  };
  completedAt: Date;
}

export class DoshaAssessment {
  constructor(private readonly props: DoshaAssessmentProps) {
    if (props.answers.length === 0) throw new Error("Answers required");
    const total = props.vataScore + props.pittaScore + props.kaphaScore;
    if (total === 0) throw new Error("Scores cannot all be zero");
  }

  get id()            { return this.props.id; }
  get studentId()     { return this.props.studentId; }
  get vataScore()     { return this.props.vataScore; }
  get pittaScore()    { return this.props.pittaScore; }
  get kaphaScore()    { return this.props.kaphaScore; }
  get primaryDosha()  { return this.props.primaryDosha; }
  get secondaryDosha(){ return this.props.secondaryDosha; }
  get type()          { return this.props.type; }
  get recommendations(){ return { ...this.props.recommendations }; }

  dominantPercent(dosha: Dosha): number {
    const total = this.props.vataScore + this.props.pittaScore + this.props.kaphaScore;
    const score = dosha === "vata" ? this.props.vataScore : dosha === "pitta" ? this.props.pittaScore : this.props.kaphaScore;
    return Math.round((score / total) * 100);
  }

  constitution(): string {
    if (this.props.type === "tri") return "Tridosha";
    if (this.props.type === "dual") return `${this._cap(this.props.primaryDosha)}-${this._cap(this.props.secondaryDosha!)}`;
    return this._cap(this.props.primaryDosha);
  }

  private _cap(s: string) { return s.charAt(0).toUpperCase() + s.slice(1); }

  toJSON(): DoshaAssessmentProps {
    return { ...this.props, answers: this.props.answers.map(a => ({ ...a })) };
  }
}

// 10-question assessment used in onboarding
export const DOSHA_QUESTIONS: DoshaQuestion[] = [
  {
    id: "q1", category: "body", question: "My body frame is:",
    options: [
      { text: "Thin, light, hard to gain weight", dosha: "vata", score: 3 },
      { text: "Medium build, well-proportioned", dosha: "pitta", score: 3 },
      { text: "Larger, sturdy, easy to gain weight", dosha: "kapha", score: 3 },
    ],
  },
  {
    id: "q2", category: "mind", question: "My mind is:",
    options: [
      { text: "Quick, restless, lots of ideas", dosha: "vata", score: 3 },
      { text: "Sharp, focused, decisive", dosha: "pitta", score: 3 },
      { text: "Calm, steady, methodical", dosha: "kapha", score: 3 },
    ],
  },
  {
    id: "q3", category: "sleep", question: "My sleep is:",
    options: [
      { text: "Light, interrupted, tend to wake easily", dosha: "vata", score: 3 },
      { text: "Moderate, occasionally wake hot", dosha: "pitta", score: 3 },
      { text: "Heavy, love to sleep long hours", dosha: "kapha", score: 3 },
    ],
  },
  {
    id: "q4", category: "digestion", question: "My digestion is:",
    options: [
      { text: "Irregular — sometimes strong, sometimes not", dosha: "vata", score: 3 },
      { text: "Strong — get irritable if I skip meals", dosha: "pitta", score: 3 },
      { text: "Slow but steady — not very hungry in the morning", dosha: "kapha", score: 3 },
    ],
  },
  {
    id: "q5", category: "emotions", question: "Under stress I tend to:",
    options: [
      { text: "Feel anxious and overwhelmed", dosha: "vata", score: 3 },
      { text: "Become irritable or critical", dosha: "pitta", score: 3 },
      { text: "Withdraw and become possessive", dosha: "kapha", score: 3 },
    ],
  },
];

export const DOSHA_RECOMMENDATIONS: Record<Dosha, DoshaAssessmentProps["recommendations"]> = {
  vata: {
    yogaStyles: ["Hatha", "Yin", "Restorative", "Iyengar"],
    avoidStyles: ["Fast Vinyasa", "Power Yoga", "Hot Yoga"],
    bestPracticeTime: "Morning (6–8 AM) or early evening (5–7 PM)",
    nutritionNote: "Warm, cooked, grounding foods. Avoid raw, cold, and dry foods.",
    lifestyleTip: "Establish a consistent daily routine (dinacharya). Prioritise sleep and warmth.",
  },
  pitta: {
    yogaStyles: ["Yin", "Restorative", "Moon Salutation", "Cooling flows"],
    avoidStyles: ["Hot Yoga", "Power Yoga", "Competitive environments"],
    bestPracticeTime: "Late evening (6–8 PM) or early morning before sunrise",
    nutritionNote: "Cooling foods — cucumbers, mint, coconut. Avoid spicy, oily, fermented.",
    lifestyleTip: "Surrender the need to win. Practice without judgment. Stay cool.",
  },
  kapha: {
    yogaStyles: ["Vinyasa", "Power Yoga", "Ashtanga", "Sun Salutations"],
    avoidStyles: ["Yin (extended), Restorative (too sedating)"],
    bestPracticeTime: "Early morning (6–8 AM) — most energising time to counteract heaviness",
    nutritionNote: "Light, dry, spiced foods. Avoid heavy, oily, sweet, and cold foods.",
    lifestyleTip: "Vary your routine to avoid stagnation. Challenge yourself regularly.",
  },
};
