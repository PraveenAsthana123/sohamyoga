'use client';

import { useState, useEffect, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { chatRequestApi } from '@/lib/api';

/* ------------------------------------------------------------------ */
/*  Types & Constants                                                  */
/* ------------------------------------------------------------------ */

interface ChatFormData {
  requestType: string;
  serviceInterest: string;
  name: string;
  email: string;
  phone: string;
  company: string;
  message: string;
  priority: string;
}

const initialFormData: ChatFormData = {
  requestType: '',
  serviceInterest: '',
  name: '',
  email: '',
  phone: '',
  company: '',
  message: '',
  priority: 'Medium',
};

const REQUEST_TYPES = [
  { label: 'General Inquiry', value: 'General Inquiry', icon: 'chat' },
  { label: 'Request a Demo', value: 'Demo Request', icon: 'play' },
  { label: 'Book Consultation', value: 'Consultation', icon: 'calendar' },
  { label: 'Technical Support', value: 'Support', icon: 'wrench' },
] as const;

const SERVICE_OPTIONS = [
  'Generative AI',
  'Machine Learning',
  'Deep Learning',
  'Computer Vision',
  'NLP',
  'Data Migration',
  'SharePoint',
  'Project Management',
  'Managed IT',
  'Custom Development',
  'Not sure yet',
] as const;

const PRIORITIES = ['Low', 'Medium', 'High', 'Urgent'] as const;

const TOTAL_STEPS = 5;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/* ------------------------------------------------------------------ */
/*  Inline SVG Icons                                                   */
/* ------------------------------------------------------------------ */

function ChatBubbleIcon({ className = 'w-6 h-6' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
      />
    </svg>
  );
}

function PlayIcon({ className = 'w-6 h-6' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
      />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function CalendarIcon({ className = 'w-6 h-6' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
      />
    </svg>
  );
}

function WrenchIcon({ className = 'w-6 h-6' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
      />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function ArrowLeftIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
    </svg>
  );
}

function PencilIcon({ className = 'w-3.5 h-3.5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
      />
    </svg>
  );
}

const ICON_MAP: Record<string, ({ className }: { className?: string }) => React.ReactElement> = {
  chat: ChatBubbleIcon,
  play: PlayIcon,
  calendar: CalendarIcon,
  wrench: WrenchIcon,
};

/* ------------------------------------------------------------------ */
/*  Progress Dots                                                      */
/* ------------------------------------------------------------------ */

function ProgressDots({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center justify-center gap-2 py-3">
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={`block rounded-full transition-all duration-300 ${
            i + 1 === current
              ? 'w-2.5 h-2.5 bg-primary-600'
              : i + 1 < current
                ? 'w-2 h-2 bg-primary-300'
                : 'w-2 h-2 bg-dark-200'
          }`}
        />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Step 1 -- Request Type                                             */
/* ------------------------------------------------------------------ */

function StepRequestType({ onSelect }: { onSelect: (value: string) => void }) {
  return (
    <div className="p-5">
      <h4 className="text-base font-bold text-dark-800 mb-1">How can we help?</h4>
      <p className="text-xs text-dark-500 mb-4">Select the type of request to get started.</p>
      <div className="grid grid-cols-2 gap-3">
        {REQUEST_TYPES.map((rt) => {
          const IconComp = ICON_MAP[rt.icon];
          return (
            <button
              key={rt.value}
              type="button"
              onClick={() => onSelect(rt.value)}
              className="flex flex-col items-center gap-2 p-4 rounded-xl border border-dark-200 bg-white hover:bg-primary-50 hover:border-primary-200 transition-all duration-200 group cursor-pointer"
            >
              <span className="w-10 h-10 rounded-full bg-primary-50 group-hover:bg-primary-100 flex items-center justify-center text-primary-600 transition-colors duration-200">
                <IconComp className="w-5 h-5" />
              </span>
              <span className="text-xs font-semibold text-dark-700 group-hover:text-primary-700 text-center leading-tight">
                {rt.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Step 2 -- Service Interest                                         */
/* ------------------------------------------------------------------ */

function StepServiceInterest({
  selected,
  onSelect,
}: {
  selected: string;
  onSelect: (value: string) => void;
}) {
  return (
    <div className="p-5">
      <h4 className="text-base font-bold text-dark-800 mb-1">Which service interests you?</h4>
      <p className="text-xs text-dark-500 mb-4">Choose a service area or skip if unsure.</p>
      <div className="grid grid-cols-2 gap-2">
        {SERVICE_OPTIONS.map((svc) => (
          <button
            key={svc}
            type="button"
            onClick={() => onSelect(svc)}
            className={`px-3 py-2.5 rounded-lg border text-xs font-medium text-left transition-all duration-200 cursor-pointer ${
              selected === svc
                ? 'bg-primary-50 border-primary-400 text-primary-700 ring-1 ring-primary-400'
                : 'bg-white border-dark-200 text-dark-700 hover:bg-primary-50 hover:border-primary-200'
            }`}
          >
            {svc}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Step 3 -- Contact Information                                      */
/* ------------------------------------------------------------------ */

function StepContactInfo({
  formData,
  onChange,
  emailError,
  onEmailBlur,
}: {
  formData: ChatFormData;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  emailError: string;
  onEmailBlur: () => void;
}) {
  const inputClass =
    'w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-shadow placeholder:text-dark-400';

  return (
    <div className="p-5">
      <h4 className="text-base font-bold text-dark-800 mb-1">Contact Information</h4>
      <p className="text-xs text-dark-500 mb-4">How can we reach you?</p>
      <div className="space-y-3">
        {/* Name */}
        <div>
          <label htmlFor="wizard-name" className="block text-xs font-medium text-dark-600 mb-1">
            Name <span className="text-red-500">*</span>
          </label>
          <input
            id="wizard-name"
            name="name"
            type="text"
            required
            value={formData.name}
            onChange={onChange}
            placeholder="Your full name"
            className={`${inputClass} border-dark-200`}
          />
        </div>

        {/* Email */}
        <div>
          <label htmlFor="wizard-email" className="block text-xs font-medium text-dark-600 mb-1">
            Email <span className="text-red-500">*</span>
          </label>
          <input
            id="wizard-email"
            name="email"
            type="email"
            required
            value={formData.email}
            onChange={onChange}
            onBlur={onEmailBlur}
            placeholder="you@company.com"
            className={`${inputClass} ${emailError ? 'border-red-400 ring-1 ring-red-400' : 'border-dark-200'}`}
          />
          {emailError && <p className="text-red-500 text-xs mt-1">{emailError}</p>}
        </div>

        {/* Phone */}
        <div>
          <label htmlFor="wizard-phone" className="block text-xs font-medium text-dark-600 mb-1">
            Phone
          </label>
          <input
            id="wizard-phone"
            name="phone"
            type="tel"
            value={formData.phone}
            onChange={onChange}
            placeholder="(555) 123-4567"
            className={`${inputClass} border-dark-200`}
          />
        </div>

        {/* Company */}
        <div>
          <label htmlFor="wizard-company" className="block text-xs font-medium text-dark-600 mb-1">
            Company
          </label>
          <input
            id="wizard-company"
            name="company"
            type="text"
            value={formData.company}
            onChange={onChange}
            placeholder="Company name"
            className={`${inputClass} border-dark-200`}
          />
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Step 4 -- Message                                                  */
/* ------------------------------------------------------------------ */

const MESSAGE_HEADERS: Record<string, string> = {
  'General Inquiry': 'How can we help you?',
  'Demo Request': 'What would you like to see in the demo?',
  Consultation: 'Tell us about your project',
  Support: 'Describe the issue you\'re facing',
};

function StepMessage({
  formData,
  onMessageChange,
  onPriorityChange,
}: {
  formData: ChatFormData;
  onMessageChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onPriorityChange: (value: string) => void;
}) {
  const header = MESSAGE_HEADERS[formData.requestType] || 'Your Message';
  const isSupport = formData.requestType === 'Support';

  return (
    <div className="p-5">
      <h4 className="text-base font-bold text-dark-800 mb-1">{header}</h4>
      <p className="text-xs text-dark-500 mb-4">
        Please provide as much detail as possible.
      </p>

      <textarea
        name="message"
        required
        rows={5}
        value={formData.message}
        onChange={onMessageChange}
        placeholder="Type your message here..."
        className="w-full px-3 py-2 text-sm border border-dark-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-shadow resize-none placeholder:text-dark-400"
      />
      {formData.message.length > 0 && formData.message.length < 10 && (
        <p className="text-red-500 text-xs mt-1">Please enter at least 10 characters.</p>
      )}

      {isSupport && (
        <div className="mt-4">
          <label className="block text-xs font-medium text-dark-600 mb-2">Priority</label>
          <div className="flex gap-2">
            {PRIORITIES.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => onPriorityChange(p)}
                className={`flex-1 py-1.5 text-xs font-medium rounded-lg border transition-all duration-200 cursor-pointer ${
                  formData.priority === p
                    ? 'bg-primary-600 text-white border-primary-600'
                    : 'bg-white text-dark-600 border-dark-200 hover:bg-primary-50 hover:border-primary-200'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Step 5 -- Review & Submit                                          */
/* ------------------------------------------------------------------ */

function StepReview({
  formData,
  onEdit,
  onSubmit,
  isSubmitting,
  error,
}: {
  formData: ChatFormData;
  onEdit: (step: number) => void;
  onSubmit: () => void;
  isSubmitting: boolean;
  error: string;
}) {
  const sections = [
    { label: 'Request Type', value: formData.requestType, step: 1 },
    { label: 'Service Interest', value: formData.serviceInterest || 'Not specified', step: 2 },
    { label: 'Name', value: formData.name, step: 3 },
    { label: 'Email', value: formData.email, step: 3 },
    ...(formData.phone ? [{ label: 'Phone', value: formData.phone, step: 3 }] : []),
    ...(formData.company ? [{ label: 'Company', value: formData.company, step: 3 }] : []),
    { label: 'Message', value: formData.message, step: 4 },
    ...(formData.requestType === 'Support' ? [{ label: 'Priority', value: formData.priority, step: 4 }] : []),
  ];

  return (
    <div className="p-5">
      <h4 className="text-base font-bold text-dark-800 mb-1">Review & Submit</h4>
      <p className="text-xs text-dark-500 mb-4">Please verify your details before submitting.</p>

      <div className="bg-dark-50 rounded-xl p-4 space-y-3 mb-4 max-h-[260px] overflow-y-auto">
        {sections.map((s) => (
          <div key={s.label} className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <span className="block text-[10px] uppercase tracking-wide font-semibold text-dark-400">
                {s.label}
              </span>
              <span className="block text-sm text-dark-800 break-words leading-snug">
                {s.value}
              </span>
            </div>
            <button
              type="button"
              onClick={() => onEdit(s.step)}
              className="flex-shrink-0 flex items-center gap-1 text-primary-600 hover:text-primary-800 text-[11px] font-medium mt-1 cursor-pointer"
              aria-label={`Edit ${s.label}`}
            >
              <PencilIcon className="w-3 h-3" />
              Edit
            </button>
          </div>
        ))}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2 mb-3">
          {error}
        </div>
      )}

      <button
        type="button"
        onClick={onSubmit}
        disabled={isSubmitting}
        className="w-full py-2.5 px-4 bg-gradient-to-r from-primary-600 to-primary-700 text-white text-sm font-semibold rounded-lg hover:from-primary-700 hover:to-primary-800 transition-all duration-200 shadow-md hover:shadow-lg disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
      >
        {isSubmitting ? (
          <>
            <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            Submitting...
          </>
        ) : (
          <>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
            Submit Request
          </>
        )}
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Success Screen                                                     */
/* ------------------------------------------------------------------ */

function SuccessScreen() {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6">
      <div className="w-16 h-16 bg-accent-100 rounded-full flex items-center justify-center mb-4 animate-[bounceIn_0.5s_ease-out]">
        <svg className="w-8 h-8 text-accent-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2.5}
            d="M5 13l4 4L19 7"
            style={{
              strokeDasharray: 24,
              strokeDashoffset: 24,
              animation: 'drawCheck 0.4s ease-out 0.2s forwards',
            }}
          />
        </svg>
      </div>
      <h4 className="text-lg font-semibold text-dark-800 mb-2">Thank you!</h4>
      <p className="text-dark-500 text-sm text-center">
        We&apos;ll be in touch within 24 hours.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Widget                                                        */
/* ------------------------------------------------------------------ */

export default function ChatWidget() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState<ChatFormData>(initialFormData);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState('');
  const [emailError, setEmailError] = useState('');

  // Hide on admin and auth pages
  const isHiddenPage = pathname.startsWith('/admin') || pathname.startsWith('/auth');

  // Auto-close after success
  useEffect(() => {
    if (!isSuccess) return;
    const timer = setTimeout(() => {
      setIsSuccess(false);
      setFormData(initialFormData);
      setStep(1);
      setIsOpen(false);
    }, 4000);
    return () => clearTimeout(timer);
  }, [isSuccess]);

  // Reset wizard when panel is closed
  const handleToggle = useCallback(() => {
    setIsOpen((prev) => {
      if (prev) {
        // Closing -- reset after the panel animation finishes
        setTimeout(() => {
          setStep(1);
          setFormData(initialFormData);
          setError('');
          setEmailError('');
          setIsSuccess(false);
        }, 300);
      }
      return !prev;
    });
  }, []);

  /* -- Field handlers -- */

  const handleFieldChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const { name, value } = e.target;
      setFormData((prev) => ({ ...prev, [name]: value }));
      if (error) setError('');
      if (name === 'email' && emailError) setEmailError('');
    },
    [error, emailError],
  );

  const validateEmail = useCallback(() => {
    if (formData.email && !EMAIL_REGEX.test(formData.email)) {
      setEmailError('Please enter a valid email');
    } else {
      setEmailError('');
    }
  }, [formData.email]);

  /* -- Navigation helpers -- */

  const goNext = useCallback(() => setStep((s) => Math.min(s + 1, TOTAL_STEPS)), []);
  const goBack = useCallback(() => setStep((s) => Math.max(s - 1, 1)), []);
  const goTo = useCallback((s: number) => setStep(s), []);

  /* -- Step 1 handler -- */

  const handleRequestType = useCallback(
    (value: string) => {
      setFormData((prev) => ({ ...prev, requestType: value }));
      // Support skips service selection
      if (value === 'Support') {
        setStep(3);
      } else {
        goNext();
      }
    },
    [goNext],
  );

  /* -- Step 2 handler -- */

  const handleServiceSelect = useCallback(
    (value: string) => {
      setFormData((prev) => ({ ...prev, serviceInterest: value }));
      goNext();
    },
    [goNext],
  );

  /* -- Can advance from step 3? -- */

  const canAdvanceStep3 = formData.name.trim().length > 0 && EMAIL_REGEX.test(formData.email);

  /* -- Can advance from step 4? -- */

  const canAdvanceStep4 = formData.message.trim().length >= 10;

  /* -- Submit -- */

  const handleSubmit = useCallback(async () => {
    setError('');
    setIsSubmitting(true);
    try {
      await chatRequestApi.submit({
        name: formData.name.trim(),
        email: formData.email.trim(),
        phone: formData.phone.trim() || undefined,
        company: formData.company.trim() || undefined,
        requestType: formData.requestType,
        serviceInterest: formData.serviceInterest || undefined,
        priority: formData.requestType === 'Support' ? formData.priority : undefined,
        message: formData.message.trim(),
      });
      setIsSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }, [formData]);

  /* -- Render guard -- */

  if (isHiddenPage) return null;

  /* -- Step titles for the header bar -- */
  const stepTitles: Record<number, string> = {
    1: 'Get Started',
    2: 'Service Interest',
    3: 'Contact Info',
    4: 'Your Message',
    5: 'Review',
  };

  return (
    <div className="chat-widget">
      {/* ------- Panel ------- */}
      <div
        className={`absolute bottom-[72px] right-0 w-[calc(100vw-32px)] sm:w-[400px] transition-all duration-300 ease-out origin-bottom-right ${
          isOpen
            ? 'opacity-100 scale-100 translate-y-0 pointer-events-auto'
            : 'opacity-0 scale-95 translate-y-4 pointer-events-none'
        }`}
      >
        <div className="bg-white rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[min(600px,calc(100vh-120px))]">
          {/* Header */}
          <div className="gradient-bg px-4 py-3 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-2">
              {step > 1 && !isSuccess && (
                <button
                  type="button"
                  onClick={goBack}
                  className="text-white/80 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/10 cursor-pointer"
                  aria-label="Go back"
                >
                  <ArrowLeftIcon className="w-4 h-4" />
                </button>
              )}
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                  <ChatBubbleIcon className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h3 className="text-white font-semibold text-sm">
                    {isSuccess ? 'Request Sent' : stepTitles[step]}
                  </h3>
                  <p className="text-white/70 text-[10px]">SohamYoga</p>
                </div>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-white/80 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/10 cursor-pointer"
              aria-label="Close chat"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Progress Dots */}
          {!isSuccess && <ProgressDots current={step} total={TOTAL_STEPS} />}

          {/* Body */}
          <div className="flex-1 overflow-y-auto">
            {isSuccess ? (
              <SuccessScreen />
            ) : (
              <div className="transition-all duration-300">
                {/* Step 1 */}
                {step === 1 && <StepRequestType onSelect={handleRequestType} />}

                {/* Step 2 */}
                {step === 2 && (
                  <StepServiceInterest
                    selected={formData.serviceInterest}
                    onSelect={handleServiceSelect}
                  />
                )}

                {/* Step 3 */}
                {step === 3 && (
                  <>
                    <StepContactInfo
                      formData={formData}
                      onChange={handleFieldChange}
                      emailError={emailError}
                      onEmailBlur={validateEmail}
                    />
                    <div className="px-5 pb-5">
                      <button
                        type="button"
                        onClick={goNext}
                        disabled={!canAdvanceStep3}
                        className="w-full py-2.5 px-4 bg-gradient-to-r from-primary-600 to-primary-700 text-white text-sm font-semibold rounded-lg hover:from-primary-700 hover:to-primary-800 transition-all duration-200 shadow-md hover:shadow-lg disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                      >
                        Continue
                      </button>
                    </div>
                  </>
                )}

                {/* Step 4 */}
                {step === 4 && (
                  <>
                    <StepMessage
                      formData={formData}
                      onMessageChange={handleFieldChange}
                      onPriorityChange={(val) => setFormData((prev) => ({ ...prev, priority: val }))}
                    />
                    <div className="px-5 pb-5">
                      <button
                        type="button"
                        onClick={goNext}
                        disabled={!canAdvanceStep4}
                        className="w-full py-2.5 px-4 bg-gradient-to-r from-primary-600 to-primary-700 text-white text-sm font-semibold rounded-lg hover:from-primary-700 hover:to-primary-800 transition-all duration-200 shadow-md hover:shadow-lg disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                      >
                        Review
                      </button>
                    </div>
                  </>
                )}

                {/* Step 5 */}
                {step === 5 && (
                  <StepReview
                    formData={formData}
                    onEdit={goTo}
                    onSubmit={handleSubmit}
                    isSubmitting={isSubmitting}
                    error={error}
                  />
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ------- Floating Button ------- */}
      <button
        onClick={handleToggle}
        className={`relative w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:ring-offset-2 cursor-pointer ${
          isOpen
            ? 'bg-dark-700 hover:bg-dark-800 rotate-0'
            : 'bg-gradient-to-br from-primary-500 to-primary-700 hover:from-primary-600 hover:to-primary-800'
        }`}
        aria-label={isOpen ? 'Close chat' : 'Open chat'}
      >
        {/* Pulse ring (only when closed) */}
        {!isOpen && (
          <span className="absolute inset-0 rounded-full bg-primary-500 opacity-30 animate-ping" />
        )}

        {/* Icon transition: X when open */}
        <span
          className={`absolute inset-0 flex items-center justify-center transition-all duration-300 ${
            isOpen ? 'opacity-100 rotate-0' : 'opacity-0 rotate-90'
          }`}
        >
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </span>

        {/* Icon transition: Chat bubble when closed */}
        <span
          className={`absolute inset-0 flex items-center justify-center transition-all duration-300 ${
            isOpen ? 'opacity-0 -rotate-90' : 'opacity-100 rotate-0'
          }`}
        >
          <ChatBubbleIcon className="w-6 h-6 text-white" />
        </span>

        {/* Badge */}
        {!isOpen && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-accent-500 rounded-full flex items-center justify-center text-white text-[10px] font-bold shadow-sm border-2 border-white">
            ?
          </span>
        )}
      </button>

      {/* Keyframe animations */}
      <style jsx>{`
        @keyframes drawCheck {
          to {
            stroke-dashoffset: 0;
          }
        }
        @keyframes bounceIn {
          0% {
            opacity: 0;
            transform: scale(0.3);
          }
          50% {
            opacity: 1;
            transform: scale(1.05);
          }
          70% {
            transform: scale(0.9);
          }
          100% {
            transform: scale(1);
          }
        }
      `}</style>
    </div>
  );
}
