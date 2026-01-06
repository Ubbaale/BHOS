import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Car, Phone, MapPin, Clock, Shield, User, CheckCircle2, 
  Navigation, Accessibility, Heart, AlertCircle
} from "lucide-react";
import type { Ride } from "@shared/schema";
import { format } from "date-fns";

interface SharedRideData {
  ride: Ride;
  driver: {
    fullName: string;
    phone: string;
    vehicleType: string;
    vehiclePlate: string;
    vehicleColor: string | null;
    vehicleMake: string | null;
    vehicleModel: string | null;
    vehicleYear: string | null;
    profilePhotoDoc: string | null;
    wheelchairAccessible: boolean | null;
    stretcherCapable: boolean | null;
  } | null;
  share: {
    contactName: string;
    isActive: boolean;
  };
}

const statusSteps = [
  { status: "requested", label: "Requested", icon: Clock },
  { status: "accepted", label: "Driver Assigned", icon: User },
  { status: "driver_enroute", label: "Driver En Route", icon: Navigation },
  { status: "arrived", label: "Driver Arrived", icon: MapPin },
  { status: "in_progress", label: "In Progress", icon: Car },
  { status: "completed", label: "Completed", icon: CheckCircle2 },
];

export default function SharedTracking() {
  const { code } = useParams<{ code: string }>();

  const { data, isLoading, error } = useQuery<SharedRideData>({
    queryKey: [`/api/track/${code}`],
    refetchInterval: 10000,
    retry: false,
  });

  const getCurrentStep = () => {
    if (!data?.ride) return 0;
    const index = statusSteps.findIndex(s => s.status === data.ride.status);
    return index >= 0 ? index : 0;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-4 py-8">
          <div className="text-center py-12">Loading ride details...</div>
        </main>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-4 py-8">
          <Card className="max-w-md mx-auto">
            <CardContent className="py-8 text-center">
              <AlertCircle className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <h2 className="text-xl font-semibold mb-2">Trip Not Found</h2>
              <p className="text-muted-foreground mb-4">
                This tracking link may have expired or the trip has been completed.
              </p>
              <Link href="/">
                <Button>Go Home</Button>
              </Link>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  const { ride, driver, share } = data;
  const currentStep = getCurrentStep();

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="bg-primary/10 dark:bg-primary/20 rounded-md p-4 mb-6 flex items-center gap-3">
            <Heart className="w-5 h-5 text-primary" />
            <div>
              <p className="text-sm font-medium">Tracking for {share.contactName}</p>
              <p className="text-xs text-muted-foreground">
                You're tracking {ride.patientName}'s ride in real-time
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between mb-6 flex-wrap gap-2">
            <div>
              <h1 className="text-2xl font-bold" data-testid="text-shared-ride-title">
                {ride.patientName}'s Ride
              </h1>
              <p className="text-sm text-muted-foreground">
                {ride.bookedByOther && ride.bookerName ? `Booked by ${ride.bookerName}` : "Self-booked"}
              </p>
            </div>
            <Badge 
              variant={ride.status === "completed" ? "default" : "secondary"} 
              data-testid="badge-shared-ride-status"
            >
              {ride.status.replace("_", " ").toUpperCase()}
            </Badge>
          </div>

          <div className="mb-8 overflow-x-auto">
            <div className="flex items-center min-w-max">
              {statusSteps.map((step, index) => {
                const StepIcon = step.icon;
                const isActive = index <= currentStep;
                const isCurrent = index === currentStep;
                return (
                  <div key={step.status} className="flex items-center">
                    <div className={`flex flex-col items-center ${index > 0 ? "ml-2" : ""}`}>
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center ${
                          isActive
                            ? isCurrent
                              ? "bg-primary text-primary-foreground"
                              : "bg-primary/20 text-primary"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        <StepIcon className="w-5 h-5" />
                      </div>
                      <span className={`text-xs mt-1 ${isActive ? "text-foreground" : "text-muted-foreground"}`}>
                        {step.label}
                      </span>
                    </div>
                    {index < statusSteps.length - 1 && (
                      <div className={`w-8 h-0.5 mx-1 ${index < currentStep ? "bg-primary" : "bg-muted"}`} />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2 py-3">
                <CardTitle className="text-base">Driver Information</CardTitle>
                {ride.verificationCode && (
                  <Badge variant="outline" className="font-mono" data-testid="badge-shared-verification">
                    Code: {ride.verificationCode}
                  </Badge>
                )}
              </CardHeader>
              <CardContent>
                {driver ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-4">
                      {driver.profilePhotoDoc ? (
                        <img
                          src={driver.profilePhotoDoc}
                          alt={driver.fullName}
                          className="w-16 h-16 rounded-full object-cover"
                          data-testid="img-shared-driver-photo"
                        />
                      ) : (
                        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                          <User className="w-8 h-8 text-muted-foreground" />
                        </div>
                      )}
                      <div>
                        <h3 className="font-semibold" data-testid="text-shared-driver-name">{driver.fullName}</h3>
                        <a href={`tel:${driver.phone}`} className="text-sm text-primary flex items-center gap-1">
                          <Phone className="w-3 h-3" />
                          {driver.phone}
                        </a>
                      </div>
                    </div>
                    
                    <div className="bg-muted/50 rounded-md p-3 space-y-2">
                      <div className="flex items-center gap-2">
                        <Car className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm" data-testid="text-shared-vehicle-info">
                          {driver.vehicleColor} {driver.vehicleYear} {driver.vehicleMake} {driver.vehicleModel}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" data-testid="badge-shared-plate">{driver.vehiclePlate}</Badge>
                        <Badge variant="outline">{driver.vehicleType}</Badge>
                      </div>
                      {(driver.wheelchairAccessible || driver.stretcherCapable) && (
                        <div className="flex items-center gap-2 flex-wrap">
                          <Accessibility className="w-4 h-4 text-muted-foreground" />
                          {driver.wheelchairAccessible && <Badge variant="outline">Wheelchair Accessible</Badge>}
                          {driver.stretcherCapable && <Badge variant="outline">Stretcher Capable</Badge>}
                        </div>
                      )}
                    </div>

                    {ride.estimatedArrivalTime && (
                      <div className="flex items-center gap-2 text-sm">
                        <Clock className="w-4 h-4" />
                        <span>ETA: {format(new Date(ride.estimatedArrivalTime), "h:mm a")}</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-6 text-muted-foreground">
                    <Car className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>Waiting for a driver to accept the ride...</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="py-3">
                <CardTitle className="text-base">Trip Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm font-medium mb-1">Patient</p>
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm" data-testid="text-shared-patient-name">{ride.patientName}</span>
                  </div>
                  <a href={`tel:${ride.patientPhone}`} className="text-sm text-primary flex items-center gap-1 mt-1">
                    <Phone className="w-3 h-3" />
                    {ride.patientPhone}
                  </a>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-3 h-3 rounded-full bg-green-500 mt-1.5" />
                  <div>
                    <p className="text-xs text-muted-foreground">Pickup</p>
                    <p className="text-sm" data-testid="text-shared-pickup">{ride.pickupAddress}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-3 h-3 rounded-full bg-red-500 mt-1.5" />
                  <div>
                    <p className="text-xs text-muted-foreground">Dropoff</p>
                    <p className="text-sm" data-testid="text-shared-dropoff">{ride.dropoffAddress}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Appointment Time</p>
                    <p className="text-sm" data-testid="text-shared-appointment">
                      {format(new Date(ride.appointmentTime), "MMM d, h:mm a")}
                    </p>
                  </div>
                </div>

                {ride.mobilityNeeds && ride.mobilityNeeds.length > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Mobility Needs</p>
                    <div className="flex flex-wrap gap-1">
                      {ride.mobilityNeeds.map((need, i) => (
                        <Badge key={i} variant="outline" className="text-xs">{need}</Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <Card className="mt-6">
            <CardContent className="py-4">
              <div className="flex items-center gap-3 text-sm">
                <Shield className="w-5 h-5 text-primary" />
                <div>
                  <p className="font-medium">Safety First</p>
                  <p className="text-muted-foreground">
                    This ride is being tracked for safety. The patient can reach out if they need help.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {ride.status === "completed" && (
            <div className="mt-6 text-center">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200 rounded-md">
                <CheckCircle2 className="w-5 h-5" />
                <span>Trip completed safely!</span>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
