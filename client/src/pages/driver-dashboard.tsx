import { useState, useEffect, useRef, useCallback } from "react";
import { Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { MapContainer, TileLayer, Marker, Popup, Circle, Polyline } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { format, formatDistanceToNow } from "date-fns";

import Header from "@/components/Header";
import Footer from "@/components/Footer";
import BackToHome from "@/components/BackToHome";
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
import { MapPin, Clock, User, Phone, Car, Play, CheckCircle2, Navigation, Accessibility, AlertCircle, Shield, DollarSign, CreditCard, Bell, BellRing, Briefcase, TrendingUp, MessageCircle, Send, Heart, ExternalLink, FileText, Wallet, Star, AlertTriangle, History, ShieldCheck, ShieldAlert, Flame, ArrowUpRight, Route, Zap, Package, Thermometer } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
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

function getDirectionLabel(fromLat: number, fromLng: number, toLat: number, toLng: number): string {
  const dLat = toLat - fromLat;
  const dLng = toLng - fromLng;
  const angle = Math.atan2(dLng, dLat) * (180 / Math.PI);
  if (angle >= -22.5 && angle < 22.5) return "N";
  if (angle >= 22.5 && angle < 67.5) return "NE";
  if (angle >= 67.5 && angle < 112.5) return "E";
  if (angle >= 112.5 && angle < 157.5) return "SE";
  if (angle >= 157.5 || angle < -157.5) return "S";
  if (angle >= -157.5 && angle < -112.5) return "SW";
  if (angle >= -112.5 && angle < -67.5) return "W";
  return "NW";
}

function getDirectionRotation(fromLat: number, fromLng: number, toLat: number, toLng: number): number {
  const dLat = toLat - fromLat;
  const dLng = toLng - fromLng;
  return Math.atan2(dLng, dLat) * (180 / Math.PI);
}

function getSurgeColor(multiplier: number): string {
  if (multiplier >= 1.25) return "#ef4444";
  if (multiplier >= 1.15) return "#f97316";
  if (multiplier >= 1.10) return "#eab308";
  return "#22c55e";
}

interface RideCardProps {
  ride: Ride & { distanceToPickup?: string | null; estimatedMinutesToPickup?: number | null };
  driverId: number;
  onAction: () => void;
  isNew?: boolean;
  navigationPreference?: string;
}

function WaitTimer({ startedAt }: { startedAt: string | Date }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const start = new Date(startedAt).getTime();
    const tick = () => setElapsed(Math.floor((Date.now() - start) / 1000));
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [startedAt]);

  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;
  const isBillable = mins >= 15;

  return (
    <div className={`flex items-center gap-2 text-sm font-mono ${isBillable ? "text-orange-600 dark:text-orange-400" : "text-muted-foreground"}`}>
      <Clock className="w-4 h-4" />
      <span>{String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}</span>
      {isBillable && (
        <Badge variant="secondary" className="text-xs bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 no-default-hover-elevate">
          Billable ({mins - 15}+ min)
        </Badge>
      )}
    </div>
  );
}

