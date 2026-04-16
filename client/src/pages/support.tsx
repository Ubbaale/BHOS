import { useState } from "react";
import { Link } from "wouter";
import { Mail, Phone, MessageCircle, FileText, Shield, HelpCircle, ChevronDown, ChevronUp, ExternalLink } from "lucide-react";

const faqs = [
  {
    question: "How do I book a medical ride?",
    answer: "Download the CareHub app or visit our website. Create an account, then tap 'Book Ride' from the home screen. Enter your pickup and drop-off locations, select your vehicle type, and confirm your booking.",
  },
  {
    question: "How do I become a CareHub driver?",
    answer: "Go to the Driver section and tap 'Apply'. Complete the application with your personal information, vehicle details, and insurance. Our team will review your application within 2-3 business days.",
  },
  {
    question: "How do I cancel a ride?",
    answer: "You can cancel a ride from your ride detail screen before the driver arrives. Please note that cancellations made after the driver is en route may incur a cancellation fee per our cancellation policy.",
  },
  {
    question: "How does payment work?",
    answer: "CareHub uses Stripe for secure payment processing. Your fare is calculated based on distance and vehicle type. You can pay by credit/debit card. Drivers receive payouts weekly or can request instant payouts.",
  },
  {
    question: "Is my health information protected?",
    answer: "Yes. CareHub is HIPAA-compliant. All personal health information is encrypted in transit and at rest. We never share your medical information with unauthorized parties.",
  },
  {
    question: "How do I delete my account?",
    answer: "You can delete your account from the app by going to Settings > Delete Account. On the website, go to your profile settings and select 'Delete Account'. This action is permanent and cannot be undone.",
  },
  {
    question: "What IT services does CareHub offer?",
    answer: "CareHub provides a FieldNation-style dispatch system for healthcare IT. Facilities can submit service tickets, and certified IT technicians can accept and complete work orders with real-time tracking.",
  },
  {
    question: "How does the medical courier service work?",
    answer: "Healthcare facilities can dispatch medical courier deliveries through CareHub. Drivers with proper certifications can accept delivery jobs with specific requirements for temperature control, chain of custody, and HIPAA compliance.",
  },
];

