// Yoga-specific: Pose (Asana) Library — custom development, no open-source equivalent

export type YogaCategory = "standing" | "seated" | "supine" | "prone" | "inversion" | "backbend" | "twist" | "balancing" | "restorative";
export type BodyFocus = "core" | "hips" | "spine" | "shoulders" | "hamstrings" | "quads" | "chest" | "arms" | "neck" | "glutes" | "full_body";
export type DoshaBenefit = "vata" | "pitta" | "kapha" | "tridosha";

export interface AsanaProps {
  id: string;
  englishName: string;
  sanskritName: string;
  alternateName?: string;
  category: YogaCategory;
  level: "Beginner" | "Intermediate" | "Advanced";
  bodyFocus: BodyFocus[];
  durationSeconds: { min: number; max: number };
  description: string;
  benefits: string[];
  contraindications: string[];
  props: string[];               // "Block", "Strap", "Bolster"
  preparatoryPoses: string[];    // asana IDs
  followUpPoses: string[];       // asana IDs
  breathInstruction: string;
  doshaBalance: DoshaBenefit[];
  imageUrl?: string;
  videoUrl?: string;
  cues: string[];                // "Press through all four corners of feet"
  modifications: string[];       // modifications for different levels
  isActive: boolean;
  createdById: string;
}

export class Asana {
  constructor(private readonly props: AsanaProps) {
    if (!props.englishName.trim()) throw new Error("English name is required");
    if (!props.sanskritName.trim()) throw new Error("Sanskrit name is required");
    if (props.durationSeconds.min > props.durationSeconds.max) throw new Error("Min duration cannot exceed max");
    if (props.bodyFocus.length === 0) throw new Error("At least one body focus required");
  }

  get id()               { return this.props.id; }
  get englishName()      { return this.props.englishName; }
  get sanskritName()     { return this.props.sanskritName; }
  get alternateName()    { return this.props.alternateName; }
  get category()         { return this.props.category; }
  get level()            { return this.props.level; }
  get bodyFocus()        { return [...this.props.bodyFocus]; }
  get durationSeconds()  { return { ...this.props.durationSeconds }; }
  get description()      { return this.props.description; }
  get benefits()         { return [...this.props.benefits]; }
  get contraindications(){ return [...this.props.contraindications]; }
  get props_()           { return [...this.props.props]; }
  get cues()             { return [...this.props.cues]; }
  get modifications()    { return [...this.props.modifications]; }
  get breathInstruction(){ return this.props.breathInstruction; }
  get doshaBalance()     { return [...this.props.doshaBalance]; }
  get isActive()         { return this.props.isActive; }

  isSafeFor(conditions: string[]): boolean {
    return !conditions.some(c =>
      this.props.contraindications.some(ci => ci.toLowerCase().includes(c.toLowerCase()))
    );
  }

  requiresProps(): boolean { return this.props.props.length > 0; }
  isInversion(): boolean   { return this.props.category === "inversion"; }

  toJSON(): AsanaProps {
    return {
      ...this.props,
      bodyFocus: [...this.props.bodyFocus],
      benefits: [...this.props.benefits],
      contraindications: [...this.props.contraindications],
      props: [...this.props.props],
      preparatoryPoses: [...this.props.preparatoryPoses],
      followUpPoses: [...this.props.followUpPoses],
      doshaBalance: [...this.props.doshaBalance],
      cues: [...this.props.cues],
      modifications: [...this.props.modifications],
    };
  }
}