const vehicleTypeLabels: Record<string, string> = {
  sedan: "Sedan",
  suv: "SUV",
  wheelchair_van: "Wheelchair Van",
  stretcher_van: "Stretcher Van",
  minivan: "Minivan",
};

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

  const startWaitMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/rides/${ride.id}/wait-start`);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Wait Started", description: "Timer started. First 15 minutes are free." });
      queryClient.invalidateQueries({ queryKey: ["/api/rides"] });
      onAction();
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const endWaitMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/rides/${ride.id}/wait-end`);
      return response.json();
    },
    onSuccess: (data: any) => {
      const waitMins = data?.waitTimeMinutes || 0;
      const billable = Math.max(0, waitMins - 15);
      toast({
        title: "Patient Ready",
        description: `Wait time: ${waitMins} min${billable > 0 ? ` ($${(billable * 0.50).toFixed(2)} will be added to fare)` : " (within free grace period)"}`,
      });
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
          <div className="flex flex-col items-end gap-1">
            <Badge
              variant="secondary"
              className={`${statusColors[ride.status]} text-white no-default-hover-elevate`}
            >
              {statusLabels[ride.status]}
            </Badge>
            {ride.status === "requested" && (ride.distanceToPickup || ride.estimatedFare) && (
              <div className="flex flex-col items-end gap-1">
                {ride.estimatedFare && (
                  <div className="flex items-center gap-1" data-testid="text-fare">
                    <span className="text-lg font-bold text-green-600 dark:text-green-400">
                      ${parseFloat(ride.estimatedFare).toFixed(2)}
                    </span>
                    {ride.surgeMultiplier && parseFloat(ride.surgeMultiplier) > 1 && (
                      <Badge variant="secondary" className="bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 text-xs no-default-hover-elevate">
                        <Zap className="w-3 h-3 mr-0.5" />
                        {ride.surgeMultiplier}x
                      </Badge>
                    )}
                  </div>
                )}
                {ride.distanceToPickup && (
                  <div className="text-xs text-muted-foreground">
                    <span className="font-semibold text-foreground">{ride.distanceToPickup} mi</span> away
                    {ride.estimatedMinutesToPickup && (
                      <span className="ml-1">({ride.estimatedMinutesToPickup} min)</span>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
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

        {ride.status === "requested" && ride.distanceMiles && (
          <div className="flex items-center gap-3 mb-3 p-2 bg-muted/50 rounded-md" data-testid={`trip-direction-${ride.id}`}>
            <div className="flex items-center gap-1.5">
              <Route className="w-4 h-4 text-blue-500" />
              <span className="text-sm font-semibold">{parseFloat(ride.distanceMiles).toFixed(1)} mi trip</span>
            </div>
            <div className="flex items-center gap-1">
              <ArrowUpRight
                className="w-4 h-4 text-primary"
                style={{ transform: `rotate(${getDirectionRotation(parseFloat(ride.pickupLat), parseFloat(ride.pickupLng), parseFloat(ride.dropoffLat), parseFloat(ride.dropoffLng)) - 45}deg)` }}
              />
              <span className="text-xs text-muted-foreground">
                Heading {getDirectionLabel(parseFloat(ride.pickupLat), parseFloat(ride.pickupLng), parseFloat(ride.dropoffLat), parseFloat(ride.dropoffLng))}
              </span>
            </div>
            {ride.estimatedFare && (
              <div className="ml-auto flex items-center gap-1 text-sm">
                <DollarSign className="w-3 h-3" />
                <span className="font-semibold text-green-600 dark:text-green-400">{parseFloat(ride.estimatedFare).toFixed(2)}</span>
                {ride.distanceMiles && (
                  <span className="text-xs text-muted-foreground">
                    (${(parseFloat(ride.estimatedFare) / parseFloat(ride.distanceMiles)).toFixed(2)}/mi)
                  </span>
                )}
              </div>
            )}
          </div>
        )}

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
          {ride.requiredVehicleType && (
            <Badge variant="outline" className="text-xs no-default-hover-elevate" data-testid={`badge-vehicle-type-${ride.id}`}>
              <Car className="w-3 h-3 mr-1" />
              {vehicleTypeLabels[ride.requiredVehicleType] || ride.requiredVehicleType}
            </Badge>
          )}
          {ride.distanceMiles && ride.status !== "requested" && (
            <span className="flex items-center gap-1">
              <Navigation className="w-4 h-4" />
              {parseFloat(ride.distanceMiles).toFixed(1)} mi
            </span>
          )}
          {ride.estimatedFare && ride.status !== "requested" && (
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

        {isMyRide && ride.waitStartedAt && !ride.waitEndedAt && (
          <div className="mb-3 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-md" data-testid={`wait-indicator-${ride.id}`}>
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="font-medium text-amber-800 dark:text-amber-300 flex items-center gap-1 text-sm">
                <Clock className="w-4 h-4" />
                Waiting at appointment
              </span>
              <WaitTimer startedAt={ride.waitStartedAt} />
            </div>
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
              First 15 min free, then $0.50/min
            </p>
          </div>
        )}

        {isMyRide && ride.waitEndedAt && ride.waitTimeMinutes != null && (
          <div className="mb-3 p-2 bg-muted rounded-md text-sm" data-testid={`wait-completed-${ride.id}`}>
            <span className="font-medium">Wait completed:</span> {ride.waitTimeMinutes} min
            {ride.waitTimeMinutes > 15 && (
              <span className="text-orange-600 dark:text-orange-400 ml-1">
                (+${((ride.waitTimeMinutes - 15) * 0.50).toFixed(2)} charge)
              </span>
            )}
          </div>
        )}

        {ride.medicalNotes && (
          <div className="text-sm mb-3 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-md" data-testid={`medical-notes-${ride.id}`}>
            <span className="font-medium text-amber-800 dark:text-amber-300 flex items-center gap-1 mb-1">
              <span className="text-base">🏥</span> Patient Care Notes:
            </span>
            <span className="text-amber-700 dark:text-amber-400">{ride.medicalNotes}</span>
          </div>
        )}
        {ride.notes && !ride.medicalNotes && (
          <div className="text-sm text-muted-foreground mb-3 p-2 bg-muted rounded-md">
            <span className="font-medium">Notes:</span> {ride.notes}
          </div>
        )}
        {ride.isRoundTrip && (
          <div className="text-sm mb-3 p-2 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-md" data-testid={`round-trip-${ride.id}`}>
            <span className="font-medium text-blue-700 dark:text-blue-300">↩ Round Trip</span>
            {ride.returnPickupTime && (
              <span className="text-blue-600 dark:text-blue-400 ml-2">Return: {ride.returnPickupTime}</span>
            )}
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

          {isMyRide && (ride.status === "arrived" || ride.status === "in_progress") && !ride.waitStartedAt && (
            <Button
              variant="outline"
              onClick={() => startWaitMutation.mutate()}
              disabled={startWaitMutation.isPending}
              data-testid={`button-start-wait-${ride.id}`}
            >
              <Clock className="w-4 h-4 mr-2" />
              {startWaitMutation.isPending ? "Starting..." : "Start Wait"}
            </Button>
          )}

          {isMyRide && ride.waitStartedAt && !ride.waitEndedAt && (
            <Button
              variant="outline"
              onClick={() => endWaitMutation.mutate()}
              disabled={endWaitMutation.isPending}
              data-testid={`button-patient-ready-${ride.id}`}
            >
              <CheckCircle2 className="w-4 h-4 mr-2" />
              {endWaitMutation.isPending ? "Ending..." : "Patient Ready"}
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
                  {(ride.waitTimeMinutes || 0) > 0 && (
                    <div className="flex justify-between">
                      <span>Wait time ({ride.waitTimeMinutes} min{(ride.waitTimeMinutes || 0) <= 15 ? ", within grace" : ""}):</span>
                      <span>
                        {(ride.waitTimeMinutes || 0) > 15
                          ? `$${(((ride.waitTimeMinutes || 0) - 15) * 0.50).toFixed(2)}`
                          : "$0.00"}
                      </span>
                    </div>
                  )}
                  {ride.waitStartedAt && !ride.waitEndedAt && (
                    <div className="flex justify-between text-amber-600 dark:text-amber-400">
                      <span>Wait in progress:</span>
                      <span>TBD</span>
                    </div>
                  )}
                  <div className="flex justify-between font-medium text-foreground border-t pt-1 mt-1">
                    <span>Est. Total:</span>
                    <span>
                      ${Math.max(22, (20 + parseFloat(ride.distanceMiles || "0") * 2.50) * parseFloat(ride.surgeMultiplier || "1") + parseFloat(actualTolls || "0") + Math.max(0, (ride.waitTimeMinutes || 0) - 15) * 0.50).toFixed(2)}
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

interface RideWithDistance extends Ride {
  distanceToPickup?: string | null;
  estimatedMinutesToPickup?: number | null;
}

export default function DriverDashboard() {
  const { toast } = useToast();
  const [selectedRide, setSelectedRide] = useState<Ride | null>(null);
  const [isAvailable, setIsAvailable] = useState(true);
  const [patientTransportEnabled, setPatientTransportEnabled] = useState(true);
  const [medicalCourierEnabled, setMedicalCourierEnabled] = useState(false);
  const [currentDriverId, setCurrentDriverId] = useState<number | null>(null);
  const [newRideIds, setNewRideIds] = useState<Set<number>>(new Set());
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [driverLocation, setDriverLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationEnabled, setLocationEnabled] = useState(false);
  const locationWatchRef = useRef<number | null>(null);

  const { data: activeRides = [], isLoading: ridesLoading, refetch: refetchRides } = useQuery<Ride[]>({
    queryKey: ["/api/rides"],
  });

  const { data: poolRides = [], refetch: refetchPoolRides } = useQuery<RideWithDistance[]>({
    queryKey: ["/api/rides/pool", driverLocation?.lat, driverLocation?.lng],
    queryFn: async () => {
      const params = driverLocation 
        ? `?driverLat=${driverLocation.lat}&driverLng=${driverLocation.lng}` 
        : "";
      const res = await fetch(`/api/rides/pool${params}`);
      return res.json();
    },
    refetchInterval: 10000,
  });

  const { data: allRides = [], refetch: refetchAllRides } = useQuery<Ride[]>({
    queryKey: ["/api/rides/all"],
  });

  const { data: courierPool = [] } = useQuery<any[]>({
    queryKey: ["/api/courier/deliveries/pool"],
    refetchInterval: 15000,
  });

  const { data: activeDeliveries = [] } = useQuery<any[]>({
    queryKey: ["/api/courier/deliveries/active"],
    refetchInterval: 10000,
  });

  const acceptDeliveryMutation = useMutation({
    mutationFn: async (deliveryId: number) => {
      const response = await apiRequest("POST", `/api/courier/deliveries/${deliveryId}/accept`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/courier/deliveries/pool"] });
      queryClient.invalidateQueries({ queryKey: ["/api/courier/deliveries/active"] });
      toast({ title: "Delivery accepted!", description: "Navigate to the pickup location." });
    },
    onError: (error: any) => {
      toast({ title: "Cannot accept delivery", description: error.message, variant: "destructive" });
    },
  });

  const updateDeliveryStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      const response = await apiRequest("PATCH", `/api/courier/deliveries/${id}/status`, { status });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/courier/deliveries/active"] });
      queryClient.invalidateQueries({ queryKey: ["/api/courier/deliveries/pool"] });
      toast({ title: "Delivery status updated" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to update status", description: error.message, variant: "destructive" });
    },
  });

  const { data: drivers = [] } = useQuery<DriverProfile[]>({
    queryKey: ["/api/drivers"],
  });

  interface DocumentAlert {
    type: string;
    document: string;
    expiryDate: string;
    status: "expired" | "expiring_soon" | "valid";
  }
  const { data: documentAlerts } = useQuery<{ alerts: DocumentAlert[]; backgroundCheckStatus: string }>({
    queryKey: [`/api/drivers/${currentDriverId}/document-alerts`],
    enabled: !!currentDriverId,
  });

  interface SurgeZone {
    lat: number;
    lng: number;
    demandCount: number;
    multiplier: number;
    label: string;
    radius: number;
  }
  interface SurgeZoneData {
    zones: SurgeZone[];
    globalMultiplier: string;
    totalDemand: number;
    availableDrivers: number;
    scheduledSurge: { reason: string; multiplier: string } | null;
  }
  const { data: surgeData } = useQuery<SurgeZoneData>({
    queryKey: ["/api/surge/zones"],
    refetchInterval: 30000,
  });

  const updateLocationMutation = useMutation({
    mutationFn: async (location: { lat: number; lng: number }) => {
      if (!currentDriverId) return;
      const response = await apiRequest("PATCH", `/api/drivers/${currentDriverId}/location`, location);
      return response.json();
    },
  });

  useEffect(() => {
    if (!currentDriverId || !locationEnabled) return;

    const startLocationTracking = () => {
      if (!navigator.geolocation) {
        toast({ title: "Location Not Supported", description: "Your browser doesn't support location tracking.", variant: "destructive" });
        return;
      }

      locationWatchRef.current = navigator.geolocation.watchPosition(
        (position) => {
          const newLocation = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };
          setDriverLocation(newLocation);
          updateLocationMutation.mutate(newLocation);
        },
        (error) => {
          console.error("Location error:", error);
          if (error.code === error.PERMISSION_DENIED) {
            toast({ title: "Location Access Denied", description: "Enable location to see distances to rides.", variant: "destructive" });
            setLocationEnabled(false);
          }
        },
        { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 }
      );
    };

    startLocationTracking();

    return () => {
      if (locationWatchRef.current !== null) {
        navigator.geolocation.clearWatch(locationWatchRef.current);
      }
    };
  }, [currentDriverId, locationEnabled, toast]);

  const enableLocationTracking = useCallback(() => {
    if (!navigator.geolocation) {
      toast({ title: "Location Not Supported", description: "Your browser doesn't support location tracking.", variant: "destructive" });
      return;
    }
    setLocationEnabled(true);
    toast({ title: "Location Enabled", description: "You'll see distances to nearby rides." });
  }, [toast]);

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
      setPatientTransportEnabled(drivers[0].patientTransportEnabled ?? true);
      setMedicalCourierEnabled(drivers[0].medicalCourierEnabled ?? false);
    }
  }, [drivers, currentDriverId]);

  const serviceToggleMutation = useMutation({
    mutationFn: async (data: { patientTransportEnabled?: boolean; medicalCourierEnabled?: boolean }) => {
      if (!currentDriverId) return;
      const response = await apiRequest("PATCH", `/api/drivers/${currentDriverId}/services`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/drivers"] });
      toast({ title: "Service preference updated" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to update", description: error.message, variant: "destructive" });
    },
  });

  useEffect(() => {
    let ws: WebSocket | null = null;
    let reconnectTimeout: NodeJS.Timeout | null = null;
    let isMounted = true;
    
    const connectWebSocket = async () => {
      if (!isMounted) return;
      
      try {
        // Get authentication token for WebSocket
        const tokenResponse = await fetch("/api/auth/ws-token", { credentials: "include" });
        if (!tokenResponse.ok || !isMounted) {
          if (isMounted) console.log("Not authenticated for ride WebSocket - skipping connection");
          return;
        }
        const { token } = await tokenResponse.json();
        
        if (!isMounted) return;
        
        const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
        ws = new WebSocket(`${protocol}//${window.location.host}/ws/rides?token=${token}`);
        
        ws.onmessage = (event) => {
          if (!isMounted) return;
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
          refetchPoolRides();
        };

        ws.onerror = (error) => {
          console.error("WebSocket error:", error);
        };
        
        ws.onclose = () => {
          // Only reconnect if component is still mounted
          if (isMounted) {
            reconnectTimeout = setTimeout(connectWebSocket, 30000);
          }
        };
      } catch (error) {
        console.error("Failed to connect ride WebSocket:", error);
      }
    };
    
    connectWebSocket();

    return () => {
      isMounted = false;
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (ws) {
        ws.onclose = null; // Prevent onclose from triggering reconnect
        ws.close();
      }
    };
  }, [refetchRides, refetchAllRides, refetchPoolRides, playNotificationSound, toast]);

  const requestedRides = poolRides.length > 0 ? poolRides : activeRides.filter((r) => r.status === "requested");
  const myActiveRides = activeRides.filter((r) => 
    ["accepted", "driver_enroute", "arrived", "in_progress"].includes(r.status) &&
    (currentDriverId ? r.driverId === currentDriverId : true)
  );
  const completedRides = allRides.filter((r) => r.status === "completed");

  const currentDriver = drivers.find(d => d.id === currentDriverId);

  return (
    <div className="min-h-screen bg-background">
      <Header title="Driver Dashboard" showBack />
      <main className="container mx-auto px-4 py-8">
        <div className="mb-4">
          <BackToHome />
        </div>
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
                variant={locationEnabled ? "default" : "outline"}
                size="sm"
                onClick={locationEnabled ? () => setLocationEnabled(false) : enableLocationTracking}
                data-testid="button-location-toggle"
              >
                <Navigation className="w-4 h-4 mr-2" />
                {locationEnabled ? "Location On" : "Enable Location"}
              </Button>
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
              <div className="flex items-center gap-3 border-l pl-3">
                <div className="flex items-center gap-1.5">
                  <Car className="w-3.5 h-3.5 text-blue-600" />
                  <span className="text-xs text-muted-foreground">Rides</span>
                  <Switch
                    checked={patientTransportEnabled}
                    onCheckedChange={(checked) => {
                      if (!checked && !medicalCourierEnabled) {
                        toast({ title: "At least one service must be enabled", variant: "destructive" });
                        return;
                      }
                      setPatientTransportEnabled(checked);
                      serviceToggleMutation.mutate({ patientTransportEnabled: checked });
                    }}
                    data-testid="switch-patient-transport"
                    className="scale-75"
                  />
                </div>
                <div className="flex items-center gap-1.5">
                  <Package className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-xs text-muted-foreground">Courier</span>
                  <Switch
                    checked={medicalCourierEnabled}
                    onCheckedChange={(checked) => {
                      if (!checked && !patientTransportEnabled) {
                        toast({ title: "At least one service must be enabled", variant: "destructive" });
                        return;
                      }
                      setMedicalCourierEnabled(checked);
                      serviceToggleMutation.mutate({ medicalCourierEnabled: checked });
                    }}
                    data-testid="switch-medical-courier"
                    className="scale-75"
                  />
                </div>
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
            <Link href="/driver/trip-history">
              <Card className="hover-elevate cursor-pointer">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-purple-500/10 rounded-md">
                      <Clock className="w-5 h-5 text-purple-500" />
                    </div>
                    <div>
                      <p className="text-lg font-bold">History</p>
                      <p className="text-xs text-muted-foreground">Trip details</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
            <Link href="/driver/earnings">
              <Card className="hover-elevate cursor-pointer">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-yellow-500/10 rounded-md">
                      <TrendingUp className="w-5 h-5 text-yellow-500" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">
                        ${completedRides.reduce((sum, r) => sum + (parseFloat(r.driverEarnings || r.estimatedFare || "0")), 0).toFixed(0)}
                      </p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        Your Earnings
                        <FileText className="w-3 h-3" />
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
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
            <Link href="/driver-payouts">
              <Card className="hover-elevate cursor-pointer bg-gradient-to-br from-green-600 to-emerald-700 text-white border-0">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-white/20 rounded-md">
                      <Wallet className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <p className="text-lg font-bold">Cash Out</p>
                      <p className="text-xs text-green-100">Transfer to bank</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          </div>

          {documentAlerts && (documentAlerts.alerts.some((a: any) => a.status === "expired") || documentAlerts.backgroundCheckStatus === "failed") && (
            <Alert variant="destructive" className="mb-6" data-testid="banner-compliance">
              <ShieldAlert className="w-4 h-4" />
              <AlertDescription>
                <div className="font-semibold mb-2">Compliance Issues — Action Required</div>
                <ul className="list-disc pl-5 space-y-1 text-sm">
                  {documentAlerts.alerts.filter((a: any) => a.status === "expired").map((alert: any, i: number) => (
                    <li key={i}>{alert.document} is expired (since {alert.expiryDate})</li>
                  ))}
                  {documentAlerts.backgroundCheckStatus === "failed" && (
                    <li>Background check failed</li>
                  )}
                  {documentAlerts.backgroundCheckStatus === "not_started" && (
                    <li>Background check not completed</li>
                  )}
                </ul>
                <p className="text-sm mt-2">You cannot accept rides until these issues are resolved.</p>
                <Link href="/driver-kyc">
                  <Button variant="outline" size="sm" className="mt-2" data-testid="button-update-docs">
                    Update Documents
                  </Button>
                </Link>
              </AlertDescription>
            </Alert>
          )}

          {currentDriver && !currentDriver.isContractorOnboarded && (
            <Alert className="mb-6 border-amber-500 bg-amber-50 dark:bg-amber-950/20 text-amber-800 dark:text-amber-300" data-testid="banner-ic-agreement">
              <FileText className="w-4 h-4 text-amber-600" />
              <AlertDescription className="flex items-center justify-between gap-4 flex-wrap">
                <span className="font-semibold">Action Required: Sign Independent Contractor Agreement</span>
                <Link href="/driver/ic-agreement">
                  <Button variant="outline" data-testid="button-sign-ic-agreement">
                    <FileText className="w-4 h-4 mr-2" />
                    Sign Agreement
                  </Button>
                </Link>
              </AlertDescription>
            </Alert>
          )}

          {documentAlerts && documentAlerts.alerts.filter(a => a.status === "expired" || a.status === "expiring_soon").length > 0 && (
            <div className="space-y-2 mb-6" data-testid="document-alerts">
              {documentAlerts.alerts.filter(a => a.status === "expired").map((alert, i) => (
                <Alert key={`expired-${i}`} variant="destructive">
                  <AlertTriangle className="w-4 h-4" />
                  <AlertDescription>
                    <span className="font-semibold">{alert.document}</span> expired on {alert.expiryDate}. Please update immediately to continue accepting rides.
                  </AlertDescription>
                </Alert>
              ))}
              {documentAlerts.alerts.filter(a => a.status === "expiring_soon").map((alert, i) => (
                <Alert key={`expiring-${i}`} className="border-amber-500 bg-amber-50 dark:bg-amber-950/20 text-amber-800 dark:text-amber-300">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  <AlertDescription>
                    <span className="font-semibold">{alert.document}</span> expires on {alert.expiryDate}. Please renew soon.
                  </AlertDescription>
                </Alert>
              ))}
            </div>
          )}

          {currentDriver && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6" data-testid="driver-stats">
              <Card>
                <CardContent className="p-4 text-center">
                  <div className="flex items-center justify-center gap-1 mb-1">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star key={s} className={`w-4 h-4 ${s <= Math.round(parseFloat(currentDriver.averageRating || "5")) ? "fill-yellow-400 text-yellow-400" : "text-gray-300"}`} />
                    ))}
                  </div>
                  <p className="text-2xl font-bold" data-testid="text-avg-rating">{parseFloat(currentDriver.averageRating || "5").toFixed(1)}</p>
                  <p className="text-xs text-muted-foreground">Average Rating ({currentDriver.totalRatings || 0} reviews)</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <p className="text-2xl font-bold text-green-600" data-testid="text-acceptance-rate">
                    {currentDriver.totalRidesCompleted && (currentDriver.totalRidesCompleted + (currentDriver.totalRidesCancelled || 0)) > 0
                      ? Math.round((currentDriver.totalRidesCompleted / (currentDriver.totalRidesCompleted + (currentDriver.totalRidesCancelled || 0))) * 100)
                      : 100}%
                  </p>
                  <p className="text-xs text-muted-foreground">Acceptance Rate</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <p className="text-2xl font-bold text-amber-600" data-testid="text-cancel-rate">
                    {currentDriver.totalRidesCancelled && (currentDriver.totalRidesCompleted || 0) + currentDriver.totalRidesCancelled > 0
                      ? Math.round((currentDriver.totalRidesCancelled / ((currentDriver.totalRidesCompleted || 0) + currentDriver.totalRidesCancelled)) * 100)
                      : 0}%
                  </p>
                  <p className="text-xs text-muted-foreground">Cancellation Rate</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <div className="mb-1">
                    {documentAlerts?.backgroundCheckStatus === "passed" && <ShieldCheck className="w-6 h-6 text-green-600 mx-auto" />}
                    {documentAlerts?.backgroundCheckStatus === "pending" && <Shield className="w-6 h-6 text-yellow-500 mx-auto" />}
                    {documentAlerts?.backgroundCheckStatus === "failed" && <AlertTriangle className="w-6 h-6 text-red-500 mx-auto" />}
                    {(!documentAlerts?.backgroundCheckStatus || documentAlerts?.backgroundCheckStatus === "not_started") && <Shield className="w-6 h-6 text-gray-400 mx-auto" />}
                  </div>
                  <Badge
                    variant={documentAlerts?.backgroundCheckStatus === "passed" ? "default" : "secondary"}
                    className={`no-default-hover-elevate ${
                      documentAlerts?.backgroundCheckStatus === "passed" ? "bg-green-600" :
                      documentAlerts?.backgroundCheckStatus === "pending" ? "bg-yellow-500" :
                      documentAlerts?.backgroundCheckStatus === "failed" ? "bg-red-500 text-white" :
                      ""
                    }`}
                    data-testid="badge-background-check"
                  >
                    {documentAlerts?.backgroundCheckStatus === "passed" ? "BG Check Passed" :
                     documentAlerts?.backgroundCheckStatus === "pending" ? "BG Check Pending" :
                     documentAlerts?.backgroundCheckStatus === "failed" ? "BG Check Failed" :
                     "BG Check Not Started"}
                  </Badge>
                  <p className="text-xs text-muted-foreground mt-1">Background Check</p>
                </CardContent>
              </Card>
            </div>
          )}

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
          <>
          {surgeData && parseFloat(surgeData.globalMultiplier) > 1 && (
            <Card className="mb-6 border-orange-300 dark:border-orange-700 bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-950/20 dark:to-amber-950/20" data-testid="surge-banner">
              <CardContent className="p-4">
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-orange-100 dark:bg-orange-900/40 rounded-full">
                      <Flame className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                    </div>
                    <div>
                      <p className="font-semibold text-orange-800 dark:text-orange-300">
                        Surge Active — {surgeData.globalMultiplier}x Multiplier
                      </p>
                      <p className="text-xs text-orange-600 dark:text-orange-400">
                        {surgeData.totalDemand} active request{surgeData.totalDemand !== 1 ? "s" : ""} · {surgeData.availableDrivers} driver{surgeData.availableDrivers !== 1 ? "s" : ""} available
                        {surgeData.scheduledSurge && ` · ${surgeData.scheduledSurge.reason || "Scheduled surge"}`}
                      </p>
                    </div>
                  </div>
                  <Badge className="ml-auto bg-orange-500 text-white no-default-hover-elevate">
                    Earn more on rides!
                  </Badge>
                </div>
                {surgeData.zones.length > 0 && (
                  <div className="mt-3 flex gap-2 flex-wrap">
                    {surgeData.zones.filter(z => z.multiplier > 1).map((zone, i) => (
                      <Badge key={i} variant="outline" className="text-xs border-orange-300 text-orange-700 dark:text-orange-400 no-default-hover-elevate">
                        <Zap className="w-3 h-3 mr-1" />
                        {zone.label} ({zone.multiplier}x) · {zone.demandCount} ride{zone.demandCount !== 1 ? "s" : ""}
                      </Badge>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <Tabs defaultValue="available" className="w-full">
                <TabsList className="grid w-full grid-cols-4 mb-4">
                  <TabsTrigger value="available" data-testid="tab-available">
                    <Briefcase className="w-4 h-4 mr-1" />
                    Rides ({requestedRides.length})
                  </TabsTrigger>
                  <TabsTrigger value="deliveries" data-testid="tab-deliveries">
                    <Package className="w-4 h-4 mr-1" />
                    Deliveries ({courierPool.length})
                  </TabsTrigger>
                  <TabsTrigger value="active" data-testid="tab-active">
                    <Play className="w-4 h-4 mr-1" />
                    Active ({myActiveRides.length + activeDeliveries.length})
                  </TabsTrigger>
                  <TabsTrigger value="completed" data-testid="tab-completed">
                    <CheckCircle2 className="w-4 h-4 mr-1" />
                    Done ({completedRides.length})
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

                <TabsContent value="deliveries" className="space-y-4">
                  {courierPool.length === 0 ? (
                    <Card>
                      <CardContent className="p-8 text-center">
                        <Package className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
                        <h3 className="font-semibold mb-2">No Deliveries Available</h3>
                        <p className="text-muted-foreground text-sm">Medical courier delivery requests will appear here.</p>
                      </CardContent>
                    </Card>
                  ) : (
                    courierPool.map((delivery: any) => (
                      <Card key={delivery.id} className="border-l-4 border-l-blue-500" data-testid={`card-delivery-${delivery.id}`}>
                        <CardContent className="p-4">
                          <div className="flex justify-between items-start mb-3">
                            <div>
                              <Badge variant={delivery.priority === "stat" ? "destructive" : delivery.priority === "urgent" ? "default" : "secondary"} className="mb-2">
                                {delivery.priority?.toUpperCase()}
                              </Badge>
                              <h3 className="font-semibold">{delivery.packageType?.replace(/_/g, " ")}</h3>
                              {delivery.companyName && <p className="text-xs text-muted-foreground">From: {delivery.companyName}</p>}
                            </div>
                            {delivery.estimatedFare && (
                              <span className="text-lg font-bold text-green-600">${delivery.estimatedFare}</span>
                            )}
                          </div>
                          <div className="space-y-2 text-sm mb-3">
                            <div className="flex items-start gap-2">
                              <MapPin className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                              <span>{delivery.pickupAddress}</span>
                            </div>
                            <div className="flex items-start gap-2">
                              <MapPin className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                              <span>{delivery.dropoffAddress}</span>
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2 mb-3">
                            {delivery.temperatureControl !== "ambient" && (
                              <Badge variant="outline"><Thermometer className="h-3 w-3 mr-1" />{delivery.temperatureControl === "cold_chain" ? "Cold Chain" : delivery.temperatureControl === "frozen" ? "Frozen" : "CRT"}</Badge>
                            )}
                            {delivery.signatureRequired && <Badge variant="outline">Signature Req.</Badge>}
                            {delivery.chainOfCustody && <Badge variant="outline">Chain of Custody</Badge>}
                          </div>
                          {delivery.packageDescription && <p className="text-xs text-muted-foreground mb-3">{delivery.packageDescription}</p>}
                          <Button
                            className="w-full"
                            onClick={() => acceptDeliveryMutation.mutate(delivery.id)}
                            disabled={acceptDeliveryMutation.isPending}
                            data-testid={`button-accept-delivery-${delivery.id}`}
                          >
                            <Package className="w-4 h-4 mr-2" /> Accept Delivery
                          </Button>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </TabsContent>

                <TabsContent value="active" className="space-y-4">
                  {activeDeliveries.length > 0 && activeDeliveries.map((delivery: any) => {
                    const nextStatus: Record<string, string> = {
                      accepted: "en_route_pickup",
                      en_route_pickup: "picked_up",
                      picked_up: "in_transit",
                      in_transit: "arrived",
                      arrived: "delivered",
                    };
                    const statusLabel: Record<string, string> = {
                      en_route_pickup: "En Route to Pickup",
                      picked_up: "Mark as Picked Up",
                      in_transit: "Start Transit",
                      arrived: "Mark Arrived",
                      delivered: "Mark Delivered",
                    };
                    const next = nextStatus[delivery.status];
                    return (
                      <Card key={`del-${delivery.id}`} className="border-l-4 border-l-purple-500" data-testid={`card-active-delivery-${delivery.id}`}>
                        <CardContent className="p-4">
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <Badge className="bg-purple-100 text-purple-800 mb-1">Courier Delivery</Badge>
                              <h3 className="font-semibold">{delivery.packageType?.replace(/_/g, " ")}</h3>
                              {delivery.companyName && <p className="text-xs text-muted-foreground">{delivery.companyName}</p>}
                            </div>
                            <Badge variant="outline">{delivery.status?.replace(/_/g, " ")}</Badge>
                          </div>
                          <div className="space-y-1 text-sm mb-3">
                            <div className="flex items-start gap-2"><MapPin className="w-4 h-4 text-green-600 mt-0.5" /><span>{delivery.pickupAddress}</span></div>
                            <div className="flex items-start gap-2"><MapPin className="w-4 h-4 text-red-600 mt-0.5" /><span>{delivery.dropoffAddress}</span></div>
                          </div>
                          {delivery.specialInstructions && <p className="text-xs text-muted-foreground bg-yellow-50 dark:bg-yellow-950 p-2 rounded mb-3">{delivery.specialInstructions}</p>}
                          {next && (
                            <Button
                              className="w-full"
                              onClick={() => updateDeliveryStatusMutation.mutate({ id: delivery.id, status: next })}
                              disabled={updateDeliveryStatusMutation.isPending}
                              data-testid={`button-delivery-status-${delivery.id}`}
                            >
                              {statusLabel[next] || next}
                            </Button>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                  {myActiveRides.length === 0 && activeDeliveries.length === 0 ? (
                    <Card>
                      <CardContent className="p-6 text-center text-muted-foreground">
                        No active rides or deliveries. Accept a job to get started.
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
                    {surgeData && surgeData.zones.some(z => z.multiplier > 1) && (
                      <Badge variant="secondary" className="bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 text-xs no-default-hover-elevate">
                        <Flame className="w-3 h-3 mr-1" />
                        Surge zones active
                      </Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[400px] rounded-md overflow-hidden border" data-testid="driver-ride-map">
                    <MapContainer
                      center={[39.8283, -98.5795]}
                      zoom={4}
                      style={{ height: "100%", width: "100%" }}
                    >
                      <TileLayer
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                      />
                      {surgeData && surgeData.zones.map((zone, i) => (
                        <Circle
                          key={`surge-${i}`}
                          center={[zone.lat, zone.lng]}
                          radius={zone.radius}
                          pathOptions={{
                            color: getSurgeColor(zone.multiplier),
                            fillColor: getSurgeColor(zone.multiplier),
                            fillOpacity: 0.15,
                            weight: 2,
                            dashArray: zone.multiplier >= 1.15 ? undefined : "5 5",
                          }}
                        >
                          <Popup>
                            <div className="p-1 text-center">
                              <p className="font-bold text-lg">{zone.multiplier}x</p>
                              <p className="font-semibold">{zone.label}</p>
                              <p className="text-sm text-gray-600">{zone.demandCount} active ride{zone.demandCount !== 1 ? "s" : ""}</p>
                            </div>
                          </Popup>
                        </Circle>
                      ))}
                      {activeRides
                        .filter((r) => r.status !== "completed" && r.status !== "cancelled")
                        .flatMap((ride) => {
                          const pickupPos: [number, number] = [parseFloat(ride.pickupLat), parseFloat(ride.pickupLng)];
                          const dropoffPos: [number, number] = [parseFloat(ride.dropoffLat), parseFloat(ride.dropoffLng)];
                          return [
                            <Polyline
                              key={`route-${ride.id}`}
                              positions={[pickupPos, dropoffPos]}
                              pathOptions={{
                                color: ride.status === "requested" ? "#3b82f6" : "#8b5cf6",
                                weight: 2,
                                opacity: 0.6,
                                dashArray: "6 4",
                              }}
                            />,
                            <Marker
                              key={`pickup-${ride.id}`}
                              position={pickupPos}
                              icon={pickupIcon}
                            >
                              <Popup>
                                <div className="p-1">
                                  <p className="font-semibold">Pickup: {ride.patientName}</p>
                                  <p className="text-sm">{ride.pickupAddress}</p>
                                  {ride.estimatedFare && <p className="text-sm font-bold text-green-600">${parseFloat(ride.estimatedFare).toFixed(2)}</p>}
                                  {ride.distanceMiles && <p className="text-xs text-gray-500">{parseFloat(ride.distanceMiles).toFixed(1)} mi trip</p>}
                                </div>
                              </Popup>
                            </Marker>,
                            <Marker
                              key={`dropoff-${ride.id}`}
                              position={dropoffPos}
                              icon={dropoffIcon}
                            >
                              <Popup>
                                <div className="p-1">
                                  <p className="font-semibold">Dropoff: {ride.patientName}</p>
                                  <p className="text-sm">{ride.dropoffAddress}</p>
                                </div>
                              </Popup>
                            </Marker>,
                          ];
                        })}
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
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded-full border-2 border-dashed border-blue-500" />
                      <span>Trip route</span>
                    </div>
                    {surgeData && surgeData.zones.some(z => z.multiplier > 1) && (
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded-full bg-orange-400/30 border border-orange-400" />
                        <span>Surge zone</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
          </>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
