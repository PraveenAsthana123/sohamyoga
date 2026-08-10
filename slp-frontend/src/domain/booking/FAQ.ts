// FAQ items attached to a class, service, or the platform globally.
// Admin-managed: can be created/edited/reordered from the admin portal.

export type FAQScope = "class" | "membership" | "ai_feature" | "payment" | "global";

export interface FAQItemProps {
  id: string;
  scope: FAQScope;
  entityId?: string;     // classId, planId, etc. — null = applies globally to that scope
  question: string;
  answer: string;        // may contain plain text or simple markdown
  displayOrder: number;
  isActive: boolean;
  createdById: string;
  updatedAt: Date;
}

export class FAQItem {
  constructor(private props: FAQItemProps) {
    if (!props.question.trim()) throw new Error("Question is required");
    if (!props.answer.trim()) throw new Error("Answer is required");
    if (props.displayOrder < 0) throw new Error("Display order must be >= 0");
  }

  get id()           { return this.props.id; }
  get scope()        { return this.props.scope; }
  get entityId()     { return this.props.entityId; }
  get question()     { return this.props.question; }
  get answer()       { return this.props.answer; }
  get displayOrder() { return this.props.displayOrder; }
  get isActive()     { return this.props.isActive; }

  update(patch: Partial<Pick<FAQItemProps, "question" | "answer" | "displayOrder" | "isActive">>): FAQItem {
    return new FAQItem({ ...this.props, ...patch, updatedAt: new Date() });
  }

  deactivate(): FAQItem {
    return new FAQItem({ ...this.props, isActive: false, updatedAt: new Date() });
  }

  toJSON(): FAQItemProps { return { ...this.props }; }
}

// Seed FAQ data for classes — shipped with the platform, editable from admin
export const SEED_CLASS_FAQS: Omit<FAQItemProps, "id" | "entityId" | "createdById" | "updatedAt">[] = [
  { scope: "class", question: "What should I bring to class?", answer: "A yoga mat, water bottle, and towel. Blocks and straps are provided.", displayOrder: 0, isActive: true },
  { scope: "class", question: "Can I attend if I am a complete beginner?", answer: "Absolutely! Our Beginner and All Levels classes welcome everyone. Let the teacher know before class.", displayOrder: 1, isActive: true },
  { scope: "class", question: "What happens if I need to cancel my booking?", answer: "You can cancel up to 2 hours before class for a full refund. Late cancellations are non-refundable.", displayOrder: 2, isActive: true },
  { scope: "class", question: "Is the class online or in-studio?", answer: "Both options are available. Check the class card — it shows 'Online' or the studio location.", displayOrder: 3, isActive: true },
  { scope: "class", question: "I have an injury. Can I still participate?", answer: "Please inform your teacher before class. Most poses can be modified. For serious conditions, consult your doctor first.", displayOrder: 4, isActive: true },
];

export const SEED_MEMBERSHIP_FAQS: Omit<FAQItemProps, "id" | "entityId" | "createdById" | "updatedAt">[] = [
  { scope: "membership", question: "Can I switch plans?", answer: "Yes, you can upgrade or downgrade at any time from your account settings. Changes take effect at the next billing cycle.", displayOrder: 0, isActive: true },
  { scope: "membership", question: "How does the free trial work?", answer: "Start any paid plan with a 7-day free trial. You will not be charged until the trial ends, and you can cancel anytime.", displayOrder: 1, isActive: true },
  { scope: "membership", question: "Can I pause my membership?", answer: "Yes, paid memberships can be paused for up to 3 months per year from your account settings.", displayOrder: 2, isActive: true },
  { scope: "membership", question: "What payment methods are accepted?", answer: "We accept all major credit/debit cards via Stripe. Bank transfers available for annual plans.", displayOrder: 3, isActive: true },
];
