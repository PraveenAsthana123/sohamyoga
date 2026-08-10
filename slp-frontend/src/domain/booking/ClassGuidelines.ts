// Value object — immutable set of guidance attached to a YogaClass
export interface ClassGuidelinesProps {
  classId: string;

  // What to bring
  requiredItems: string[];       // "Yoga mat", "Water bottle"
  optionalItems: string[];       // "Yoga blocks", "Blanket"

  // Preparation
  arriveMinutesBefore: number;   // e.g. 10
  eatBeforeMinutes: number;      // avoid eating X minutes before
  preparationNotes: string;      // free text

  // Dos
  dos: string[];                 // "Wear comfortable, stretchy clothing", "Inform teacher of injuries"

  // Don'ts
  donts: string[];               // "Do not use strong perfumes", "Do not leave class mid-session"

  // Health & safety
  contraindications: string[];   // "Pregnancy (after T1)", "Recent surgery", "High BP"
  healthDisclaimer: string;

  // Dress code
  dresscode: string;             // "Comfortable, form-fitting athletic wear"

  // Skill prerequisites
  prerequisites: string[];       // "Completion of Beginner course recommended"

  updatedAt: Date;
}

export class ClassGuidelines {
  constructor(private readonly props: ClassGuidelinesProps) {
    if (props.arriveMinutesBefore < 0) throw new Error("arriveMinutesBefore must be >= 0");
    if (props.eatBeforeMinutes < 0)    throw new Error("eatBeforeMinutes must be >= 0");
  }

  get classId()              { return this.props.classId; }
  get requiredItems()        { return [...this.props.requiredItems]; }
  get optionalItems()        { return [...this.props.optionalItems]; }
  get arriveMinutesBefore()  { return this.props.arriveMinutesBefore; }
  get eatBeforeMinutes()     { return this.props.eatBeforeMinutes; }
  get preparationNotes()     { return this.props.preparationNotes; }
  get dos()                  { return [...this.props.dos]; }
  get donts()                { return [...this.props.donts]; }
  get contraindications()    { return [...this.props.contraindications]; }
  get healthDisclaimer()     { return this.props.healthDisclaimer; }
  get dresscode()            { return this.props.dresscode; }
  get prerequisites()        { return [...this.props.prerequisites]; }
  get updatedAt()            { return this.props.updatedAt; }

  hasContraindication(condition: string): boolean {
    return this.props.contraindications.some(c =>
      c.toLowerCase().includes(condition.toLowerCase())
    );
  }

  withCapacityNote(max: number): ClassGuidelines {
    return new ClassGuidelines({
      ...this.props,
      dos: [...this.props.dos, `Maximum ${max} students per session`],
      updatedAt: new Date(),
    });
  }

  toJSON(): ClassGuidelinesProps {
    return {
      ...this.props,
      requiredItems: [...this.props.requiredItems],
      optionalItems: [...this.props.optionalItems],
      dos: [...this.props.dos],
      donts: [...this.props.donts],
      contraindications: [...this.props.contraindications],
      prerequisites: [...this.props.prerequisites],
    };
  }
}

// Seed data used in tests and admin portal
export const DEFAULT_GUIDELINES: Omit<ClassGuidelinesProps, "classId" | "updatedAt"> = {
  requiredItems: ["Yoga mat", "Water bottle", "Towel"],
  optionalItems: ["Yoga blocks", "Yoga strap", "Bolster pillow", "Blanket"],
  arriveMinutesBefore: 10,
  eatBeforeMinutes: 90,
  preparationNotes: "Hydrate well before class. Light stretching beforehand is welcome.",
  dos: [
    "Wear comfortable, form-fitting athletic wear",
    "Inform the teacher of any injuries or health conditions before class",
    "Respect the silence during meditation segments",
    "Modify poses as needed — listen to your body",
    "Keep your phone on silent",
  ],
  donts: [
    "Do not wear strong perfume or cologne",
    "Do not leave class mid-session without informing the teacher",
    "Do not compare your practice to others",
    "Do not eat a heavy meal within 90 minutes of class",
    "Do not use personal devices during class",
  ],
  contraindications: [
    "Recent surgery (within 6 weeks)",
    "Acute injury or severe joint pain",
    "High blood pressure (uncontrolled)",
    "Pregnancy (consult your doctor first)",
    "Vertigo or inner ear conditions (inversions)",
  ],
  healthDisclaimer:
    "SohamYoga classes are not a substitute for medical treatment. Consult your physician before starting any new exercise program, especially if you have pre-existing health conditions.",
  dresscode: "Comfortable, stretchy athletic wear. Bare feet preferred. Socks optional.",
  prerequisites: [],
};
