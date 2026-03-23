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

function TileLink({ action, children }: { action: typeof actions[number]; children: React.ReactNode }) {
  if (action.isExternal) {
    return <a href={action.link}>{children}</a>;
  }
  if (action.isAnchor) {
    return <a href={action.link.replace("/", "")}>{children}</a>;
  }
  return <Link href={action.link}>{children}</Link>;
}

export default function QuickActions() {
  const { showMobileUI } = usePlatform();

  if (showMobileUI) {
    return (
      <section id="quick-actions" className="py-6 px-4">
        <div className="flex justify-center gap-3">
          {actions.map((action, index) => {
            const Icon = action.icon;
            return (
              <TileLink key={index} action={action}>
                <div
                  className={cn(
                    "w-40 h-40 flex flex-col items-center justify-center rounded-xl text-white touch-feedback",
                    `bg-gradient-to-br ${action.gradient}`
                  )}
                  data-testid={action.testId}
                >
                  <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center mb-2">
                    <Icon className="w-6 h-6" />
                  </div>
                  <span className="text-xs font-semibold text-center leading-tight px-2">{action.title}</span>
                </div>
              </TileLink>
            );
          })}
        </div>
      </section>
    );
  }

  return (
    <section id="quick-actions" className="py-10 bg-muted/30">
      <div className="max-w-3xl mx-auto px-6">
        <div className="text-center mb-6">
          <h2 className="text-2xl font-semibold mb-2">
            Get Started
          </h2>
          <p className="text-sm text-muted-foreground max-w-xl mx-auto">
            Whether you need a ride or want to become a driver, we make it easy to get started.
          </p>
        </div>

        <div className="flex justify-center gap-4">
          {actions.map((action, index) => {
            const Icon = action.icon;
            return (
              <TileLink key={index} action={action}>
                <div
                  className={cn(
                    "w-56 h-56 flex flex-col items-center justify-center rounded-xl text-white transition-transform hover:scale-[1.03] cursor-pointer",
                    `bg-gradient-to-br ${action.gradient}`
                  )}
                  data-testid={action.testId}
                >
                  <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center mb-2">
                    <Icon className="w-7 h-7" />
                  </div>
                  <span className="text-sm font-semibold text-center px-2">{action.title}</span>
                </div>
              </TileLink>
            );
          })}
        </div>
      </div>
    </section>
  );
}
