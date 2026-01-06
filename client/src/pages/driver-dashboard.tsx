import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { format, formatDistanceToNow } from "date-fns";

import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { NotificationPrompt } from "@/components/NotificationPrompt";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { MapPin, Clock, User, Phone, Car, Play, CheckCircle2, Navigation, Accessibility, AlertCircle, Shield, DollarSign, CreditCard, Bell, BellRing, Briefcase, TrendingUp, MessageCircle, Send, Heart, ExternalLink } from "lucide-react";
import { openNavigation } from "@/lib/navigation";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { RideChat } from "@/components/RideChat";
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
  isNew?: boolean;
  navigationPreference?: string;
}

function RideCard({ ride, driverId, onAction, isNew = false, navigationPreference = "default" }: RideCardProps) {
  const { toast } = useToast();
  const [showChat, setShowChat] = useState(false);
  const [showCompleteDialog, setShowCompleteDialog] = useState(false);
  const [actualTolls, setActualTolls] = useState(ride.estimatedTolls || "0");
  const isMyRide = ride.driverId === driverId;

  const handleStartTripWithNavigation = async () => {
    await updateStatusMutation.mutateAsync("driver_enroute");
    if (ride.pickupLat && ride.pickupLng) {
      openNavigation({
        destinationLat: parseFloat(ride.pickupLat),
        destinationLng: parseFloat(ride.pickupLng),
        destinationAddress: ride.pickupAddress,
        preference: navigationPreference as any,
      });
    }
  };

  const handleConfirmPickupWithNavigation = async () => {
    await updateStatusMutation.mutateAsync("in_progress");
    if (ride.dropoffLat && ride.dropoffLng) {
      openNavigation({
        destinationLat: parseFloat(ride.dropoffLat),
        destinationLng: parseFloat(ride.dropoffLng),
        destinationAddress: ride.dropoffAddress,
        preference: navigationPreference as any,
      });
    }
  };

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

  const completeRideMutation = useMutation({
    mutationFn: async (tolls: string) => {
      const response = await apiRequest("POST", `/api/rides/${ride.id}/complete`, { 
        actualTolls: parseFloat(tolls),
        actualDistanceMiles: ride.distanceMiles ? parseFloat(ride.distanceMiles) : undefined
      });
      return response.json();
    },
    onSuccess: (data) => {
      const breakdown = data.fareBreakdown;
      toast({ 
        title: "Ride Completed", 
        description: `Final fare: $${breakdown.finalFare}. Your earnings: $${data.ride.driverEarnings}` 
      });
      setShowCompleteDialog(false);
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
        return { label: "Start Trip & Navigate to Pickup", action: handleStartTripWithNavigation, icon: Navigation };
      case "driver_enroute":
        return { label: "Arrived at Pickup", action: () => updateStatusMutation.mutate("arrived"), icon: MapPin };
      case "arrived":
        return { label: "Confirm Pickup & Navigate to Dropoff", action: handleConfirmPickupWithNavigation, icon: ExternalLink };
      case "in_progress":
        return { label: "Complete Ride", action: () => setShowCompleteDialog(true), icon: CheckCircle2 };
      default:
        return null;
    }
  };

  const nextAction = getNextAction();
  const isPending = acceptMutation.isPending || updateStatusMutation.isPending;

  return (
    <Card className={`hover-elevate ${isNew ? "ring-2 ring-primary" : ""}`} data-testid={`card-ride-${ride.id}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4 mb-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              {isNew && (
                <Badge variant="default" className="animate-pulse no-default-hover-elevate">NEW</Badge>
              )}
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
          {ride.distanceMiles && (
            <span className="flex items-center gap-1">
              <Navigation className="w-4 h-4" />
              {parseFloat(ride.distanceMiles).toFixed(1)} mi
            </span>
          )}
          {ride.estimatedFare && (
            <span className="flex items-center gap-1 font-semibold text-foreground">
              <DollarSign className="w-4 h-4" />
              ${parseFloat(ride.estimatedFare).toFixed(2)}
            </span>
          )}
          <span className="flex items-center gap-1">
            <CreditCard className="w-4 h-4" />
            {ride.paymentType === "insurance" ? (
              <Badge variant="outline" className="text-xs no-default-hover-elevate">
                {ride.insuranceProvider || "Insurance"}
              </Badge>
            ) : (
              "Self Pay"
            )}
          </span>
        </div>

        {ride.notes && (
          <div className="text-sm text-muted-foreground mb-3 p-2 bg-muted rounded-md">
            <span className="font-medium">Notes:</span> {ride.notes}
          </div>
        )}

        <div className="flex gap-2 flex-wrap">
          {nextAction && (
            <Button
              className="flex-1"
              onClick={nextAction.action}
              disabled={isPending}
              data-testid={`button-action-${ride.id}`}
            >
              <nextAction.icon className="w-4 h-4 mr-2" />
              {isPending ? "Processing..." : nextAction.label}
            </Button>
          )}
          
          {isMyRide && ride.status !== "requested" && ride.status !== "completed" && (
            <Button
              variant={showChat ? "secondary" : "outline"}
              onClick={() => setShowChat(!showChat)}
              data-testid={`button-chat-${ride.id}`}
            >
              <MessageCircle className="w-4 h-4 mr-2" />
              Chat
            </Button>
          )}
        </div>

        {showChat && isMyRide && (
          <div className="mt-4 h-80 border rounded-md overflow-hidden">
            <RideChat rideId={ride.id} userType="driver" onClose={() => setShowChat(false)} />
          </div>
        )}

        <Dialog open={showCompleteDialog} onOpenChange={setShowCompleteDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Complete Ride</DialogTitle>
              <DialogDescription>
                Confirm the tolls you paid during this trip. These will be added to your earnings.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="actualTolls">Actual Tolls Paid ($)</Label>
                <Input
                  id="actualTolls"
                  type="number"
                  step="0.01"
                  min="0"
                  value={actualTolls}
                  onChange={(e) => setActualTolls(e.target.value)}
                  placeholder="0.00"
                  data-testid="input-actual-tolls"
                />
                <p className="text-sm text-muted-foreground">
                  Estimated tolls: ${parseFloat(ride.estimatedTolls || "0").toFixed(2)}
                </p>
              </div>
              
              <div className="bg-muted p-3 rounded-md text-sm">
                <p className="font-medium mb-2">Fare Breakdown Preview:</p>
                <div className="space-y-1 text-muted-foreground">
                  <div className="flex justify-between">
                    <span>Base fare:</span>
                    <span>$20.00</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Distance ({parseFloat(ride.distanceMiles || "0").toFixed(1)} mi):</span>
                    <span>${(parseFloat(ride.distanceMiles || "0") * 2.50).toFixed(2)}</span>
                  </div>
                  {parseFloat(ride.surgeMultiplier || "1") > 1 && (
                    <div className="flex justify-between">
                      <span>Surge ({ride.surgeMultiplier}x):</span>
                      <span>Applied</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span>Tolls:</span>
                    <span>${parseFloat(actualTolls || "0").toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between font-medium text-foreground border-t pt-1 mt-1">
                    <span>Est. Total:</span>
                    <span>
                      ${Math.max(22, (20 + parseFloat(ride.distanceMiles || "0") * 2.50) * parseFloat(ride.surgeMultiplier || "1") + parseFloat(actualTolls || "0")).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
            
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setShowCompleteDialog(false)}>
                Cancel
              </Button>
              <Button 
                onClick={() => completeRideMutation.mutate(actualTolls)}
                disabled={completeRideMutation.isPending}
                data-testid="button-confirm-complete"
              >
                {completeRideMutation.isPending ? "Processing..." : "Complete & Get Paid"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

export default function DriverDashboard() {
  const { toast } = useToast();
  const [selectedRide, setSelectedRide] = useState<Ride | null>(null);
  const [isAvailable, setIsAvailable] = useState(true);
  const [currentDriverId, setCurrentDriverId] = useState<number | null>(null);
  const [newRideIds, setNewRideIds] = useState<Set<number>>(new Set());
  const [soundEnabled, setSoundEnabled] = useState(true);

  const { data: activeRides = [], isLoading: ridesLoading, refetch: refetchRides } = useQuery<Ride[]>({
    queryKey: ["/api/rides"],
  });

  const { data: allRides = [], refetch: refetchAllRides } = useQuery<Ride[]>({
    queryKey: ["/api/rides/all"],
  });

  const { data: drivers = [] } = useQuery<DriverProfile[]>({
    queryKey: ["/api/drivers"],
  });

  const playNotificationSound = useCallback(() => {
    if (!soundEnabled) return;
    try {
      const audio = new Audio("data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2teleQRBj96MtW4SJnfH6sF5G1l2gP/AciM7WWCA/75yJEZVYnn+3W4fI2R1guzJXxcPVW6I1dJcFghNaoTRw24hFE9piNPfXxIMZW+G0MxcFAVMaoOy0n0mIlNti8zvXBQISWqNsNqCKSddbonn32IQA1JwjMrXaxgHSHCRxthvGwVPcJLM2F8UD1JvkMXUZxQGT3GPxdRiFQ5Qbo/D0G8bCkluj8jUYhQOT26NxM1vHQ1Kbo7E0WIVDk9ti8TLcR8OS22NxM5lFw5Pbo7Ey28eDkttjMPMZxsRR2+NxMpwHw9Lbo3Cy3AdEEltjMPJch8PS22NxMluHw9LbYzDyXEfD0ttjMPJcR8PS22Mw8lyHg9KbY3EyHAeDkttjcTJbx4PTW2MxMlvHg9Mbo3EyXAeD0xtjcPJcB4PTW2Nw8lwHg9NbY3DyXAeD01tjcPJcB4PTW2Nw8lwHg9NbY3DyXAeD01tjcPJcB8OTG6NxMhvHxBMbY3EyW8eEExujcPIcB4QTG2NxMlvHg9Mbo3EyHAeD0xujcTIcB4PTG6NxMhwHg9Mbo3EyHAfDkxujcTIbx8PTW2NxMhvHg9Mbo3EyXAeD0xujcTJcB4PTG6Nw8lwHg9Mbo3DyXAfDkxujcPIcB8OTG6NxMhwHw5Mbo3EyHAfDkxujcTIcB8OTG6NxMhwHw5Mbo3EyHAfDkxujcTIcB8OTG6NxMhwHw5Mbo3EyHAfDk1ujcTIcB8PTW2NxMhwHw9NbY3EyHAfD0xujcTIcB8OTG6NxMhwHw5Mbo3EyHAfDkxujcTIcB8OTG6NxMhwHw5Mbo3EyHAfDkxujcTIcB8OTG6NxMhwHw5Mbo3EyHAfDkxujcTIcB8OTG6NxMhwHw5Mbo3EyHAfDkxujcTIcB8OTG6NxMhwHw5Mbo3EyHAfDkxujcTIcB8OTG6NxMhwHw5Mbo3EyHAfDkxujcTIcB8PTG2NxMhwHg9NbY3EyHAeDkxujcTIcB4OTG6NxMhwHg5Mbo3EyHAeDkxujcTIcB4OTG6NxMhwHg5Mbo3EyHAeDkxujcTIcB4OTG6NxMhwHg5Mbo3EyHAeDkxujcTIcB4OTG6NxMhwHg5Mbo3EyHAeDkxujcTIcB4OTG6Nw8hwHg5Mbo3EyHAeDkxujcTIcB4OTG6NxMhwHg5Mbo3EyHAeDkxujcTIcB4OTG6NxMhwHg5Mbo3EyHAeDkxujcTIcB4OTG6NxMhwHg5Mbo3EyHAeDkxujcTIcB4OTG6NxMhwHg5Mbo3EyHAfDkxujcTIcB8OTG6NxMhwHw5Mbo3EyHAfDkxujcTIcB8OTG6NxMhwHw5Mbo3EyHAfDkxujcTIcB8OTG6NxMhwHw5Mbo3EyHAfDkxujcTIcB8OTG6NxMhwHw5Mbo3EyHAfDkxujcTIcB8OTG6NxMhwHw5Mbo3EyHAfDkxujcTIcB8OTG6NxMhwHw5Mbo3EyHAfDkxujcTIcB8OTG6NxMhwHw5Mbo3EyHAfDkxujcTIcB8OTG6NxMhwHw5Mbo3EyHAfDkxujcTIcB8OTG6NxMhwHw5Mbo3EyHAfDkxujcTIcB8OTG6NxMhwHw5Mbo3EyHAfDkxujcTIcB8OTG6NxMhwHw5Mbo3EyHAfDkxujcTIcB8OQ==");
      audio.volume = 0.5;
      audio.play().catch(() => {});
    } catch (e) {}
  }, [soundEnabled]);

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
      
      if (data.type === "new" && data.ride) {
        setNewRideIds(prev => new Set(Array.from(prev).concat(data.ride.id)));
        playNotificationSound();
        toast({
          title: "New Ride Request",
          description: `Pickup: ${data.ride.pickupAddress.substring(0, 40)}...`,
        });
        setTimeout(() => {
          setNewRideIds(prev => {
            const next = new Set(prev);
            next.delete(data.ride.id);
            return next;
          });
        }, 30000);
      }
      
      refetchRides();
      refetchAllRides();
    };

    ws.onerror = (error) => {
      console.error("WebSocket error:", error);
    };

    return () => {
      ws.close();
    };
  }, [refetchRides, refetchAllRides, playNotificationSound, toast]);

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
          <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
            <div>
              <h1 className="text-3xl font-bold mb-2">Driver Dashboard</h1>
              <p className="text-muted-foreground">
                Browse available rides and manage your trips
              </p>
            </div>
            <div className="flex items-center gap-4 flex-wrap">
              <Button
                variant={soundEnabled ? "default" : "outline"}
                size="sm"
                onClick={() => setSoundEnabled(!soundEnabled)}
                data-testid="button-sound-toggle"
              >
                {soundEnabled ? <BellRing className="w-4 h-4 mr-2" /> : <Bell className="w-4 h-4 mr-2" />}
                {soundEnabled ? "Sound On" : "Sound Off"}
              </Button>
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

          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-md">
                    <Briefcase className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{requestedRides.length}</p>
                    <p className="text-xs text-muted-foreground">Rides in Pool</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-500/10 rounded-md">
                    <Play className="w-5 h-5 text-green-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{myActiveRides.length}</p>
                    <p className="text-xs text-muted-foreground">Active Rides</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-500/10 rounded-md">
                    <CheckCircle2 className="w-5 h-5 text-blue-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{completedRides.length}</p>
                    <p className="text-xs text-muted-foreground">Completed</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-yellow-500/10 rounded-md">
                    <TrendingUp className="w-5 h-5 text-yellow-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">
                      ${completedRides.reduce((sum, r) => sum + (parseFloat(r.driverEarnings || r.estimatedFare || "0")), 0).toFixed(0)}
                    </p>
                    <p className="text-xs text-muted-foreground">Your Earnings</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-red-500/10 rounded-md">
                    <Heart className="w-5 h-5 text-red-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">
                      ${completedRides.reduce((sum, r) => sum + (parseFloat(r.tipAmount || "0")), 0).toFixed(0)}
                    </p>
                    <p className="text-xs text-muted-foreground">Tips Received</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <NotificationPrompt userType="driver" driverId={currentDriverId || undefined} />

          {drivers.length === 0 && (
            <Card className="mb-8">
              <CardContent className="p-6 text-center">
                <AlertCircle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Driver Profile Found</h3>
                <p className="text-muted-foreground mb-4">
                  You need a driver profile to accept rides. Apply to become a driver to get started.
                </p>
                <Button onClick={() => window.location.href = "/driver/apply"} data-testid="button-apply-driver">
                  Apply to Drive
                </Button>
              </CardContent>
            </Card>
          )}

          {currentDriver && currentDriver.applicationStatus === "pending" && (
            <Card className="mb-8">
              <CardContent className="p-6 text-center">
                <Clock className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">Application Under Review</h3>
                <p className="text-muted-foreground mb-4">
                  Your driver application is currently being reviewed. You'll be able to accept rides once approved.
                </p>
              </CardContent>
            </Card>
          )}

          {currentDriver && currentDriver.applicationStatus === "rejected" && (
            <Card className="mb-8">
              <CardContent className="p-6 text-center">
                <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">Application Not Approved</h3>
                <p className="text-muted-foreground mb-4">
                  Unfortunately, your driver application was not approved. 
                  {currentDriver.rejectionReason && (
                    <span className="block mt-2">Reason: {currentDriver.rejectionReason}</span>
                  )}
                </p>
              </CardContent>
            </Card>
          )}

          {currentDriver && currentDriver.applicationStatus === "approved" && currentDriver.kycStatus !== "approved" && (
            <Card className="mb-8 border-yellow-500/50">
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <Shield className="w-10 h-10 text-yellow-500 flex-shrink-0" />
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold mb-2">
                      {currentDriver.kycStatus === "pending_review" ? "KYC Under Review" : 
                       currentDriver.kycStatus === "rejected" ? "KYC Verification Rejected" : 
                       "Complete Your Verification"}
                    </h3>
                    <p className="text-muted-foreground mb-4">
                      {currentDriver.kycStatus === "pending_review" 
                        ? "Your documents are being reviewed. You'll be able to accept rides once verified."
                        : currentDriver.kycStatus === "rejected"
                        ? `Your verification was rejected. ${currentDriver.kycNotes || "Please resubmit your documents."}`
                        : "To start accepting rides, you need to complete your identity verification by uploading your driver's license, vehicle registration, and insurance documents."}
                    </p>
                    {currentDriver.kycStatus !== "pending_review" && (
                      <Button onClick={() => window.location.href = "/driver/kyc"} data-testid="button-complete-kyc">
                        <Shield className="w-4 h-4 mr-2" />
                        {currentDriver.kycStatus === "rejected" ? "Resubmit Documents" : "Complete Verification"}
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {(!currentDriver || (currentDriver.applicationStatus === "approved" && currentDriver.kycStatus === "approved")) && (
          <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <Tabs defaultValue="available" className="w-full">
                <TabsList className="grid w-full grid-cols-3 mb-4">
                  <TabsTrigger value="available" data-testid="tab-available">
                    <Briefcase className="w-4 h-4 mr-1" />
                    Ride Pool ({requestedRides.length})
                  </TabsTrigger>
                  <TabsTrigger value="active" data-testid="tab-active">
                    <Play className="w-4 h-4 mr-1" />
                    My Rides ({myActiveRides.length})
                  </TabsTrigger>
                  <TabsTrigger value="completed" data-testid="tab-completed">
                    <CheckCircle2 className="w-4 h-4 mr-1" />
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
                      <CardContent className="p-8 text-center">
                        <Briefcase className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
                        <h3 className="font-semibold mb-2">No Rides Available</h3>
                        <p className="text-muted-foreground text-sm">
                          New ride requests will appear here. You'll get a notification when a patient posts a ride.
                        </p>
                      </CardContent>
                    </Card>
                  ) : (
                    requestedRides.map((ride) => (
                      <RideCard
                        key={ride.id}
                        ride={ride}
                        driverId={currentDriverId || 0}
                        onAction={() => setSelectedRide(ride)}
                        isNew={newRideIds.has(ride.id)}
                        navigationPreference={currentDriver?.navigationPreference || "default"}
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
                        navigationPreference={currentDriver?.navigationPreference || "default"}
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
                        navigationPreference={currentDriver?.navigationPreference || "default"}
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
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
