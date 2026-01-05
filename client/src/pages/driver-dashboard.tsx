import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { format } from "date-fns";

import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { NotificationPrompt } from "@/components/NotificationPrompt";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { MapPin, Clock, User, Phone, Car, Play, CheckCircle2, Navigation, Accessibility, AlertCircle } from "lucide-react";
import type { Ride, DriverProfile } from "@shared/schema";

const pickupIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const dropoffIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

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

interface RideCardProps {
  ride: Ride;
  driverId: number;
  onAction: () => void;
}

function RideCard({ ride, driverId, onAction }: RideCardProps) {
  const { toast } = useToast();

  const acceptMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/rides/${ride.id}/accept`, { driverId });
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Ride Accepted", description: "You have accepted this ride." });
      queryClient.invalidateQueries({ queryKey: ["/api/rides"] });
      onAction();
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async (status: string) => {
      const response = await apiRequest("PATCH", `/api/rides/${ride.id}/status`, { status });
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Status Updated", description: "Ride status has been updated." });
      queryClient.invalidateQueries({ queryKey: ["/api/rides"] });
      onAction();
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const getNextAction = () => {
    switch (ride.status) {
      case "requested":
        return { label: "Accept Ride", action: () => acceptMutation.mutate(), icon: CheckCircle2 };
      case "accepted":
        return { label: "Start Trip", action: () => updateStatusMutation.mutate("driver_enroute"), icon: Navigation };
      case "driver_enroute":
        return { label: "Arrived", action: () => updateStatusMutation.mutate("arrived"), icon: MapPin };
      case "arrived":
        return { label: "Start Ride", action: () => updateStatusMutation.mutate("in_progress"), icon: Play };
      case "in_progress":
        return { label: "Complete Ride", action: () => updateStatusMutation.mutate("completed"), icon: CheckCircle2 };
      default:
        return null;
    }
  };

  const nextAction = getNextAction();
  const isPending = acceptMutation.isPending || updateStatusMutation.isPending;

  return (
    <Card className="hover-elevate" data-testid={`card-ride-${ride.id}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4 mb-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <User className="w-4 h-4 text-muted-foreground" />
              <span className="font-semibold">{ride.patientName}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Phone className="w-3 h-3" />
              <span>{ride.patientPhone}</span>
            </div>
          </div>
          <Badge
            variant="secondary"
            className={`${statusColors[ride.status]} text-white no-default-hover-elevate`}
          >
            {statusLabels[ride.status]}
          </Badge>
        </div>

        <div className="space-y-2 text-sm mb-3">
          <div className="flex items-start gap-2">
            <div className="w-3 h-3 bg-green-500 rounded-full mt-1 flex-shrink-0" />
            <div>
              <span className="text-muted-foreground">Pickup:</span>
              <p className="font-medium">{ride.pickupAddress}</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <div className="w-3 h-3 bg-red-500 rounded-full mt-1 flex-shrink-0" />
            <div>
              <span className="text-muted-foreground">Dropoff:</span>
              <p className="font-medium">{ride.dropoffAddress}</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4 text-sm text-muted-foreground mb-3 flex-wrap">
          <span className="flex items-center gap-1">
            <Clock className="w-4 h-4" />
            {ride.appointmentTime ? format(new Date(ride.appointmentTime), "MMM d, h:mm a") : "N/A"}
          </span>
          {ride.mobilityNeeds && ride.mobilityNeeds.length > 0 && (
            <span className="flex items-center gap-1">
              <Accessibility className="w-4 h-4" />
              {ride.mobilityNeeds.join(", ")}
            </span>
          )}
        </div>

        {ride.notes && (
          <div className="text-sm text-muted-foreground mb-3 p-2 bg-muted rounded-md">
            <span className="font-medium">Notes:</span> {ride.notes}
          </div>
        )}

        {nextAction && (
          <Button
            className="w-full"
            onClick={nextAction.action}
            disabled={isPending}
            data-testid={`button-action-${ride.id}`}
          >
            <nextAction.icon className="w-4 h-4 mr-2" />
            {isPending ? "Processing..." : nextAction.label}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

export default function DriverDashboard() {
  const { toast } = useToast();
  const [selectedRide, setSelectedRide] = useState<Ride | null>(null);
  const [isAvailable, setIsAvailable] = useState(true);
  const [currentDriverId, setCurrentDriverId] = useState<number | null>(null);

  const { data: activeRides = [], isLoading: ridesLoading, refetch: refetchRides } = useQuery<Ride[]>({
    queryKey: ["/api/rides"],
  });

  const { data: allRides = [], refetch: refetchAllRides } = useQuery<Ride[]>({
    queryKey: ["/api/rides/all"],
  });

  const { data: drivers = [] } = useQuery<DriverProfile[]>({
    queryKey: ["/api/drivers"],
  });

  useEffect(() => {
    if (drivers.length > 0 && !currentDriverId) {
      setCurrentDriverId(drivers[0].id);
    }
  }, [drivers, currentDriverId]);

  useEffect(() => {
    const ws = new WebSocket(`${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.host}/ws/rides`);
    
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      console.log("Ride update:", data);
      refetchRides();
      refetchAllRides();
    };

    ws.onerror = (error) => {
      console.error("WebSocket error:", error);
    };

    return () => {
      ws.close();
    };
  }, [refetchRides, refetchAllRides]);

  const requestedRides = activeRides.filter((r) => r.status === "requested");
  const myActiveRides = activeRides.filter((r) => 
    ["accepted", "driver_enroute", "arrived", "in_progress"].includes(r.status) &&
    (currentDriverId ? r.driverId === currentDriverId : true)
  );
  const completedRides = allRides.filter((r) => r.status === "completed");

  const currentDriver = drivers.find(d => d.id === currentDriverId);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
            <div>
              <h1 className="text-3xl font-bold mb-2">Driver Dashboard</h1>
              <p className="text-muted-foreground">
                Manage your medical transportation rides.
              </p>
            </div>
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Availability:</span>
                <Switch
                  checked={isAvailable}
                  onCheckedChange={setIsAvailable}
                  data-testid="switch-availability"
                />
                <Badge variant={isAvailable ? "default" : "secondary"} className="no-default-hover-elevate">
                  {isAvailable ? "Online" : "Offline"}
                </Badge>
              </div>
              {currentDriver && (
                <div className="flex items-center gap-2 text-sm">
                  <Car className="w-4 h-4" />
                  <span>{currentDriver.fullName}</span>
                </div>
              )}
            </div>
          </div>

          <NotificationPrompt userType="driver" driverId={currentDriverId || undefined} />

          {drivers.length === 0 && (
            <Card className="mb-8">
              <CardContent className="p-6 text-center">
                <AlertCircle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Driver Profile Found</h3>
                <p className="text-muted-foreground mb-4">
                  You need a driver profile to accept rides. Contact an administrator to set up your profile.
                </p>
              </CardContent>
            </Card>
          )}

          <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <Tabs defaultValue="available" className="w-full">
                <TabsList className="grid w-full grid-cols-3 mb-4">
                  <TabsTrigger value="available" data-testid="tab-available">
                    Available ({requestedRides.length})
                  </TabsTrigger>
                  <TabsTrigger value="active" data-testid="tab-active">
                    My Rides ({myActiveRides.length})
                  </TabsTrigger>
                  <TabsTrigger value="completed" data-testid="tab-completed">
                    Completed ({completedRides.length})
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="available" className="space-y-4">
                  {ridesLoading ? (
                    <Card>
                      <CardContent className="p-6 text-center text-muted-foreground">
                        Loading rides...
                      </CardContent>
                    </Card>
                  ) : requestedRides.length === 0 ? (
                    <Card>
                      <CardContent className="p-6 text-center text-muted-foreground">
                        No available ride requests at the moment.
                      </CardContent>
                    </Card>
                  ) : (
                    requestedRides.map((ride) => (
                      <RideCard
                        key={ride.id}
                        ride={ride}
                        driverId={currentDriverId || 0}
                        onAction={() => setSelectedRide(ride)}
                      />
                    ))
                  )}
                </TabsContent>

                <TabsContent value="active" className="space-y-4">
                  {myActiveRides.length === 0 ? (
                    <Card>
                      <CardContent className="p-6 text-center text-muted-foreground">
                        No active rides. Accept a ride to get started.
                      </CardContent>
                    </Card>
                  ) : (
                    myActiveRides.map((ride) => (
                      <RideCard
                        key={ride.id}
                        ride={ride}
                        driverId={currentDriverId || 0}
                        onAction={() => setSelectedRide(ride)}
                      />
                    ))
                  )}
                </TabsContent>

                <TabsContent value="completed" className="space-y-4">
                  {completedRides.length === 0 ? (
                    <Card>
                      <CardContent className="p-6 text-center text-muted-foreground">
                        No completed rides yet.
                      </CardContent>
                    </Card>
                  ) : (
                    completedRides.slice(0, 10).map((ride) => (
                      <RideCard
                        key={ride.id}
                        ride={ride}
                        driverId={currentDriverId || 0}
                        onAction={() => {}}
                      />
                    ))
                  )}
                </TabsContent>
              </Tabs>
            </div>

            <div>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MapPin className="w-5 h-5" />
                    Ride Map
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[400px] rounded-md overflow-hidden border">
                    <MapContainer
                      center={[39.8283, -98.5795]}
                      zoom={4}
                      style={{ height: "100%", width: "100%" }}
                    >
                      <TileLayer
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                      />
                      {activeRides
                        .filter((r) => r.status !== "completed" && r.status !== "cancelled")
                        .flatMap((ride) => [
                          <Marker
                            key={`pickup-${ride.id}`}
                            position={[parseFloat(ride.pickupLat), parseFloat(ride.pickupLng)]}
                            icon={pickupIcon}
                          >
                            <Popup>
                              <div className="p-1">
                                <p className="font-semibold">Pickup: {ride.patientName}</p>
                                <p className="text-sm">{ride.pickupAddress}</p>
                              </div>
                            </Popup>
                          </Marker>,
                          <Marker
                            key={`dropoff-${ride.id}`}
                            position={[parseFloat(ride.dropoffLat), parseFloat(ride.dropoffLng)]}
                            icon={dropoffIcon}
                          >
                            <Popup>
                              <div className="p-1">
                                <p className="font-semibold">Dropoff: {ride.patientName}</p>
                                <p className="text-sm">{ride.dropoffAddress}</p>
                              </div>
                            </Popup>
                          </Marker>
                        ])}
                    </MapContainer>
                  </div>
                  <div className="mt-4 flex gap-4 text-sm flex-wrap">
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 bg-green-500 rounded-full" />
                      <span>Pickup</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 bg-red-500 rounded-full" />
                      <span>Dropoff</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
