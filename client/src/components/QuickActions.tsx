import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Car, UserCog, Briefcase, Phone } from "lucide-react";
import { Link } from "wouter";
import { usePlatform } from "@/hooks/use-platform";
import { cn } from "@/lib/utils";

const actions = [
  {
    icon: Car,
    title: "Book a Ride",
    description: "Schedule non-emergency medical transportation for patients. Wheelchair accessible vehicles available.",
    mobileDesc: "Schedule medical transport",
    link: "/book-ride",
    buttonText: "Book Now",
    testId: "tile-book-ride",
    gradient: "from-blue-500 to-blue-600",
  },
  {
    icon: UserCog,
    title: "Driver Portal",
    description: "Access the driver dashboard to view available rides, manage pickups, and track your earnings.",
    mobileDesc: "View rides & earnings",
    link: "/driver",
    buttonText: "Driver Login",
    testId: "tile-driver-portal",
    gradient: "from-emerald-500 to-emerald-600",
  },
  {
    icon: Briefcase,
    title: "Find Jobs",
    description: "Browse available healthcare shifts and apply to positions that match your skills.",
    mobileDesc: "Browse healthcare shifts",
    link: "/#jobs",
    buttonText: "View Jobs",
    testId: "tile-find-jobs",
    gradient: "from-purple-500 to-purple-600",
    isAnchor: true,
  },
  {
    icon: Phone,
    title: "Contact Us",
    description: "Get in touch with our team for support, questions, or partnership inquiries.",
    mobileDesc: "Call 774-581-9700",
    link: "tel:774-581-9700",
    buttonText: "Call Now",
    testId: "tile-contact",
    gradient: "from-amber-500 to-amber-600",
    isExternal: true,
  },
];

export default function QuickActions() {
  const { showMobileUI } = usePlatform();

  if (showMobileUI) {
    return (
      <section id="quick-actions" className="py-6 px-4">
        <div className="grid grid-cols-2 gap-3">
          {actions.map((action, index) => {
            const Icon = action.icon;
            const content = (
              <div
                className={cn(
                  "flex flex-col items-center justify-center p-4 rounded-2xl text-white touch-feedback",
                  `bg-gradient-to-br ${action.gradient}`
                )}
                data-testid={action.testId}
              >
                <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center mb-2">
                  <Icon className="w-6 h-6" />
                </div>
                <span className="text-sm font-semibold">{action.title}</span>
                <span className="text-[11px] opacity-80 text-center mt-0.5">{action.mobileDesc}</span>
              </div>
            );

            if (action.isExternal) {
              return <a key={index} href={action.link}>{content}</a>;
            }
            if (action.isAnchor) {
              return <a key={index} href={action.link.replace("/", "")}>{content}</a>;
            }
            return <Link key={index} href={action.link}>{content}</Link>;
          })}
        </div>
      </section>
    );
  }

  return (
    <section id="quick-actions" className="py-16 bg-muted/30">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-10">
          <h2 className="text-3xl md:text-4xl font-semibold mb-4">
            Get Started
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Whether you need a ride or want to become a driver, we make it easy to get started.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {actions.slice(0, 2).map((action, index) => (
            <Card
              key={index}
              className="hover-elevate transition-all"
              data-testid={action.testId}
            >
              <CardContent className="p-8 flex flex-col items-center text-center">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-6">
                  <action.icon className="w-8 h-8 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-3">{action.title}</h3>
                <p className="text-muted-foreground mb-6">{action.description}</p>
                <Link href={action.link}>
                  <Button size="lg" data-testid={`button-${action.testId}`}>
                    {action.buttonText}
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