// Seed pose library — 8 foundational asanas
export const SEED_ASANAS: Omit<AsanaProps, "id" | "createdById">[] = [
  {
    englishName: "Mountain Pose", sanskritName: "Tadasana", category: "standing", level: "Beginner",
    bodyFocus: ["full_body", "core"], durationSeconds: { min: 30, max: 120 },
    description: "The foundation of all standing poses. Teaches correct postural alignment.",
    benefits: ["Improves posture", "Strengthens thighs and ankles", "Increases body awareness", "Reduces flat feet"],
    contraindications: ["Headache", "Insomnia (avoid long holds)"],
    props: [], preparatoryPoses: [], followUpPoses: ["vrksasana", "uttanasana"],
    breathInstruction: "Breathe naturally and evenly. Lengthen on every inhale.",
    doshaBalance: ["tridosha"], cues: ["Distribute weight evenly across all four corners of feet", "Engage thighs without locking knees", "Soften the face"],
    modifications: ["Stand with feet hip-width apart if unstable", "Use wall for support"], isActive: true,
  },
  {
    englishName: "Downward Facing Dog", sanskritName: "Adho Mukha Svanasana", category: "inversion", level: "Beginner",
    bodyFocus: ["hamstrings", "shoulders", "spine", "core"], durationSeconds: { min: 30, max: 180 },
    description: "An iconic full-body stretch and gentle inversion that energises the entire body.",
    benefits: ["Stretches hamstrings and calves", "Strengthens arms and legs", "Relieves back pain", "Energises the body", "Calms the mind"],
    contraindications: ["Carpal tunnel syndrome", "Late-term pregnancy", "High blood pressure (use supported variation)"],
    props: ["Block (under hands)"], preparatoryPoses: ["tadasana"], followUpPoses: ["plank", "warrior_i"],
    breathInstruction: "Inhale to lengthen spine, exhale to press heels toward floor.",
    doshaBalance: ["vata", "pitta"], cues: ["Press index finger and thumb into the mat", "Rotate upper arms outward", "Pedal heels alternately to warm up"],
    modifications: ["Bend knees generously if hamstrings are tight", "Use blocks under hands"], isActive: true,
  },
  {
    englishName: "Warrior I", sanskritName: "Virabhadrasana I", category: "standing", level: "Beginner",
    bodyFocus: ["quads", "hips", "chest", "shoulders"], durationSeconds: { min: 30, max: 90 },
    description: "A powerful standing pose that builds strength, stability, and focus.",
    benefits: ["Strengthens legs and core", "Opens hips and chest", "Builds mental focus and determination"],
    contraindications: ["High blood pressure", "Neck problems (do not tilt head back)"],
    props: [], preparatoryPoses: ["tadasana", "adho_mukha_svanasana"], followUpPoses: ["warrior_ii", "virabhadrasana_iii"],
    breathInstruction: "Inhale arms up, exhale deeper into lunge. Hold with even breath.",
    doshaBalance: ["kapha", "vata"], cues: ["Square hips to the front of the mat", "Stack front knee over front ankle", "Lengthen tailbone down"],
    modifications: ["Shorten stance if hips cannot square", "Keep hands on hips for balance"], isActive: true,
  },
  {
    englishName: "Child's Pose", sanskritName: "Balasana", category: "restorative", level: "Beginner",
    bodyFocus: ["spine", "hips", "chest"], durationSeconds: { min: 60, max: 600 },
    description: "A gentle resting pose that releases tension in the back, hips, and mind.",
    benefits: ["Releases lower back tension", "Calms the nervous system", "Relieves stress and fatigue", "Gently stretches hips and thighs"],
    contraindications: ["Knee injury", "Pregnancy (use wide-knee variation)"],
    props: ["Blanket (under knees)", "Bolster (under chest)"],
    preparatoryPoses: [], followUpPoses: ["tadasana", "adho_mukha_svanasana"],
    breathInstruction: "Breathe into the back of the body. Let the exhale release tension.",
    doshaBalance: ["vata", "pitta"], cues: ["Sink hips toward heels", "Arms extended or rest alongside body", "Forehead rests on mat"],
    modifications: ["Wide-knee variation for belly or pregnancy", "Fists under forehead if forehead doesn't reach mat"], isActive: true,
  },
  {
    englishName: "Tree Pose", sanskritName: "Vrksasana", category: "balancing", level: "Beginner",
    bodyFocus: ["core", "quads", "hips"], durationSeconds: { min: 30, max: 90 },
    description: "A classic balancing pose that cultivates focus, stability, and poise.",
    benefits: ["Improves balance and concentration", "Strengthens ankles and calves", "Stretches inner thighs and groin"],
    contraindications: ["Recent ankle or knee injury"],
    props: [], preparatoryPoses: ["tadasana"], followUpPoses: ["warrior_iii"],
    breathInstruction: "Fix gaze (drishti) on a still point. Breathe steadily.",
    doshaBalance: ["vata"], cues: ["Avoid pressing foot into knee joint", "Engage standing leg's thigh", "Grow tall through crown of head"],
    modifications: ["Rest toe on floor for beginners", "Use wall for balance support"], isActive: true,
  },
];
