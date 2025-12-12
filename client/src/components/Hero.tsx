import { Button } from "@/components/ui/button";
import { Users, Clock, Award } from "lucide-react";
import heroVideo from "@assets/generated_videos/healthcare_aide_caring_for_elderly.mp4";

export default function Hero() {
  const trustIndicators = [
    { icon: Users, text: "5,000+ Healthcare Professionals" },
    { icon: Clock, text: "24/7 Support" },
    { icon: Award, text: "Same-Day Placement" },
  ];

  return (
    <section className="relative min-h-[80vh] flex items-center overflow-hidden">
      <div className="absolute inset-0">
        <video
          autoPlay
          muted
          loop
          playsInline
          className="absolute inset-0 w-full h-full object-cover"
        >
          <source src={heroVideo} type="video/mp4" />
        </video>
        <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/70 to-black/50" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-6 py-20">
        <div className="max-w-2xl">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white leading-tight mb-6">
            We're No.1 New England 24/7 Healthcare Dispatch Solutions
          </h1>
          <p className="text-lg md:text-xl text-white/90 leading-relaxed mb-8">
            At your finger tip dispatch a qualified nurses, CNAs, and healthcare workers to your facility, 
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
              asChild
              size="lg"
              variant="outline"
              className="backdrop-blur-sm bg-white/10 border-white/30 text-white hover:bg-white/20"
              data-testid="button-post-jobs"
            >
              <a href="https://app.carehubapp.com/#/login">Post Jobs</a>
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
