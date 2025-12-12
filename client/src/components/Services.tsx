import { Card, CardContent } from "@/components/ui/card";
import { Stethoscope, Heart, UserCheck, Activity, AlertCircle, Calendar } from "lucide-react";

const services = [
  {
    icon: Stethoscope,
    title: "Nursing Staff",
    description: "RNs, LPNs, and LVNs for hospitals, clinics, and long-term care facilities.",
  },
  {
    icon: Heart,
    title: "Medical Assistants",
    description: "Certified MAs for clinical support, patient intake, and administrative tasks.",
  },
  {
    icon: UserCheck,
    title: "CNAs & Home Health Aides",
    description: "Compassionate caregivers for in-home care and assisted living facilities.",
  },
  {
    icon: Activity,
    title: "Specialized Care",
    description: "ICU, ER, OR, and specialty unit nurses with advanced certifications.",
  },
  {
    icon: AlertCircle,
    title: "Emergency Coverage",
    description: "Rapid response staffing for urgent needs and last-minute call-outs.",
  },
  {
    icon: Calendar,
    title: "Long-term Contracts",
    description: "Travel nursing and extended placement options for ongoing needs.",
  },
];

export default function Services() {
  return (
    <section id="services" className="py-20 bg-background">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-semibold mb-4">
            Healthcare Staffing Services
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            From hospitals to home care, we provide qualified healthcare professionals
            for every setting and specialty.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {services.map((service, index) => (
            <Card
              key={index}
              className="hover-elevate transition-all"
              data-testid={`card-service-${index}`}
            >
              <CardContent className="p-6">
                <div className="w-12 h-12 rounded-md bg-primary/10 flex items-center justify-center mb-4">
                  <service.icon className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-lg font-semibold mb-2">{service.title}</h3>
                <p className="text-muted-foreground">{service.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
