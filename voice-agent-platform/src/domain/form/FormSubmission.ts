export interface FormSubmissionProps {
  id: string;
  formId: string;
  data: Record<string, unknown>;
  contactId: string | null;
  createdAt: Date;
}

export class FormSubmission {
  private readonly props: FormSubmissionProps;

  constructor(props: FormSubmissionProps) {
    if (!props.formId) throw new Error('formId is required');
    if (!props.data || typeof props.data !== 'object') throw new Error('data is required');
    this.props = { ...props, data: { ...props.data } };
  }

  get id() { return this.props.id; }
  get formId() { return this.props.formId; }
  get data() { return { ...this.props.data }; }
  get contactId() { return this.props.contactId; }

  linkContact(contactId: string): FormSubmission {
    return new FormSubmission({ ...this.props, contactId });
  }

  toJSON(): FormSubmissionProps {
    return { ...this.props, data: { ...this.props.data } };
  }
}
