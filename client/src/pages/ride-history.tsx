import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { format } from "date-fns";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import BackToHome from "@/components/BackToHome";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  MapPin,
  Clock,
  DollarSign,
  Star,
  Search,
  Receipt,
  RefreshCw,
  Car,
  User,
  ArrowRight,
} from "lucide-react";
import type { Ride } from "@shared/schema";

const statusColors: Record<string, string> = {
  requested: "bg-yellow-500",
  accepted: "bg-blue-500",
  driver_enroute: "bg-purple-500",
  arrived: "bg-indigo-500",
  in_progress: "bg-green-500",
  completed: "bg-gray-500",
  cancelled: "bg-red-500",
};

const statusLabels: Record<string, string> = {
  requested: "Requested",
  accepted: "Accepted",
  driver_enroute: "En Route",
  arrived: "Arrived",
  in_progress: "In Progress",
  completed: "Completed",
  cancelled: "Cancelled",
};

function RideHistoryCard({ ride }: { ride: Ride }) {
  const tripDate = ride.appointmentTime
    ? format(new Date(ride.appointmentTime), "MMM d, yyyy")
    : "N/A";
  const tripTime = ride.appointmentTime
    ? format(new Date(ride.appointmentTime), "h:mm a")
    : "";

  return (
    <Card className="hover-elevate" data-testid={`card-ride-history-${ride.id}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4 mb-3">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            <div>
              <p className="text-sm font-medium" data-testid={`text-ride-date-${ride.id}`}>
                {tripDate}
              </p>
              <p className="text-xs text-muted-foreground">{tripTime}</p>
            </div>
          </div>
          <Badge
            variant="secondary"
            className={`${statusColors[ride.status]} text-white no-default-hover-elevate`}
            data-testid={`badge-status-${ride.id}`}
          >
            {statusLabels[ride.status] || ride.status}
          </Badge>
        </div>

        <div className="space-y-2 text-sm mb-3">
          <div className="flex items-start gap-2">
            <div className="w-3 h-3 bg-green-500 rounded-full mt-1 flex-shrink-0" />
            <p className="text-muted-foreground line-clamp-1" data-testid={`text-pickup-${ride.id}`}>
              {ride.pickupAddress}
            </p>
          </div>
          <div className="flex items-start gap-2">
            <div className="w-3 h-3 bg-red-500 rounded-full mt-1 flex-shrink-0" />
            <p className="text-muted-foreground line-clamp-1" data-testid={`text-dropoff-${ride.id}`}>
              {ride.dropoffAddress}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4 text-sm text-muted-foreground mb-3 flex-wrap">
          {ride.estimatedFare && (
            <span className="flex items-center gap-1 font-semibold text-foreground" data-testid={`text-fare-${ride.id}`}>
              <DollarSign className="w-4 h-4" />
              ${parseFloat(ride.estimatedFare).toFixed(2)}
            </span>
          )}
          {ride.distanceMiles && (
            <span className="flex items-center gap-1">
              <Car className="w-4 h-4" />
              {parseFloat(ride.distanceMiles).toFixed(1)} mi
            </span>
          )}
          {ride.driverId && (
            <span className="flex items-center gap-1">
              <User className="w-4 h-4" />
              Driver #{ride.driverId}
            </span>
          )}
        </div>

        <div className="flex gap-2 flex-wrap">
          <Link href={`/receipt/${ride.id}`}>
            <Button variant="outline" size="sm" data-testid={`button-receipt-${ride.id}`}>
              <Receipt className="w-4 h-4 mr-1" />
              View Receipt
            </Button>
          </Link>
          <Link href="/book-ride">
            <Button variant="outline" size="sm" data-testid={`button-book-again-${ride.id}`}>
              <RefreshCw className="w-4 h-4 mr-1" />
              Book Again
            </Button>
          </Link>
          {ride.status === "completed" && (
            <Link href={`/track/${ride.id}`}>
              <Button variant="outline" size="sm" data-testid={`button-rate-${ride.id}`}>
                <Star className="w-4 h-4 mr-1" />
                Rate
              </Button>
            </Link>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map((i) => (
        <Card key={i}>
          <CardContent className="p-4 space-y-3">
            <div className="flex justify-between">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-5 w-20" />
            </div>
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <div className="flex gap-2">
              <Skeleton className="h-8 w-28" />
              <Skeleton className="h-8 w-28" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default function RideHistory() {
  const [phone, setPhone] = useState("");
  const [searchPhone, setSearchPhone] = useState("");

  const {
    data: rides = [],
    isLoading,
    isFetching,
  } = useQuery<Ride[]>({
    queryKey: ["/api/rides/history", searchPhone],
    queryFn: async () => {
      if (!searchPhone) return [];
      const res = await fetch(
        `/api/rides/history?phone=${encodeURIComponent(searchPhone)}`
      );
      if (!res.ok) throw new Error("Failed to fetch rides");
      return res.json();
    },
    enabled: !!searchPhone,
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (phone.trim()) {
      setSearchPhone(phone.trim());
    }
  };

  const activeRides = rides.filter(
    (r) => !["completed", "cancelled"].includes(r.status)
  );
  const pastRides = rides.filter((r) =>
    ["completed", "cancelled"].includes(r.status)
  );

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="max-w-2xl mx-auto p-4 space-y-6">
        <div className="flex items-center gap-2 mb-2">
          <BackToHome />
          <h1 className="text-2xl font-bold" data-testid="text-page-title">
            My Rides
          </h1>
        </div>

        <Card>
          <CardContent className="p-4">
            <form onSubmit={handleSearch} className="flex gap-2">
              <Input
                type="tel"
                placeholder="Enter your phone number to find rides"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                data-testid="input-phone-search"
              />
              <Button
                type="submit"
                disabled={!phone.trim() || isFetching}
                data-testid="button-search-rides"
              >
                <Search className="w-4 h-4 mr-1" />
                Search
              </Button>
            </form>
          </CardContent>
        </Card>

        {isLoading || isFetching ? (
          <LoadingSkeleton />
        ) : searchPhone && rides.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Car className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
              <p className="text-muted-foreground" data-testid="text-no-rides">
                No rides found for this phone number.
              </p>
              <Link href="/book-ride">
                <Button className="mt-4" data-testid="button-book-first-ride">
                  Book Your First Ride
                  <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <>
            {activeRides.length > 0 && (
              <div>
                <h2
                  className="text-lg font-semibold mb-3"
                  data-testid="text-active-rides-heading"
                >
                  Active Rides
                </h2>
                <div className="space-y-3">
                  {activeRides.map((ride) => (
                    <RideHistoryCard key={ride.id} ride={ride} />
                  ))}
                </div>
              </div>
            )}

            {pastRides.length > 0 && (
              <div>
                <h2
                  className="text-lg font-semibold mb-3"
                  data-testid="text-past-rides-heading"
                >
                  Past Rides
                </h2>
                <div className="space-y-3">
                  {pastRides.map((ride) => (
                    <RideHistoryCard key={ride.id} ride={ride} />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </main>

      <Footer />
    </div>
  );
}
