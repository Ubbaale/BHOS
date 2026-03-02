import { useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import BackToHome from "@/components/BackToHome";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { MapPin, Clock, DollarSign, ChevronDown, ChevronUp, User, CreditCard, Navigation, ArrowLeft, AlertCircle, History } from "lucide-react";

interface TripFareBreakdown {
  baseFare: string;
  distanceFee: string;
  tolls: string;
  totalFare: string;
  tip: string;
  platformFee: string;
  driverNet: string;
  totalWithTip: string;
}

interface Trip {
  id: number;
  date: string;
  pickupAddress: string;
  dropoffAddress: string;
  patientName: string;
  distanceMiles: string;
  fareBreakdown: TripFareBreakdown;
  status: string;
  paymentType: string;
}

interface TripHistoryResponse {
  trips: Trip[];
  total: number;
  hasMore: boolean;
}

export default function DriverTripHistory() {
  const [expandedTrips, setExpandedTrips] = useState<Set<number>>(new Set());
  const [limit, setLimit] = useState(20);

  const driverId = parseInt(localStorage.getItem("driverId") || "0");

  const { data, isLoading, error } = useQuery<TripHistoryResponse>({
    queryKey: ["/api/drivers", driverId, "trip-history", limit],
    queryFn: async () => {
      const res = await fetch(`/api/drivers/${driverId}/trip-history?limit=${limit}&offset=0`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch trip history");
      return res.json();
    },
    enabled: driverId > 0,
  });

  const toggleTrip = (tripId: number) => {
    setExpandedTrips(prev => {
      const next = new Set(prev);
      if (next.has(tripId)) {
        next.delete(tripId);
      } else {
        next.add(tripId);
      }
      return next;
    });
  };

  const trips = data?.trips || [];
  const totalTrips = data?.total || 0;
  const hasMore = data?.hasMore || false;

  const totalEarnings = trips.reduce((sum, t) => sum + parseFloat(t.fareBreakdown.totalWithTip), 0);

  if (!driverId) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Header title="Trip History" showBack />
        <main className="flex-1 container mx-auto px-4 py-8">
          <Card>
            <CardContent className="py-8 text-center">
              <AlertCircle className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <p data-testid="text-no-driver">Please access this page from the driver dashboard.</p>
            </CardContent>
          </Card>
        </main>
        <Footer />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Header title="Trip History" showBack />
        <main className="flex-1 container mx-auto px-4 py-8">
          <Card>
            <CardContent className="py-8 text-center">
              <AlertCircle className="w-12 h-12 mx-auto mb-4 text-destructive" />
              <p className="text-destructive font-medium" data-testid="text-error">Failed to load trip history. Please try again later.</p>
              <Link href="/driver">
                <Button variant="outline" className="mt-4" data-testid="link-back-dashboard-error">Back to Dashboard</Button>
              </Link>
            </CardContent>
          </Card>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header title="Trip History" showBack />
      <main className="flex-1 container mx-auto px-4 py-8">
        <div className="mb-4">
          <BackToHome />
        </div>
        <div className="max-w-3xl mx-auto space-y-6">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-2xl font-bold" data-testid="text-page-title">Trip History</h1>
              <p className="text-muted-foreground">
                {totalTrips} completed {totalTrips === 1 ? "trip" : "trips"}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Link href="/driver">
                <Button variant="outline" size="sm" data-testid="link-back-dashboard">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Dashboard
                </Button>
              </Link>
              <Link href="/driver/earnings">
                <Button variant="outline" size="sm" data-testid="link-earnings">
                  <DollarSign className="w-4 h-4 mr-2" />
                  Earnings
                </Button>
              </Link>
            </div>
          </div>

          {totalTrips > 0 && (
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-green-500/10 rounded-md">
                      <DollarSign className="w-5 h-5 text-green-600" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Showing earnings</p>
                      <p className="text-xl font-bold" data-testid="text-total-earnings">${totalEarnings.toFixed(2)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-500/10 rounded-md">
                      <History className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Total trips</p>
                      <p className="text-xl font-bold" data-testid="text-total-trips">{totalTrips}</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map(i => (
                <Card key={i}>
                  <CardContent className="p-4 space-y-3">
                    <Skeleton className="h-5 w-40" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-3/4" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : trips.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <History className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
                <h3 className="font-semibold mb-2" data-testid="text-no-trips">No Completed Trips</h3>
                <p className="text-muted-foreground text-sm">
                  Your completed trips will appear here with detailed fare breakdowns.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {trips.map(trip => {
                const isExpanded = expandedTrips.has(trip.id);
                return (
                  <Card key={trip.id} data-testid={`card-trip-${trip.id}`}>
                    <Collapsible open={isExpanded} onOpenChange={() => toggleTrip(trip.id)}>
                      <CollapsibleTrigger asChild>
                        <button className="w-full text-left" data-testid={`button-expand-trip-${trip.id}`}>
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1 min-w-0 space-y-2">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <Clock className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                                  <span className="text-sm text-muted-foreground" data-testid={`text-trip-date-${trip.id}`}>
                                    {trip.date ? format(new Date(trip.date), "MMM d, yyyy 'at' h:mm a") : "N/A"}
                                  </span>
                                  <Badge variant="outline" className="text-xs no-default-hover-elevate" data-testid={`badge-payment-${trip.id}`}>
                                    {trip.paymentType === "insurance" ? "Insurance" : "Self Pay"}
                                  </Badge>
                                </div>
                                <div className="flex items-center gap-2">
                                  <User className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                                  <span className="font-medium truncate" data-testid={`text-patient-${trip.id}`}>{trip.patientName}</span>
                                </div>
                                <div className="flex items-start gap-2">
                                  <div className="flex flex-col items-center gap-0.5 mt-1 flex-shrink-0">
                                    <div className="w-2.5 h-2.5 bg-green-500 rounded-full" />
                                    <div className="w-px h-3 bg-muted-foreground/30" />
                                    <div className="w-2.5 h-2.5 bg-red-500 rounded-full" />
                                  </div>
                                  <div className="min-w-0 space-y-0.5">
                                    <p className="text-sm truncate" data-testid={`text-pickup-${trip.id}`}>{trip.pickupAddress}</p>
                                    <p className="text-sm truncate" data-testid={`text-dropoff-${trip.id}`}>{trip.dropoffAddress}</p>
                                  </div>
                                </div>
                              </div>
                              <div className="flex flex-col items-end gap-1 flex-shrink-0">
                                <span className="text-lg font-bold text-green-600 dark:text-green-400" data-testid={`text-earnings-${trip.id}`}>
                                  ${trip.fareBreakdown.totalWithTip}
                                </span>
                                <span className="text-xs text-muted-foreground">{trip.distanceMiles} mi</span>
                                {isExpanded ? (
                                  <ChevronUp className="w-4 h-4 text-muted-foreground" />
                                ) : (
                                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                                )}
                              </div>
                            </div>
                          </CardContent>
                        </button>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="px-4 pb-4">
                          <div className="bg-muted rounded-md p-4 space-y-2 text-sm" data-testid={`breakdown-${trip.id}`}>
                            <p className="font-semibold mb-3">Fare Breakdown</p>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Base fare</span>
                              <span data-testid={`text-base-fare-${trip.id}`}>${trip.fareBreakdown.baseFare}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Distance ({trip.distanceMiles} mi)</span>
                              <span data-testid={`text-distance-fee-${trip.id}`}>${trip.fareBreakdown.distanceFee}</span>
                            </div>
                            {parseFloat(trip.fareBreakdown.tolls) > 0 && (
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Tolls</span>
                                <span data-testid={`text-tolls-${trip.id}`}>${trip.fareBreakdown.tolls}</span>
                              </div>
                            )}
                            <div className="flex justify-between border-t pt-2 mt-2">
                              <span className="text-muted-foreground">Total fare</span>
                              <span className="font-medium" data-testid={`text-total-fare-${trip.id}`}>${trip.fareBreakdown.totalFare}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Platform fee</span>
                              <span className="text-red-500" data-testid={`text-platform-fee-${trip.id}`}>-${trip.fareBreakdown.platformFee}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Your net</span>
                              <span className="font-medium" data-testid={`text-driver-net-${trip.id}`}>${trip.fareBreakdown.driverNet}</span>
                            </div>
                            {parseFloat(trip.fareBreakdown.tip) > 0 && (
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Tip</span>
                                <span className="text-green-600 dark:text-green-400" data-testid={`text-tip-${trip.id}`}>+${trip.fareBreakdown.tip}</span>
                              </div>
                            )}
                            <div className="flex justify-between border-t pt-2 mt-2 font-bold">
                              <span>Total earnings</span>
                              <span className="text-green-600 dark:text-green-400" data-testid={`text-total-with-tip-${trip.id}`}>${trip.fareBreakdown.totalWithTip}</span>
                            </div>
                          </div>
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  </Card>
                );
              })}

              {hasMore && (
                <div className="text-center pt-2">
                  <Button
                    variant="outline"
                    onClick={() => setLimit(prev => prev + 20)}
                    data-testid="button-load-more"
                  >
                    Load More Trips
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
