import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Shield, Pill, FileCheck, DollarSign, BarChart3, Link2, ClipboardList, Users } from "lucide-react";
import bhosLogoImg from "@assets/image_1776016702639.png";

const bhosFeatures = [
  {
    icon: Pill,
    title: "Medication Safety",
    description: "Electronic MAR with barcode scanning, automated alerts for missed doses, drug interactions, and real-time compliance dashboards.",
  },
  {
    icon: FileCheck,
    title: "Clinical Compliance",
    description: "Automated documentation for state audits, incident reporting, treatment plans, and regulatory requirements — always inspection-ready.",
  },
  {
    icon: DollarSign,
    title: "Billing & Revenue",
    description: "Streamlined Medicaid/insurance billing, claims tracking, automated invoicing, and financial reporting for group home operations.",
  },
  {
    icon: Link2,
    title: "EHR Integrations",
    description: "Seamless connections with major EHR systems, pharmacies, labs, and payer portals for unified patient data management.",
  },
  {
    icon: ClipboardList,
    title: "Care Coordination",
    description: "Shift scheduling, task assignments, care notes, and handoff reports — keeping your entire team aligned on resident care.",
  },
  {
    icon: Users,
    title: "Staff Management",
    description: "Credential tracking, training compliance, shift coverage, and performance monitoring for your behavioral health workforce.",
  },
];

export default function HealthcareProducts() {
  return (
    <section id="healthcare-products" className="py-20 bg-muted/30">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-6">
          <p className="text-sm font-semibold text-primary uppercase tracking-wider mb-3" data-testid="text-products-label">
            Healthcare Products
          </p>
          <h2 className="text-3xl md:text-4xl font-semibold mb-4">
            Our Technology Solutions
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Purpose-built software for healthcare organizations — from staffing to behavioral health operations.
          </p>
        </div>

        <div className="mt-16">
          <div className="relative rounded-2xl border bg-card shadow-sm overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-primary/70 to-primary/40" />

            <div className="p-8 md:p-12">
              <div className="flex flex-col md:flex-row items-start md:items-center gap-6 mb-10">
                <div className="flex items-center gap-4">
                  <div className="flex-shrink-0">
                    <img
                      src={bhosLogoImg}
                      alt="BHOS Logo"
                      className="h-14 md:h-16 object-contain"
                      data-testid="img-bhos-logo"
                    />
                  </div>
                  <div>
                    <h3 className="text-2xl md:text-3xl font-bold mb-1" data-testid="text-bhos-title">
                      Behavioral Home Operating System
                    </h3>
                    <p className="text-muted-foreground text-base md:text-lg max-w-2xl" data-testid="text-bhos-description">
                      The complete platform for managing behavioral health group homes — medication safety, clinical compliance, billing, and integrations in one place.
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-10">
                {bhosFeatures.map((feature, index) => (
                  <Card
                    key={index}
                    className="border-0 shadow-none bg-muted/50 hover:bg-muted transition-colors"
                    data-testid={`card-bhos-feature-${index}`}
                  >
                    <CardContent className="p-5">
                      <div className="flex items-start gap-4">
                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <feature.icon className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <h4 className="font-semibold mb-1">{feature.title}</h4>
                          <p className="text-sm text-muted-foreground leading-relaxed">{feature.description}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-6 p-6 rounded-xl bg-primary/5 border border-primary/10">
                <div className="flex items-center gap-3">
                  <Shield className="w-8 h-8 text-primary flex-shrink-0" />
                  <div>
                    <p className="font-semibold" data-testid="text-bhos-hipaa">HIPAA Compliant & State-Certified</p>
                    <p className="text-sm text-muted-foreground">Built to meet federal and state behavioral health regulations</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <BarChart3 className="w-8 h-8 text-primary flex-shrink-0" />
                  <div>
                    <p className="font-semibold" data-testid="text-bhos-analytics">Real-Time Analytics</p>
                    <p className="text-sm text-muted-foreground">Live dashboards for occupancy, compliance, and financial performance</p>
                  </div>
                </div>
                <div className="ml-auto flex-shrink-0">
                  <Button size="lg" data-testid="button-bhos-learn-more">
                    Learn More
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
