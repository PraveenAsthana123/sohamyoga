export type FormFieldType = 'text' | 'email' | 'phone' | 'textarea' | 'select';
export type FormStatus = 'draft' | 'active' | 'archived';

export interface FormField {
  key: string;
  label: string;
  type: FormFieldType;
  required: boolean;
  options?: string[]; // for type === 'select'
}

export interface FormDefinitionProps {
  id: string;
  slug: string;
  name: string;
  description?: string | null;
  fields: FormField[];
  successMessage: string;
  status: FormStatus;
  submissionCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export class FormDefinition {
  private readonly props: FormDefinitionProps;

  constructor(props: FormDefinitionProps) {
    if (!/^[a-z0-9-]+$/.test(props.slug)) throw new Error('slug must be lowercase letters, numbers, and hyphens');
    if (!props.name.trim()) throw new Error('name is required');
    if (!Array.isArray(props.fields) || props.fields.length === 0) throw new Error('at least one field is required');
    for (const field of props.fields) {
      if (!field.key || !/^[a-z0-9_]+$/.test(field.key)) throw new Error(`invalid field key: ${field.key}`);
      if (!field.label?.trim()) throw new Error(`field ${field.key} requires a label`);
    }
    const keys = props.fields.map((f) => f.key);
    if (new Set(keys).size !== keys.length) throw new Error('field keys must be unique');
    this.props = { ...props, fields: [...props.fields] };
  }

  get id() { return this.props.id; }
  get slug() { return this.props.slug; }
  get name() { return this.props.name; }
  get fields() { return [...this.props.fields]; }
  get status() { return this.props.status; }
  get successMessage() { return this.props.successMessage; }
  get submissionCount() { return this.props.submissionCount; }

  get acceptsSubmissions(): boolean {
    return this.props.status === 'active';
  }

  activate(): FormDefinition {
    if (this.props.status === 'archived') throw new Error('an archived form cannot be reactivated directly');
    return new FormDefinition({ ...this.props, status: 'active', updatedAt: new Date() });
  }

  archive(): FormDefinition {
    return new FormDefinition({ ...this.props, status: 'archived', updatedAt: new Date() });
  }

  recordSubmission(): FormDefinition {
    if (!this.acceptsSubmissions) throw new Error('this form is not currently accepting submissions');
    return new FormDefinition({ ...this.props, submissionCount: this.props.submissionCount + 1, updatedAt: new Date() });
  }

  /**
   * Validates a raw submission payload against this form's field definitions.
   * Returns the list of validation errors (empty = valid). Server-side only —
   * never trust client-side validation for the public submit endpoint.
   */
  validate(data: Record<string, unknown>): string[] {
    const errors: string[] = [];
    for (const field of this.props.fields) {
      const raw = data[field.key];
      const value = typeof raw === 'string' ? raw.trim() : raw;
      if (field.required && (value === undefined || value === null || value === '')) {
        errors.push(`${field.label} is required`);
        continue;
      }
      if (value === undefined || value === null || value === '') continue;
      if (field.type === 'email' && typeof value === 'string' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
        errors.push(`${field.label} must be a valid email address`);
      }
      if (field.type === 'select' && field.options && !field.options.includes(String(value))) {
        errors.push(`${field.label} must be one of: ${field.options.join(', ')}`);
      }
    }
    return errors;
  }

  toJSON(): FormDefinitionProps {
    return { ...this.props, fields: [...this.props.fields] };
  }
}
