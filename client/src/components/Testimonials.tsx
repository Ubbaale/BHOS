import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Star } from "lucide-react";

const testimonials = [
  {
    name: "Sarah Johnson",
    role: "Director of Nursing",
    facility: "Memorial Hospital",
    location: "Los Angeles, CA",
    rating: 5,
    text: "Carehub has been invaluable for our staffing needs. Their response time is incredible, and the nurses they send are always qualified and professional.",
  },
  {
    name: "Michael Chen",
    role: "Registered Nurse",
    facility: "Travel Nurse",
    location: "San Francisco, CA",
    rating: 5,
    text: "I've been working with Carehub for 2 years. They always find me great assignments with competitive pay. The app makes everything so easy!",
  },
  {
    name: "Emily Rodriguez",
    role: "Administrator",
    facility: "Sunrise Senior Living",
    location: "San Diego, CA",
    rating: 5,
    text: "We rely on Carehub for last-minute coverage. They've never let us down. The quality of caregivers is consistently excellent.",
  },
];

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {[...Array(5)].map((_, i) => (
        <Star
          key={i}
          className={`w-4 h-4 ${
            i < rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground"
          }`}
        />
      ))}
    </div>
  );
}

export default function Testimonials() {
  return (
    <section className="py-20 bg-card">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-semibold mb-4">
            Trusted by Healthcare Professionals
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            See what our clients and healthcare workers have to say about working with us.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {testimonials.map((testimonial, index) => (
            <Card key={index} data-testid={`card-testimonial-${index}`}>
              <CardContent className="p-6">
                <StarRating rating={testimonial.rating} />
                <p className="mt-4 mb-6 text-muted-foreground leading-relaxed">
                  "{testimonial.text}"
                </p>
                <div className="flex items-center gap-3">
                  <Avatar>
                    <AvatarFallback className="bg-primary/10 text-primary font-medium">
                      {testimonial.name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-semibold text-sm">{testimonial.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {testimonial.role} - {testimonial.facility}
                    </p>
                    <p className="text-xs text-muted-foreground">{testimonial.location}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
