import Header from "@/components/Header";
import Footer from "@/components/Footer";
import BackToHome from "@/components/BackToHome";
import { Card, CardContent } from "@/components/ui/card";

export default function TermsOfService() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header title="Terms of Service" showBack />
      <main className="flex-1 container mx-auto px-4 py-8">
        <div className="mb-4">
          <BackToHome />
        </div>
        <div className="max-w-3xl mx-auto">
          <Card>
            <CardContent className="pt-6 prose prose-sm dark:prose-invert max-w-none" data-testid="content-terms-of-service">
              <h1 className="text-2xl font-bold mb-2">Terms of Service</h1>
              <p className="text-sm text-muted-foreground mb-6">
                Last Updated: January 1, 2025 | Version 1.0
              </p>
              <p className="text-sm text-destructive mb-6">
                NOTICE: This is a template document and should be reviewed and customized by a qualified attorney before use. This document does not constitute legal advice.
              </p>

              <h2 className="text-xl font-semibold mt-6 mb-3">1. Platform Description</h2>
              <p className="mb-4 text-sm leading-relaxed">
                CareHub ("Platform", "we", "us") is a technology platform that connects patients and healthcare facilities with independent medical transportation providers ("Drivers"). CareHub facilitates the scheduling and coordination of non-emergency medical transportation (NEMT) services. CareHub does not itself provide transportation services, employ drivers, or operate a fleet of vehicles.
              </p>

              <h2 className="text-xl font-semibold mt-6 mb-3">2. User Obligations</h2>
              <p className="mb-2 text-sm leading-relaxed">By using CareHub, you agree to:</p>
              <ul className="list-disc pl-6 mb-4 text-sm space-y-1">
                <li>Provide accurate and complete information during registration and booking</li>
                <li>Maintain the confidentiality of your account credentials</li>
                <li>Not use the platform for any unlawful purpose</li>
                <li>Treat all Drivers, patients, and platform users with respect</li>
                <li>Comply with all applicable local, state, and federal laws</li>
                <li>Not interfere with or disrupt the platform's functionality</li>
                <li>Promptly report any safety concerns or incidents through the platform</li>
              </ul>

              <h2 className="text-xl font-semibold mt-6 mb-3">3. Independent Contractor Relationship</h2>
              <p className="mb-4 text-sm leading-relaxed">
                Drivers using the CareHub platform are independent contractors and are not employees, agents, or representatives of CareHub. CareHub does not control the manner or method by which Drivers perform transportation services. Drivers maintain full control over their work schedules, routes, and the equipment used to provide services. Nothing in these Terms creates an employment, partnership, joint venture, or agency relationship between CareHub and any Driver.
              </p>

              <h2 className="text-xl font-semibold mt-6 mb-3">4. Limitation of Liability</h2>
              <p className="mb-4 text-sm leading-relaxed">
                TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, CAREHUB SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING BUT NOT LIMITED TO LOSS OF PROFITS, DATA, USE, GOODWILL, OR OTHER INTANGIBLE LOSSES, RESULTING FROM: (A) YOUR ACCESS TO OR USE OF OR INABILITY TO ACCESS OR USE THE PLATFORM; (B) ANY CONDUCT OR CONTENT OF ANY THIRD PARTY ON THE PLATFORM; (C) ANY TRANSPORTATION SERVICES PROVIDED BY DRIVERS; (D) UNAUTHORIZED ACCESS, USE, OR ALTERATION OF YOUR TRANSMISSIONS OR CONTENT. IN NO EVENT SHALL CAREHUB'S TOTAL LIABILITY EXCEED THE AMOUNTS PAID BY YOU TO CAREHUB IN THE TWELVE (12) MONTHS PRECEDING THE CLAIM.
              </p>

              <h2 className="text-xl font-semibold mt-6 mb-3">5. Arbitration Clause</h2>
              <p className="mb-4 text-sm leading-relaxed">
                Any dispute, controversy, or claim arising out of or relating to these Terms, or the breach, termination, or invalidity thereof, shall be settled by binding arbitration in accordance with the rules of the American Arbitration Association. The arbitration shall take place in the state where CareHub maintains its principal office. Each party shall bear its own costs of arbitration. The arbitrator's decision shall be final and binding. You agree to waive your right to participate in a class action lawsuit or class-wide arbitration against CareHub.
              </p>

              <h2 className="text-xl font-semibold mt-6 mb-3">6. Data Usage</h2>
              <p className="mb-4 text-sm leading-relaxed">
                By using CareHub, you consent to the collection, use, and sharing of your personal information as described in our Privacy Policy. This includes, but is not limited to: location data during active rides, contact information, ride history, payment information, and device information. We use this data to provide and improve our services, ensure safety, process payments, and comply with legal obligations. For full details on data handling, please refer to our Privacy Policy.
              </p>

              <h2 className="text-xl font-semibold mt-6 mb-3">7. Cancellation and Refund Policy</h2>
              <p className="mb-2 text-sm leading-relaxed">Cancellation terms vary based on timing:</p>
              <ul className="list-disc pl-6 mb-4 text-sm space-y-1">
                <li>Cancellations made within 5 minutes of booking are free of charge</li>
                <li>Cancellations made within 2 minutes of driver assignment are free of charge</li>
                <li>Late cancellations may incur a cancellation fee as determined by the applicable cancellation policy</li>
                <li>If a Driver does not arrive within 15 minutes of the scheduled pickup time, the ride may be cancelled without charge</li>
                <li>Refunds for paid rides will be processed within 5-10 business days to the original payment method</li>
                <li>CareHub reserves the right to adjust fees and policies at any time with reasonable notice to users</li>
              </ul>

              <h2 className="text-xl font-semibold mt-6 mb-3">8. Account Suspension and Termination</h2>
              <p className="mb-4 text-sm leading-relaxed">
                CareHub reserves the right to suspend or terminate your account at any time for violation of these Terms, fraudulent activity, safety concerns, or any other reason deemed appropriate. Users may deactivate their accounts at any time by contacting support. Suspension or termination does not relieve you of any outstanding payment obligations.
              </p>

              <h2 className="text-xl font-semibold mt-6 mb-3">9. Modifications to Terms</h2>
              <p className="mb-4 text-sm leading-relaxed">
                CareHub reserves the right to modify these Terms at any time. We will notify users of material changes via email or in-app notification. Continued use of the platform after such modifications constitutes acceptance of the updated Terms. If you do not agree to the modified Terms, you must discontinue use of the platform.
              </p>

              <h2 className="text-xl font-semibold mt-6 mb-3">10. Governing Law</h2>
              <p className="mb-4 text-sm leading-relaxed">
                These Terms shall be governed by and construed in accordance with the laws of the state in which CareHub maintains its principal office, without regard to conflict of law principles.
              </p>

              <h2 className="text-xl font-semibold mt-6 mb-3">11. Contact Information</h2>
              <p className="mb-4 text-sm leading-relaxed">
                For questions about these Terms of Service, please contact us at legal@carehubapp.com.
              </p>
            </CardContent>
          </Card>
        </div>
      </main>
      <Footer />
    </div>
  );
}
