import { Metadata } from 'next';
import ContactForm from '@/components/contact/ContactForm';

export const metadata: Metadata = {
  title: 'Contact Us',
  description: 'Get in touch with SohamYoga for IT solutions, AI/ML services, and digital transformation consulting. Based in Calgary, Alberta.',
  openGraph: {
    title: 'Contact Us - SohamYoga',
    description: 'Get in touch with SohamYoga for IT solutions, AI/ML services, and digital transformation consulting.',
  },
};

export default function ContactPage() {
  return (
    <>
      {/* Hero Section */}
      <section className="gradient-bg pt-32 pb-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
            Get in Touch
          </h1>
          <p className="text-lg text-primary-200 max-w-2xl mx-auto">
            Have a project in mind or want to learn more about our services?
            We would love to hear from you.
          </p>
        </div>
      </section>

      {/* Contact Content */}
      <section className="py-16 bg-dark-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
            {/* Contact Form */}
            <div className="lg:col-span-2">
              <div className="bg-white rounded-xl shadow-lg p-8 border border-dark-100">
                <h2 className="text-2xl font-bold text-dark-900 mb-2">Send Us a Message</h2>
                <p className="text-dark-500 mb-8">
                  Fill out the form below and we will respond within 24 hours.
                </p>
                <ContactForm />
              </div>
            </div>

            {/* Sidebar Info */}
            <div className="lg:col-span-1 space-y-6">
              {/* Contact Info Card */}
              <div className="bg-white rounded-xl shadow-lg p-6 border border-dark-100">
                <h3 className="text-lg font-bold text-dark-900 mb-6">Contact Information</h3>

                <div className="space-y-5">
                  {/* Address */}
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <svg className="w-5 h-5 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </div>
                    <div>
                      <p className="font-medium text-dark-900 text-sm">Office Address</p>
                      <p className="text-dark-500 text-sm mt-0.5">
                        Calgary, Alberta<br />
                        Canada
                      </p>
                    </div>
                  </div>

                  {/* Email */}
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 bg-accent-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <svg className="w-5 h-5 text-accent-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <div>
                      <p className="font-medium text-dark-900 text-sm">Email</p>
                      <a
                        href="mailto:info@slpsystems.ca"
                        className="text-primary-600 hover:text-primary-700 text-sm mt-0.5 block"
                      >
                        info@slpsystems.ca
                      </a>
                    </div>
                  </div>

                  {/* Phone */}
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <svg className="w-5 h-5 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                      </svg>
                    </div>
                    <div>
                      <p className="font-medium text-dark-900 text-sm">Phone</p>
                      <p className="text-dark-500 text-sm mt-0.5">Available on request</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Business Hours Card */}
              <div className="bg-white rounded-xl shadow-lg p-6 border border-dark-100">
                <h3 className="text-lg font-bold text-dark-900 mb-4">Business Hours</h3>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-dark-500">Monday - Friday</span>
                    <span className="font-medium text-dark-800">9:00 AM - 5:00 PM</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-dark-500">Saturday</span>
                    <span className="font-medium text-dark-800">By Appointment</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-dark-500">Sunday</span>
                    <span className="font-medium text-dark-800">Closed</span>
                  </div>
                  <div className="pt-3 border-t border-dark-100">
                    <p className="text-dark-400 text-xs">
                      All times in Mountain Standard Time (MST)
                    </p>
                  </div>
                </div>
              </div>

              {/* Quick Response Promise */}
              <div className="bg-gradient-to-br from-primary-600 to-primary-800 rounded-xl p-6 text-white">
                <div className="flex items-center gap-3 mb-3">
                  <svg className="w-8 h-8 text-accent-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  <h3 className="font-bold text-lg">Quick Response</h3>
                </div>
                <p className="text-primary-200 text-sm leading-relaxed">
                  We aim to respond to all inquiries within 24 hours. For urgent matters,
                  please indicate so in your message.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Map Placeholder */}
      <section className="bg-dark-200">
        <div className="max-w-7xl mx-auto">
          <div className="h-80 bg-dark-100 flex items-center justify-center">
            <div className="text-center">
              <svg className="w-16 h-16 text-dark-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <p className="text-dark-400 font-medium">Calgary, Alberta, Canada</p>
              <p className="text-dark-300 text-sm mt-1">Map integration available</p>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-16 bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl md:text-3xl font-bold text-dark-900 text-center mb-10">
            Frequently Asked Questions
          </h2>

          <div className="space-y-4">
            {[
              {
                q: 'What services does SohamYoga offer?',
                a: 'We offer a comprehensive range of IT services including Generative AI, Machine Learning, Deep Learning, Computer Vision, Managed IT Services, and Custom Software Development.',
              },
              {
                q: 'How long does a typical project take?',
                a: 'Project timelines vary based on complexity and scope. Small projects may take 2-4 weeks, while larger enterprise solutions can span several months. We provide detailed timelines during the consultation phase.',
              },
              {
                q: 'Do you work with businesses outside of Calgary?',
                a: 'Yes! While we are based in Calgary, Alberta, we work with clients across Canada and internationally. Our team is experienced with remote collaboration and project management.',
              },
              {
                q: 'How do I get started with a project?',
                a: 'Simply fill out the contact form above or email us directly. We will schedule an initial consultation to understand your needs and provide a tailored proposal.',
              },
            ].map((faq, idx) => (
              <div key={idx} className="bg-dark-50 rounded-lg p-6 border border-dark-100">
                <h3 className="font-semibold text-dark-900 mb-2">{faq.q}</h3>
                <p className="text-dark-500 text-sm leading-relaxed">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