export default function SupportPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/">
            <div className="flex items-center gap-2 cursor-pointer" data-testid="link-home">
              <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">C</span>
              </div>
              <span className="text-lg font-bold text-gray-900">CareHub</span>
            </div>
          </Link>
          <Link href="/contact">
            <span className="text-indigo-600 font-medium hover:underline cursor-pointer" data-testid="link-contact">Contact Us</span>
          </Link>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-12">
        <div className="text-center mb-12">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4" data-testid="text-support-title">
            Help & Support
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Need help with CareHub? Find answers below or reach out to our support team.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 mb-16">
          <a
            href="mailto:support@carehubapp.com"
            className="bg-white rounded-xl p-6 border border-gray-200 hover:border-indigo-300 hover:shadow-md transition-all text-center"
            data-testid="link-email-support"
          >
            <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center mx-auto mb-4">
              <Mail className="w-6 h-6 text-indigo-600" />
            </div>
            <h3 className="font-semibold text-gray-900 mb-1">Email Support</h3>
            <p className="text-sm text-gray-500">support@carehubapp.com</p>
            <p className="text-xs text-gray-400 mt-2">Response within 24 hours</p>
          </a>

          <a
            href="tel:+18001234567"
            className="bg-white rounded-xl p-6 border border-gray-200 hover:border-indigo-300 hover:shadow-md transition-all text-center"
            data-testid="link-phone-support"
          >
            <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center mx-auto mb-4">
              <Phone className="w-6 h-6 text-green-600" />
            </div>
            <h3 className="font-semibold text-gray-900 mb-1">Phone Support</h3>
            <p className="text-sm text-gray-500">1-800-CAREHUB</p>
            <p className="text-xs text-gray-400 mt-2">Mon-Fri, 8am-6pm EST</p>
          </a>

          <Link href="/contact">
            <div
              className="bg-white rounded-xl p-6 border border-gray-200 hover:border-indigo-300 hover:shadow-md transition-all text-center cursor-pointer h-full"
              data-testid="link-contact-form"
            >
              <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center mx-auto mb-4">
                <MessageCircle className="w-6 h-6 text-purple-600" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-1">Contact Form</h3>
              <p className="text-sm text-gray-500">Send us a message</p>
              <p className="text-xs text-gray-400 mt-2">We'll get back to you shortly</p>
            </div>
          </Link>
        </div>

        <div className="mb-16">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center" data-testid="text-faq-title">
            Frequently Asked Questions
          </h2>
          <div className="max-w-3xl mx-auto space-y-3">
            {faqs.map((faq, i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-gray-50 transition-colors"
                  data-testid={`button-faq-${i}`}
                >
                  <span className="font-medium text-gray-900 pr-4">{faq.question}</span>
                  {openFaq === i ? (
                    <ChevronUp className="w-5 h-5 text-gray-400 flex-shrink-0" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-gray-400 flex-shrink-0" />
                  )}
                </button>
                {openFaq === i && (
                  <div className="px-6 pb-4 text-gray-600 text-sm leading-relaxed border-t border-gray-100 pt-3">
                    {faq.answer}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6 mb-16">
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <Shield className="w-5 h-5 text-blue-600" />
              </div>
              <h3 className="font-semibold text-gray-900">Safety & Security</h3>
            </div>
            <p className="text-sm text-gray-600 mb-3">
              Your safety is our priority. All drivers are background-checked, vehicles are inspected, and rides include real-time GPS tracking.
            </p>
            <p className="text-sm text-gray-600">
              Emergency? Use the SOS button in the app during any ride, or call 911 directly.
            </p>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                <FileText className="w-5 h-5 text-amber-600" />
              </div>
              <h3 className="font-semibold text-gray-900">Legal & Policies</h3>
            </div>
            <div className="space-y-2">
              <Link href="/terms">
                <span className="flex items-center gap-2 text-sm text-indigo-600 hover:underline cursor-pointer" data-testid="link-terms">
                  <ExternalLink className="w-3 h-3" /> Terms of Service
                </span>
              </Link>
              <Link href="/privacy">
                <span className="flex items-center gap-2 text-sm text-indigo-600 hover:underline cursor-pointer" data-testid="link-privacy">
                  <ExternalLink className="w-3 h-3" /> Privacy Policy
                </span>
              </Link>
            </div>
          </div>
        </div>

        <div className="bg-indigo-50 rounded-2xl p-8 text-center border border-indigo-100">
          <HelpCircle className="w-10 h-10 text-indigo-600 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-gray-900 mb-2">Still need help?</h3>
          <p className="text-gray-600 mb-6 max-w-md mx-auto">
            Our support team is here to assist you. Reach out and we'll get back to you as soon as possible.
          </p>
          <Link href="/contact">
            <button
              className="bg-indigo-600 text-white px-8 py-3 rounded-xl font-medium hover:bg-indigo-700 transition-colors"
              data-testid="button-contact-support"
            >
              Contact Support
            </button>
          </Link>
        </div>
      </main>

      <footer className="bg-white border-t border-gray-200 mt-16 py-8">
        <div className="max-w-5xl mx-auto px-4 text-center text-sm text-gray-500">
          <p>&copy; {new Date().getFullYear()} CareHub. All rights reserved.</p>
          <div className="flex items-center justify-center gap-4 mt-3">
            <Link href="/terms"><span className="hover:text-indigo-600 cursor-pointer">Terms</span></Link>
            <Link href="/privacy"><span className="hover:text-indigo-600 cursor-pointer">Privacy</span></Link>
            <Link href="/contact"><span className="hover:text-indigo-600 cursor-pointer">Contact</span></Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
