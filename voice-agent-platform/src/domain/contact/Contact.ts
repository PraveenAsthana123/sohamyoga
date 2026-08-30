export type ContactStatus = 'new' | 'contacted' | 'qualified' | 'customer' | 'do_not_call' | 'archived';

export interface ContactProps {
  id: string;
  fullName: string;
  email?: string | null;
  phone?: string | null;
  clinicName?: string | null;
  preferredLanguage: string;
  status: ContactStatus;
  source: string;
  notes?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export class Contact {
  private readonly props: ContactProps;

  constructor(props: ContactProps) {
    if (!props.fullName.trim()) throw new Error('fullName is required');
    if (!props.email && !props.phone) throw new Error('at least one of email or phone is required');
    if (props.email && !EMAIL_RE.test(props.email)) throw new Error('email is not a valid address');
    this.props = { ...props };
  }

  get id() { return this.props.id; }
  get fullName() { return this.props.fullName; }
  get email() { return this.props.email ?? null; }
  get phone() { return this.props.phone ?? null; }
  get clinicName() { return this.props.clinicName ?? null; }
  get status() { return this.props.status; }
  get source() { return this.props.source; }

  get isCallable(): boolean {
    return this.props.status !== 'do_not_call' && this.props.status !== 'archived';
  }

  changeStatus(status: ContactStatus): Contact {
    return new Contact({ ...this.props, status, updatedAt: new Date() });
  }

  updateDetails(patch: Partial<Pick<ContactProps, 'fullName' | 'email' | 'phone' | 'clinicName' | 'preferredLanguage' | 'notes'>>): Contact {
    return new Contact({ ...this.props, ...patch, updatedAt: new Date() });
  }

  toJSON(): ContactProps {
    return { ...this.props };
  }
}
