import { ClinicServiceType } from '@/domain/script/CallScript';

export interface BusinessCustomerProps {
  id: string;
  email: string;
  businessName: string;
  serviceType: ClinicServiceType;
  servicesDescription: string;
  pricingInfo: string;
  businessHours: string;
  holidaysClosures: string;
  welcomeNote: string;
  thankYouNote: string;
  paymentNote: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class BusinessCustomer {
  private readonly props: BusinessCustomerProps;

  constructor(props: BusinessCustomerProps) {
    if (!props.businessName.trim()) throw new Error('businessName is required');
    if (!props.email.trim()) throw new Error('email is required');
    this.props = { ...props };
  }

  get id() { return this.props.id; }
  get email() { return this.props.email; }
  get businessName() { return this.props.businessName; }
  get serviceType() { return this.props.serviceType; }
  get servicesDescription() { return this.props.servicesDescription; }
  get pricingInfo() { return this.props.pricingInfo; }
  get businessHours() { return this.props.businessHours; }
  get holidaysClosures() { return this.props.holidaysClosures; }
  get welcomeNote() { return this.props.welcomeNote; }
  get thankYouNote() { return this.props.thankYouNote; }
  get paymentNote() { return this.props.paymentNote; }
  get isActive() { return this.props.isActive; }

  withProfile(update: Partial<Pick<BusinessCustomerProps, 'businessName' | 'serviceType' | 'servicesDescription' | 'pricingInfo' | 'businessHours' | 'holidaysClosures' | 'welcomeNote' | 'thankYouNote' | 'paymentNote'>>): BusinessCustomer {
    // Keys present with an explicit `undefined` value (e.g. a route that
    // always spreads every optional field) must NOT overwrite existing data
    // -- only keys with a real value should override. This was a real bug:
    // any partial update silently wiped every field not included by name.
    const defined = Object.fromEntries(Object.entries(update).filter(([, v]) => v !== undefined));
    return new BusinessCustomer({ ...this.props, ...defined, updatedAt: new Date() });
  }

  toJSON(): Omit<BusinessCustomerProps, 'email'> & { email: string } {
    return { ...this.props };
  }
}
