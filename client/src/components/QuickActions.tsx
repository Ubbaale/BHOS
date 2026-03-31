import { Car, UserCog, Briefcase, Phone, Monitor, Package } from "lucide-react";
import { Link } from "wouter";
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
  {
    icon: Monitor,
    title: "IT Services",
    description: "Submit IT service requests for your healthcare facility and get matched with qualified technicians.",
    mobileDesc: "Healthcare IT support",
    link: "/it-services",
    buttonText: "Get Started",
    testId: "tile-it-services",
    gradient: "from-rose-500 to-rose-600",
  },
  {
    icon: Package,
    title: "Medical Courier",
    description: "Dispatch medical deliveries — medications, lab samples, equipment, and documents between facilities.",
    mobileDesc: "Medical delivery dispatch",
    link: "/courier/onboard",
    buttonText: "Get Started",
    testId: "tile-medical-courier",
    gradient: "from-teal-500 to-teal-600",
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
  return (
    <section id="quick-actions" className="py-6 px-4 md:py-10 md:bg-muted/30">
      <div className="max-w-5xl mx-auto md:px-6">
        <div className="hidden md:block text-center mb-6">
          <h2 className="text-2xl font-semibold mb-2">
            Get Started
          </h2>
          <p className="text-sm text-muted-foreground max-w-xl mx-auto">
            Whether you need a ride or want to become a driver, we make it easy to get started.
          </p>
        </div>

        <div className="flex flex-wrap justify-center gap-3 md:gap-4 max-w-xs md:max-w-none mx-auto">
          {actions.map((action, index) => {
            const Icon = action.icon;
            return (
              <TileLink key={index} action={action}>
                <div
                  className={cn(
                    "flex flex-col items-center justify-center rounded-xl text-white cursor-pointer",
                    "w-[5.5rem] h-[5.5rem] md:w-44 md:h-44",
                    "md:transition-transform md:hover:scale-[1.03]",
                    `bg-gradient-to-br ${action.gradient}`
                  )}
                  data-testid={action.testId}
                >
                  <div className="w-10 h-10 md:w-14 md:h-14 rounded-full bg-white/20 flex items-center justify-center mb-1.5 md:mb-2">
                    <Icon className="w-5 h-5 md:w-7 md:h-7" />
                  </div>
                  <span className="text-[10px] md:text-sm font-semibold text-center leading-tight px-1 md:px-2">{action.title}</span>
                </div>
              </TileLink>
            );
          })}
        </div>
      </div>
    </section>
  );
}
