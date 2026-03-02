import Header from "@/components/Header";
import Footer from "@/components/Footer";
import BackToHome from "@/components/BackToHome";
import { Card, CardContent } from "@/components/ui/card";

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header title="Privacy Policy" showBack />
      <main className="flex-1 container mx-auto px-4 py-8">
        <div className="mb-4">
          <BackToHome />
        </div>
        <div className="max-w-3xl mx-auto">
          <Card>
            <CardContent className="pt-6 prose prose-sm dark:prose-invert max-w-none" data-testid="content-privacy-policy">
              <h1 className="text-2xl font-bold mb-2">Privacy Policy</h1>
              <p className="text-sm text-muted-foreground mb-6">
                Last Updated: January 1, 2025 | Version 1.0
              </p>
              <p className="text-sm text-destructive mb-6">
                NOTICE: This is a template document and should be reviewed and customized by a qualified attorney before use. This document does not constitute legal advice.
              </p>

              <h2 className="text-xl font-semibold mt-6 mb-3">1. Data Collection</h2>
              <p className="mb-2 text-sm leading-relaxed">CareHub collects the following types of information:</p>
              <ul className="list-disc pl-6 mb-4 text-sm space-y-1">
                <li><strong>Personal Information:</strong> Name, email address, phone number, and account credentials</li>
                <li><strong>Location Data:</strong> Real-time GPS location during active rides for navigation and safety purposes</li>
                <li><strong>Medical Information:</strong> Mobility needs, medical notes, and other health-related information provided during booking (subject to HIPAA protections)</li>
                <li><strong>Payment Information:</strong> Credit/debit card details, billing address, and transaction history</li>
                <li><strong>Device Information:</strong> Device type, operating system, browser type, and unique device identifiers</li>
                <li><strong>Usage Data:</strong> Ride history, app interactions, preferences, and communication records</li>
                <li><strong>Driver Documentation:</strong> Driver's license, vehicle registration, insurance documents, and background check information</li>
              </ul>

              <h2 className="text-xl font-semibold mt-6 mb-3">2. HIPAA Compliance Notice</h2>
              <p className="mb-4 text-sm leading-relaxed">
                CareHub is committed to protecting the privacy and security of Protected Health Information (PHI) as required by the Health Insurance Portability and Accountability Act (HIPAA) and its implementing regulations. As a provider of non-emergency medical transportation services, CareHub may be considered a Business Associate under HIPAA when working with covered entities such as healthcare providers and insurance companies.
              </p>
              <p className="mb-2 text-sm leading-relaxed">Our HIPAA compliance measures include:</p>
              <ul className="list-disc pl-6 mb-4 text-sm space-y-1">
                <li>Encryption of all PHI in transit and at rest</li>
                <li>Access controls and audit logging for all PHI access</li>
                <li>Regular security risk assessments</li>
                <li>Workforce training on HIPAA requirements</li>
                <li>Business Associate Agreements (BAAs) with all applicable partners and subcontractors</li>
                <li>Incident response procedures for potential breaches</li>
                <li>Minimum necessary standard applied to all PHI disclosures</li>
              </ul>

              <h2 className="text-xl font-semibold mt-6 mb-3">3. Data Sharing</h2>
              <p className="mb-2 text-sm leading-relaxed">CareHub may share your information with:</p>
              <ul className="list-disc pl-6 mb-4 text-sm space-y-1">
                <li><strong>Drivers:</strong> Pickup/dropoff locations, patient name, phone number, and relevant mobility or medical notes necessary for safe transportation</li>
                <li><strong>Healthcare Providers:</strong> Ride status, completion confirmation, and transportation records as required for care coordination</li>
                <li><strong>Insurance Companies:</strong> Trip details and documentation required for claims processing and reimbursement</li>
                <li><strong>Payment Processors:</strong> Payment information necessary to process transactions (e.g., Stripe)</li>
                <li><strong>Law Enforcement:</strong> Information required by law, subpoena, court order, or to protect safety</li>
                <li><strong>Service Providers:</strong> Third-party vendors who assist in operating our platform (subject to confidentiality agreements)</li>
              </ul>
              <p className="mb-4 text-sm leading-relaxed">
                We do not sell your personal information to third parties. We do not share your information with third parties for their direct marketing purposes.
              </p>

              <h2 className="text-xl font-semibold mt-6 mb-3">4. Data Retention</h2>
              <p className="mb-2 text-sm leading-relaxed">We retain your information for the following periods:</p>
              <ul className="list-disc pl-6 mb-4 text-sm space-y-1">
                <li><strong>Account Information:</strong> Retained for the duration of your account plus 3 years after account closure</li>
                <li><strong>Ride History:</strong> Retained for 7 years for tax, insurance, and legal compliance purposes</li>
                <li><strong>Medical Information (PHI):</strong> Retained for 6 years as required by HIPAA regulations</li>
                <li><strong>Payment Records:</strong> Retained for 7 years for tax and financial compliance</li>
                <li><strong>Location Data:</strong> Active ride location data is retained for 90 days; aggregated/anonymized data may be retained longer</li>
                <li><strong>Driver Documents:</strong> Retained for the duration of the driver's engagement plus 5 years</li>
                <li><strong>Audit Logs:</strong> Retained for 6 years for compliance and security purposes</li>
              </ul>

              <h2 className="text-xl font-semibold mt-6 mb-3">5. User Rights</h2>
              <p className="mb-2 text-sm leading-relaxed">You have the following rights regarding your personal information:</p>
              <ul className="list-disc pl-6 mb-4 text-sm space-y-1">
                <li><strong>Right to Access:</strong> You may request a copy of the personal information we hold about you</li>
                <li><strong>Right to Correction:</strong> You may request correction of inaccurate or incomplete information</li>
                <li><strong>Right to Deletion:</strong> You may request deletion of your personal information, subject to legal retention requirements</li>
                <li><strong>Right to Data Portability:</strong> You may request your data in a structured, machine-readable format</li>
                <li><strong>Right to Restrict Processing:</strong> You may request that we limit how we use your information</li>
                <li><strong>Right to Object:</strong> You may object to certain types of processing of your information</li>
                <li><strong>Right to Withdraw Consent:</strong> Where processing is based on consent, you may withdraw your consent at any time</li>
                <li><strong>HIPAA Rights:</strong> If applicable, you have the right to access, amend, and receive an accounting of disclosures of your PHI</li>
              </ul>
              <p className="mb-4 text-sm leading-relaxed">
                To exercise any of these rights, please contact us at privacy@carehubapp.com. We will respond to your request within 30 days.
              </p>

              <h2 className="text-xl font-semibold mt-6 mb-3">6. Security Measures</h2>
              <p className="mb-4 text-sm leading-relaxed">
                We implement industry-standard security measures to protect your information, including encryption (TLS 1.2+), secure authentication, access controls, regular security audits, and continuous monitoring. However, no method of transmission over the Internet or electronic storage is 100% secure, and we cannot guarantee absolute security.
              </p>

              <h2 className="text-xl font-semibold mt-6 mb-3">7. Children's Privacy</h2>
              <p className="mb-4 text-sm leading-relaxed">
                CareHub does not knowingly collect personal information from children under 13. If we learn that we have collected information from a child under 13, we will promptly delete it. If you believe a child under 13 has provided us with personal information, please contact us at privacy@carehubapp.com.
              </p>

              <h2 className="text-xl font-semibold mt-6 mb-3">8. Changes to This Policy</h2>
              <p className="mb-4 text-sm leading-relaxed">
                We may update this Privacy Policy from time to time. We will notify you of material changes via email or in-app notification. Your continued use of CareHub after such changes constitutes acceptance of the updated policy.
              </p>

              <h2 className="text-xl font-semibold mt-6 mb-3">9. Contact Information</h2>
              <p className="mb-4 text-sm leading-relaxed">
                For questions about this Privacy Policy or to exercise your privacy rights, please contact us at privacy@carehubapp.com.
              </p>
            </CardContent>
          </Card>
        </div>
      </main>
      <Footer />
    </div>
  );
}
