// Teacher profile — custom yoga-specific entity
// HR record managed by Frappe HR; schedule managed by Cal.com; certs by Paperless-ngx

export type TeacherStatus = "trainee" | "active" | "on_leave" | "retired" | "terminated";
export type ContractType = "employee" | "contractor" | "volunteer" | "intern";
export type YogaSpecialization =
  | "Hatha" | "Vinyasa" | "Ashtanga" | "Yin" | "Restorative" | "Kundalini"
  | "Iyengar" | "Bikram" | "Power" | "Prenatal" | "Kids" | "Chair" | "Nidra"
  | "Meditation" | "Pranayama" | "Aerial" | "Acro";

export interface TeacherCertification {
  id: string;
  name: string;               // "RYT-200", "YACEP", "Prenatal Yoga Cert"
  issuingBody: string;        // "Yoga Alliance", "IYTA"
  issueDate: Date;
  expiryDate?: Date;
  documentId?: string;        // Paperless-ngx document ID
  verified: boolean;
  verifiedBy?: string;
}

export interface TeacherProfileProps {
  id: string;
  userId: string;

  // External system IDs
  frappeEmployeeId?: string;    // Frappe HR employee record
  frappeStudentId?: string;     // Frappe Education if they also take classes
  calcomUserId?: string;        // Cal.com scheduling account
  paperlessTagId?: string;      // Paperless-ngx tag for their documents
  moodleUserId?: string;        // Moodle account for training courses

  // Personal
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  dateOfBirth?: Date;
  avatarUrl?: string;
  bio: string;                  // public-facing biography
  timezone: string;

  // Employment
  status: TeacherStatus;
  contractType: ContractType;
  hireDate: Date;
  endDate?: Date;
  department: string;           // "Yoga Instruction", "Teacher Training"
  designation: string;          // "Lead Teacher", "Assistant Teacher"
  hourlyRate: number;
  currency: string;

  // Yoga expertise
  specializations: YogaSpecialization[];
  certifications: TeacherCertification[];
  yearsTeaching: number;
  maxClassSize: number;
  canTeachOnline: boolean;
  canTeachKids: boolean;
  canTeachPrenatal: boolean;
  languages: string[];

  // Performance (updated by batch job)
  totalClassesTaught: number;
  avgStudentRating: number;     // 1–5
  totalStudents: number;
  upcomingClasses: number;

  // Training (Moodle)
  moodleCoursesCompleted: string[];
  lastTrainingDate?: Date;
  cpd_hoursThisYear: number;    // Continuing Professional Development

  isPublicProfile: boolean;
  notes: string;
  createdAt: Date;
  updatedAt: Date;
}

export class TeacherProfile {
  constructor(private props: TeacherProfileProps) {
    if (!props.firstName.trim()) throw new Error("First name required");
    if (!props.lastName.trim()) throw new Error("Last name required");
    if (!props.email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) throw new Error("Invalid email");
    if (props.specializations.length === 0) throw new Error("At least one specialization required");
    if (props.hourlyRate < 0) throw new Error("Hourly rate cannot be negative");
    if (props.yearsTeaching < 0) throw new Error("Years teaching cannot be negative");
    if (props.avgStudentRating < 0 || props.avgStudentRating > 5)
      throw new Error("Rating must be 0–5");
  }

  get id()                 { return this.props.id; }
  get userId()             { return this.props.userId; }
  get status()             { return this.props.status; }
  get fullName()           { return `${this.props.firstName} ${this.props.lastName}`; }
  get email()              { return this.props.email; }
  get bio()                { return this.props.bio; }
  get specializations()    { return [...this.props.specializations]; }
  get certifications()     { return this.props.certifications.map(c => ({ ...c })); }
  get contractType()       { return this.props.contractType; }
  get designation()        { return this.props.designation; }
  get avgStudentRating()   { return this.props.avgStudentRating; }
  get totalClassesTaught() { return this.props.totalClassesTaught; }
  get totalStudents()      { return this.props.totalStudents; }
  get frappeEmployeeId()   { return this.props.frappeEmployeeId; }
  get calcomUserId()       { return this.props.calcomUserId; }
  get moodleUserId()       { return this.props.moodleUserId; }
  get paperlessTagId()     { return this.props.paperlessTagId; }
  get yearsTeaching()      { return this.props.yearsTeaching; }
  get canTeachKids()       { return this.props.canTeachKids; }
  get canTeachPrenatal()   { return this.props.canTeachPrenatal; }
  get isPublicProfile()    { return this.props.isPublicProfile; }
  get cpd_hoursThisYear()  { return this.props.cpd_hoursThisYear; }

  isActive(): boolean { return this.props.status === "active"; }
  isEmployed(): boolean { return ["employee","intern"].includes(this.props.contractType); }

  hasValidCertification(type: string): boolean {
    return this.props.certifications.some(c =>
      c.name.toLowerCase().includes(type.toLowerCase()) &&
      c.verified &&
      (!c.expiryDate || c.expiryDate > new Date())
    );
  }

  expiredCertifications(): TeacherCertification[] {
    return this.props.certifications.filter(c => c.expiryDate && c.expiryDate < new Date());
  }

  canTeach(specialization: YogaSpecialization): boolean {
    return this.props.specializations.includes(specialization);
  }

  addCertification(cert: TeacherCertification): TeacherProfile {
    return new TeacherProfile({ ...this.props, certifications: [...this.props.certifications, cert], updatedAt: new Date() });
  }

  linkFrappeHR(employeeId: string): TeacherProfile {
    return new TeacherProfile({ ...this.props, frappeEmployeeId: employeeId, updatedAt: new Date() });
  }

  linkCalcom(calcomUserId: string): TeacherProfile {
    return new TeacherProfile({ ...this.props, calcomUserId, updatedAt: new Date() });
  }

  linkMoodle(moodleUserId: string): TeacherProfile {
    return new TeacherProfile({ ...this.props, moodleUserId, updatedAt: new Date() });
  }

  retire(): TeacherProfile {
    if (!["active","on_leave"].includes(this.props.status)) throw new Error("Can only retire active or on-leave teachers");
    return new TeacherProfile({ ...this.props, status: "retired", endDate: new Date(), updatedAt: new Date() });
  }

  toJSON(): TeacherProfileProps {
    return {
      ...this.props,
      specializations: [...this.props.specializations],
      certifications: this.props.certifications.map(c => ({ ...c })),
      moodleCoursesCompleted: [...this.props.moodleCoursesCompleted],
      languages: [...this.props.languages],
    };
  }
}
