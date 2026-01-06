import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Car, UserCog } from "lucide-react";
import { Link } from "wouter";

const actions = [
  {
    icon: Car,
    title: "Book a Ride",
    description: "Schedule non-emergency medical transportation for patients. Wheelchair accessible vehicles available.",
    link: "/book-ride",
    buttonText: "Book Now",
    testId: "tile-book-ride",
  },
  {
    icon: UserCog,
    title: "Driver Portal",
    description: "Access the driver dashboard to view available rides, manage pickups, and track your earnings.",
    link: "/driver",
    buttonText: "Driver Login",
    testId: "tile-driver-portal",
  },
];

export default function QuickActions() {
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
          {actions.map((action, index) => (
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
