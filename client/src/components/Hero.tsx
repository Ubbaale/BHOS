import { Button } from "@/components/ui/button";
import { Users, Clock, Award } from "lucide-react";
import heroImage from "@assets/generated_images/diverse_healthcare_team_collaborating.png";

export default function Hero() {
  const trustIndicators = [
    { icon: Users, text: "5,000+ Healthcare Professionals" },
    { icon: Clock, text: "24/7 Support" },
    { icon: Award, text: "Same-Day Placement" },
  ];

  return (
    <section className="relative min-h-[80vh] flex items-center">
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${heroImage})` }}
      >
        <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/60 to-black/40" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-6 py-20">
        <div className="max-w-2xl">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white leading-tight mb-6">
            24/7 Healthcare Staffing Solutions
          </h1>
          <p className="text-lg md:text-xl text-white/90 leading-relaxed mb-8">
            We dispatch qualified nurses, CNAs, and healthcare workers to your facility, 
            home, or organization. Reliable care when you need it most.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 mb-12">
            <Button
              asChild
              size="lg"
              className="backdrop-blur-sm bg-white/90 text-foreground hover:bg-white"
              data-testid="button-find-workers"
            >
              <a href="https://app.carehubapp.com/#/signUpSelection">Find Workers</a>
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="backdrop-blur-sm bg-white/10 border-white/30 text-white hover:bg-white/20"
              data-testid="button-post-jobs"
            >
              Post Jobs
            </Button>
          </div>

          <div className="flex flex-wrap gap-6">
            {trustIndicators.map((item, index) => (
              <div
                key={index}
                className="flex items-center gap-2 text-white/80"
                data-testid={`text-trust-indicator-${index}`}
              >
                <item.icon className="w-5 h-5" />
                <span className="text-sm font-medium">{item.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
