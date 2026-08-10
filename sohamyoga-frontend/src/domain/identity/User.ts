export type UserRole = "student" | "teacher" | "admin";

export interface UserProps {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  hashedPassword?: string;
  avatarUrl?: string;
  phone?: string;
  timezone: string;
  preferredLanguage: string;
  emailVerified: boolean;
  phoneVerified: boolean;
  isActive: boolean;
  createdAt: Date;
  lastLoginAt?: Date;
}

export class EmailAlreadyVerifiedError extends Error { constructor() { super("Email already verified"); } }
export class UserInactiveError extends Error { constructor() { super("User account is inactive"); } }

export class User {
  constructor(private props: UserProps) {
    if (!props.email.includes("@")) throw new Error("Invalid email address");
    if (!props.name.trim()) throw new Error("Name is required");
  }

  get id()                { return this.props.id; }
  get email()             { return this.props.email; }
  get name()              { return this.props.name; }
  get role()              { return this.props.role; }
  get avatarUrl()         { return this.props.avatarUrl; }
  get phone()             { return this.props.phone; }
  get timezone()          { return this.props.timezone; }
  get preferredLanguage() { return this.props.preferredLanguage; }
  get emailVerified()     { return this.props.emailVerified; }
  get phoneVerified()     { return this.props.phoneVerified; }
  get isActive()          { return this.props.isActive; }
  get createdAt()         { return this.props.createdAt; }
  get lastLoginAt()       { return this.props.lastLoginAt; }

  isTeacher(): boolean { return this.props.role === "teacher"; }
  isAdmin(): boolean   { return this.props.role === "admin"; }
  isStudent(): boolean { return this.props.role === "student"; }

  verifyEmail(): User {
    if (this.props.emailVerified) throw new EmailAlreadyVerifiedError();
    return new User({ ...this.props, emailVerified: true });
  }

  deactivate(): User {
    return new User({ ...this.props, isActive: false });
  }

  recordLogin(): User {
    if (!this.props.isActive) throw new UserInactiveError();
    return new User({ ...this.props, lastLoginAt: new Date() });
  }

  promoteToTeacher(): User {
    if (this.props.role !== "student") throw new Error("Only students can be promoted to teacher");
    return new User({ ...this.props, role: "teacher" });
  }

  updateProfile(patch: Partial<Pick<UserProps, "name" | "phone" | "timezone" | "avatarUrl" | "preferredLanguage">>): User {
    return new User({ ...this.props, ...patch });
  }

  toJSON(): Omit<UserProps, "hashedPassword"> {
    const { hashedPassword: _, ...safe } = this.props;
    return safe;
  }
}
