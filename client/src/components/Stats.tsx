import { Users, Building2, Clock, Star } from "lucide-react";

const stats = [
  { icon: Users, value: "5,000+", label: "Healthcare Workers Placed" },
  { icon: Building2, value: "500+", label: "Facilities Served" },
  { icon: Clock, value: "< 2 hrs", label: "Average Response Time" },
  { icon: Star, value: "98%", label: "Satisfaction Rate" },
];

export default function Stats() {
  return (
    <section className="py-16 bg-primary text-primary-foreground">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
          {stats.map((stat, index) => (
            <div key={index} className="text-center" data-testid={`stat-${index}`}>
              <stat.icon className="w-8 h-8 mx-auto mb-3 opacity-80" />
              <p className="text-3xl md:text-4xl font-bold mb-1">{stat.value}</p>
              <p className="text-sm opacity-80">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
