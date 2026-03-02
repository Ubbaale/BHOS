import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import Header from "@/components/Header";

import BackToHome from "@/components/BackToHome";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { RideChat } from "@/components/RideChat";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { 
  Car, Phone, MapPin, Clock, Shield, Share2, AlertTriangle, 
  User, CheckCircle2, Navigation, MessageCircle, Accessibility, Copy, ExternalLink,
  DollarSign, Heart, CreditCard, Loader2, Star
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Ride } from "@shared/schema";
import { format } from "date-fns";

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

const driverIcon = new L.DivIcon({
  html: `<div style="background:#3b82f6;border:2px solid #fff;border-radius:50%;width:32px;height:32px;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 6px rgba(0,0,0,0.3);">
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-2-2.2-3.2C13 5.9 12 5 11 5H5.6c-.6 0-1.1.4-1.4.9L3 8.5C1.6 9.1 1 10.4 1 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/></svg>
  </div>`,
  className: "",
  iconSize: [32, 32],
  iconAnchor: [16, 16],
});

function MapBoundsUpdater({ bounds }: { bounds: L.LatLngBoundsExpression | null }) {
  const map = useMap();
  useEffect(() => {
    if (bounds) {
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
    }
  }, [map, bounds]);
  return null;
}

interface DriverInfo {
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
  ride: {
    verificationCode: string | null;
    estimatedArrivalTime: string | null;
    status: string;
  };
}

interface TrackingInfo {
  ride: Ride;
  driver: {
    id: number;
    fullName: string;
    phone: string;
    currentLat: string | null;
    currentLng: string | null;
  } | null;
  tracking: {
    distanceToPickup: string | null;
    distanceToDropoff: string | null;
    estimatedMinutesToPickup: number | null;
    estimatedMinutesToDropoff: number | null;
    lastUpdated: string;
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

interface TipPaymentFormProps {
  onSuccess: () => void;
  onCancel: () => void;
  amount: number;
}

function TipPaymentFormContent({ onSuccess, onCancel, amount }: TipPaymentFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setIsProcessing(true);
    setErrorMessage(null);

    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: window.location.href,
      },
      redirect: 'if_required',
    });

    if (error) {
      setErrorMessage(error.message || 'Payment failed. Please try again.');
      setIsProcessing(false);
    } else {
      onSuccess();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="text-center mb-4">
        <p className="text-muted-foreground">
          Tip amount: <span className="text-lg font-bold text-foreground">${amount.toFixed(2)}</span>
        </p>
      </div>
      
      <PaymentElement />
      
      {errorMessage && (
        <Alert variant="destructive">
          <AlertTriangle className="w-4 h-4" />
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      )}
      
      <div className="flex gap-3">
        <Button 
          type="button" 
          variant="outline" 
          onClick={onCancel}
          disabled={isProcessing}
          className="flex-1"
          data-testid="button-cancel-tip-payment"
        >
          Cancel
        </Button>
        <Button 
          type="submit" 
          disabled={!stripe || isProcessing}
          className="flex-1"
          data-testid="button-confirm-tip-payment"
        >
          {isProcessing ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              <Heart className="w-4 h-4 mr-2" />
              Send ${amount.toFixed(2)} Tip
            </>
          )}
        </Button>
      </div>
    </form>
  );
}

export default function TrackRide() {
  const { id } = useParams<{ id: string }>();
  const rideId = parseInt(id || "0");
  const { toast } = useToast();
  const [showChat, setShowChat] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [shareContact, setShareContact] = useState({ name: "", phone: "", email: "" });
  const [createdShareCode, setCreatedShareCode] = useState<string | null>(null);
  const [selectedTip, setSelectedTip] = useState<number | null>(null);
  const [customTip, setCustomTip] = useState("");
  const [tipDialogOpen, setTipDialogOpen] = useState(false);
  
  const [stripePromise, setStripePromise] = useState<Promise<any> | null>(null);
  const [tipClientSecret, setTipClientSecret] = useState<string | null>(null);
  const [showTipPayment, setShowTipPayment] = useState(false);
  const [pendingTipAmount, setPendingTipAmount] = useState<number>(0);
  const [ratingValue, setRatingValue] = useState<number>(0);
  const [ratingHover, setRatingHover] = useState<number>(0);
  const [ratingComment, setRatingComment] = useState("");
  const [ratingDialogOpen, setRatingDialogOpen] = useState(false);
  const [hasRated, setHasRated] = useState(false);
  
  useEffect(() => {
    const fetchStripeKey = async () => {
      try {
        const response = await fetch('/api/stripe/publishable-key');
        if (response.ok) {
          const { publishableKey } = await response.json();
          if (publishableKey) {
            setStripePromise(loadStripe(publishableKey));
          }
        }
      } catch (error) {
        console.log('Stripe not configured:', error);
      }
    };
    fetchStripeKey();
  }, []);

  // Get tracking token from URL query params and store it
  const [trackingToken, setTrackingToken] = useState<string | null>(() => {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get("token");
  });

  // Strip token from URL after reading (security: avoid leaking in referrers/logs)
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get("token");
    if (token) {
      setTrackingToken(token);
      if (window.history.replaceState) {
        const url = new URL(window.location.href);
        url.searchParams.delete("token");
        window.history.replaceState({}, "", url.pathname);
      }
    }
  }, []);

  const { data: ride, isLoading: rideLoading, error: rideError } = useQuery<Ride>({
    queryKey: ["/api/rides", rideId],
    refetchInterval: 10000,
  });

  const { data: driverInfo, isLoading: driverLoading, error: driverInfoError } = useQuery<DriverInfo>({
    queryKey: ["/api/rides", rideId, "driver-info", trackingToken],
    queryFn: async () => {
      if (!trackingToken) throw new Error("Access token required");
      const res = await fetch(`/api/rides/${rideId}/driver-info?token=${trackingToken}`, { credentials: "include" });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to fetch driver info");
      }
      return res.json();
    },
    enabled: !!ride && !!trackingToken,
    refetchInterval: 10000,
    retry: false,
  });

  const { data: trackingInfo, error: trackingError } = useQuery<TrackingInfo>({
    queryKey: ["/api/rides", rideId, "tracking", trackingToken],
    queryFn: async () => {
      if (!trackingToken) throw new Error("Access token required");
      const res = await fetch(`/api/rides/${rideId}/tracking?token=${trackingToken}`, { credentials: "include" });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to fetch tracking info");
      }
      return res.json();
    },
    enabled: !!ride && !!trackingToken && ["accepted", "driver_enroute", "arrived", "in_progress"].includes(ride?.status || ""),
    refetchInterval: 5000,
    retry: false,
  });

  const { data: existingRating } = useQuery<{ rating: number; comment: string } | null>({
    queryKey: [`/api/rides/${rideId}/rating`],
    enabled: !!ride && ride.status === "completed",
  });

  const shareTripMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/rides/${rideId}/share`, {
        contactName: shareContact.name,
        contactPhone: shareContact.phone,
        contactEmail: shareContact.email || undefined,
      });
      return res.json();
    },
    onSuccess: (data: { shareCode: string }) => {
      setCreatedShareCode(data.shareCode);
      setShareContact({ name: "", phone: "", email: "" });
      queryClient.invalidateQueries({ queryKey: ["/api/rides", rideId, "shares"] });
      toast({
        title: "Trip Shared",
        description: `Share code: ${data.shareCode}. Your contact can track your ride.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const [tipPaymentIntentId, setTipPaymentIntentId] = useState<string | null>(null);

  const createTipPaymentMutation = useMutation({
    mutationFn: async (tipAmount: number) => {
      const res = await apiRequest("POST", `/api/rides/${rideId}/tip-payment`, { tipAmount });
      return res.json();
    },
    onSuccess: (data) => {
      setTipClientSecret(data.clientSecret);
      setTipPaymentIntentId(data.paymentIntentId);
      setShowTipPayment(true);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Could not set up tip payment",
        variant: "destructive",
      });
    },
  });

  const confirmTipMutation = useMutation({
    mutationFn: async ({ tipAmount, paymentIntentId }: { tipAmount: string; paymentIntentId?: string }) => {
      const res = await apiRequest("POST", `/api/rides/${rideId}/tip`, { tipAmount, paymentIntentId });
      return res.json();
    },
    onSuccess: () => {
      setTipDialogOpen(false);
      setShowTipPayment(false);
      setTipClientSecret(null);
      setTipPaymentIntentId(null);
      setSelectedTip(null);
      setCustomTip("");
      setPendingTipAmount(0);
      queryClient.invalidateQueries({ queryKey: ["/api/rides", rideId] });
      toast({
        title: "Thank You!",
        description: "Your tip has been sent to the driver.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const submitRatingMutation = useMutation({
    mutationFn: async ({ rating, comment }: { rating: number; comment: string }) => {
      const res = await apiRequest("POST", `/api/rides/${rideId}/rate`, { 
        rating, 
        comment: comment || undefined,
        ratedBy: "patient"
      });
      return res.json();
    },
    onSuccess: () => {
      setRatingDialogOpen(false);
      setHasRated(true);
      queryClient.invalidateQueries({ queryKey: [`/api/rides/${rideId}/rating`] });
      queryClient.invalidateQueries({ queryKey: ["/api/rides", rideId] });
      toast({
        title: "Thanks for your feedback!",
        description: `You rated this ride ${ratingValue} star${ratingValue !== 1 ? 's' : ''}.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const tipOptions = [
    { label: "15%", percent: 15 },
    { label: "20%", percent: 20 },
    { label: "25%", percent: 25 },
  ];

  const getFinalFare = () => {
    return parseFloat(ride?.finalFare || ride?.estimatedFare || "0");
  };

  const handleTip = () => {
    const tipAmount = customTip ? parseFloat(customTip) : selectedTip ? (getFinalFare() * selectedTip / 100) : 0;
    if (tipAmount > 0) {
      setPendingTipAmount(tipAmount);
      if (stripePromise) {
        createTipPaymentMutation.mutate(tipAmount);
      } else {
        confirmTipMutation.mutate({ tipAmount: tipAmount.toFixed(2) });
      }
    }
  };

  const handleTipPaymentSuccess = () => {
    confirmTipMutation.mutate({ 
      tipAmount: pendingTipAmount.toFixed(2), 
      paymentIntentId: tipPaymentIntentId || undefined 
    });
  };

  const handleTipPaymentCancel = () => {
    setShowTipPayment(false);
    setTipClientSecret(null);
    setTipPaymentIntentId(null);
    setPendingTipAmount(0);
  };

  const getCurrentStep = () => {
    if (!ride) return 0;
    const index = statusSteps.findIndex(s => s.status === ride.status);
    return index >= 0 ? index : 0;
  };

  if (rideLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header title="Track Ride" showBack />
        <main className="container mx-auto px-4 py-8">
          <div className="text-center py-12">Loading ride details...</div>
        </main>
      </div>
    );
  }

  if (!ride) {
    return (
      <div className="min-h-screen bg-background">
        <Header title="Track Ride" showBack />
        <main className="container mx-auto px-4 py-8">
          <div className="text-center py-12">
            <h2 className="text-xl font-semibold mb-2">Ride not found</h2>
            <Link href="/book-ride">
              <Button>Book a New Ride</Button>
            </Link>
          </div>
        </main>
      </div>
    );
  }

  const currentStep = getCurrentStep();
  const driver = driverInfo?.driver;

  const pickupLatLng: [number, number] | null = ride.pickupLat && ride.pickupLng
    ? [parseFloat(ride.pickupLat), parseFloat(ride.pickupLng)]
    : null;
  const dropoffLatLng: [number, number] | null = ride.dropoffLat && ride.dropoffLng
    ? [parseFloat(ride.dropoffLat), parseFloat(ride.dropoffLng)]
    : null;
  const driverLatLng: [number, number] | null = trackingInfo?.driver?.currentLat && trackingInfo?.driver?.currentLng
    ? [parseFloat(trackingInfo.driver.currentLat), parseFloat(trackingInfo.driver.currentLng)]
    : null;

  const mapBounds = useMemo(() => {
    const points: [number, number][] = [];
    if (pickupLatLng) points.push(pickupLatLng);
    if (dropoffLatLng) points.push(dropoffLatLng);
    if (driverLatLng) points.push(driverLatLng);
    if (points.length >= 2) return L.latLngBounds(points);
    return null;
  }, [
    pickupLatLng?.[0], pickupLatLng?.[1],
    dropoffLatLng?.[0], dropoffLatLng?.[1],
    driverLatLng?.[0], driverLatLng?.[1],
  ]);

  const routeLine: [number, number][] = useMemo(() => {
    if (!driverLatLng) return [];
    if (["accepted", "driver_enroute", "arrived"].includes(ride.status) && pickupLatLng) {
      return [driverLatLng, pickupLatLng];
    }
    if (ride.status === "in_progress" && dropoffLatLng) {
      return [driverLatLng, dropoffLatLng];
    }
    return [];
  }, [driverLatLng, pickupLatLng, dropoffLatLng, ride.status]);

  const etaMinutes = useMemo(() => {
    if (["accepted", "driver_enroute"].includes(ride.status)) {
      return trackingInfo?.tracking?.estimatedMinutesToPickup ?? null;
    }
    if (ride.status === "in_progress") {
      return trackingInfo?.tracking?.estimatedMinutesToDropoff ?? null;
    }
    return null;
  }, [ride.status, trackingInfo]);

  const etaLabel = useMemo(() => {
    if (["accepted", "driver_enroute"].includes(ride.status)) return "Arriving in";
    if (ride.status === "in_progress") return "Dropping off in";
    if (ride.status === "arrived") return "Driver has arrived";
    return null;
  }, [ride.status]);

  const mapCenter: [number, number] = pickupLatLng || [40.7128, -74.006];
  const showMap = pickupLatLng || dropoffLatLng;

  return (
    <div className="min-h-screen bg-background">
      <Header title="Track Ride" showBack />
      <main className="container mx-auto px-4 py-8">
        <div className="mb-4">
          <BackToHome />
        </div>
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-6 flex-wrap gap-2">
            <h1 className="text-2xl font-bold" data-testid="text-ride-title">Track Your Ride</h1>
            <Badge variant={ride.status === "completed" ? "default" : "secondary"} data-testid="badge-ride-status">
              {ride.status.replace("_", " ").toUpperCase()}
            </Badge>
          </div>

          {etaLabel && (
            <Card className="mb-6">
              <CardContent className="py-4">
                <div className="flex items-center justify-center gap-3" data-testid="eta-banner">
                  <Navigation className="w-6 h-6 text-primary animate-pulse" />
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground">{etaLabel}</p>
                    {etaMinutes !== null ? (
                      <p className="text-3xl font-bold text-primary" data-testid="text-eta-minutes">
                        {etaMinutes} min
                      </p>
                    ) : ride.status === "arrived" ? (
                      <p className="text-xl font-bold text-green-600 dark:text-green-400" data-testid="text-driver-arrived">
                        Your driver is here
                      </p>
                    ) : (
                      <p className="text-lg font-semibold text-muted-foreground">Calculating...</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {showMap && (
            <Card className="mb-6">
              <CardContent className="p-0 overflow-hidden rounded-md">
                <div style={{ height: "350px", width: "100%" }} data-testid="map-tracking">
                  <MapContainer
                    center={mapCenter}
                    zoom={13}
                    style={{ height: "100%", width: "100%" }}
                    scrollWheelZoom={false}
                  >
                    <TileLayer
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    {mapBounds && <MapBoundsUpdater bounds={mapBounds} />}
                    {pickupLatLng && (
                      <Marker position={pickupLatLng} icon={pickupIcon}>
                        <Popup>Pickup: {ride.pickupAddress}</Popup>
                      </Marker>
                    )}
                    {dropoffLatLng && (
                      <Marker position={dropoffLatLng} icon={dropoffIcon}>
                        <Popup>Dropoff: {ride.dropoffAddress}</Popup>
                      </Marker>
                    )}
                    {driverLatLng && (
                      <Marker position={driverLatLng} icon={driverIcon}>
                        <Popup>{driver?.fullName || "Driver"}</Popup>
                      </Marker>
                    )}
                    {routeLine.length === 2 && (
                      <Polyline
                        positions={routeLine}
                        pathOptions={{ color: "#3b82f6", weight: 4, dashArray: "8 8", opacity: 0.8 }}
                      />
                    )}
                  </MapContainer>
                </div>
              </CardContent>
            </Card>
          )}

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

          {driver && (
            <Card className="mb-6" data-testid="card-driver-uber-style">
              <CardContent className="p-5">
                <div className="flex items-start gap-4">
                  <Avatar className="w-20 h-20">
                    {driver.profilePhotoDoc ? (
                      <AvatarImage src={driver.profilePhotoDoc} alt={driver.fullName} data-testid="img-driver-photo" />
                    ) : null}
                    <AvatarFallback className="text-2xl">
                      {driver.fullName.split(" ").map(n => n[0]).join("").slice(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div>
                        <h3 className="text-lg font-bold" data-testid="text-driver-name">{driver.fullName}</h3>
                        <p className="text-sm text-muted-foreground" data-testid="text-vehicle-info">
                          {[driver.vehicleColor, driver.vehicleYear, driver.vehicleMake, driver.vehicleModel].filter(Boolean).join(" ")}
                        </p>
                      </div>
                      {driverInfo?.ride.verificationCode && (
                        <Badge variant="outline" className="font-mono text-base px-3" data-testid="badge-verification-code">
                          {driverInfo.ride.verificationCode}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-3 flex-wrap">
                      <Badge variant="secondary" className="text-sm" data-testid="badge-plate">{driver.vehiclePlate}</Badge>
                      <Badge variant="outline">{driver.vehicleType}</Badge>
                      {driver.wheelchairAccessible && (
                        <Badge variant="outline"><Accessibility className="w-3 h-3 mr-1" />Wheelchair</Badge>
                      )}
                      {driver.stretcherCapable && (
                        <Badge variant="outline">Stretcher</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-3 flex-wrap">
                      <a href={`tel:${driver.phone}`} data-testid="link-call-driver">
                        <Button variant="outline" size="sm">
                          <Phone className="w-4 h-4 mr-1" />
                          Call Driver
                        </Button>
                      </a>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowChat(!showChat)}
                        data-testid="button-toggle-chat"
                      >
                        <MessageCircle className="w-4 h-4 mr-1" />
                        {showChat ? "Hide Chat" : "Message"}
                      </Button>
                    </div>
                  </div>
                </div>
                {trackingInfo?.tracking && (trackingInfo.tracking.distanceToPickup || trackingInfo.tracking.distanceToDropoff) && (
                  <div className="mt-4 pt-4 border-t flex items-center justify-between gap-4 flex-wrap">
                    <div className="flex items-center gap-2 text-sm">
                      <Navigation className="w-4 h-4 text-primary" />
                      <span className="text-muted-foreground">Live Tracking</span>
                    </div>
                    {["accepted", "driver_enroute"].includes(ride.status) && trackingInfo.tracking.distanceToPickup && (
                      <span className="font-semibold text-sm" data-testid="text-distance-pickup">
                        {trackingInfo.tracking.distanceToPickup} mi to pickup
                      </span>
                    )}
                    {ride.status === "in_progress" && trackingInfo.tracking.distanceToDropoff && (
                      <span className="font-semibold text-sm" data-testid="text-distance-dropoff">
                        {trackingInfo.tracking.distanceToDropoff} mi to destination
                      </span>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {!driver && !driverLoading && (
            <Card className="mb-6">
              <CardContent className="py-8 text-center">
                <Car className="w-12 h-12 mx-auto mb-2 opacity-50 text-muted-foreground" />
                <p className="text-muted-foreground">Waiting for a driver to accept your ride...</p>
              </CardContent>
            </Card>
          )}

          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader className="py-3">
                <CardTitle className="text-base">Trip Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-3 h-3 rounded-full bg-green-500 mt-1.5" />
                  <div>
                    <p className="text-xs text-muted-foreground">Pickup</p>
                    <p className="text-sm" data-testid="text-pickup-address">{ride.pickupAddress}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-3 h-3 rounded-full bg-red-500 mt-1.5" />
                  <div>
                    <p className="text-xs text-muted-foreground">Dropoff</p>
                    <p className="text-sm" data-testid="text-dropoff-address">{ride.dropoffAddress}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Appointment Time</p>
                    <p className="text-sm" data-testid="text-appointment-time">
                      {format(new Date(ride.appointmentTime), "MMM d, h:mm a")}
                    </p>
                  </div>
                </div>
                {ride.estimatedFare && (
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-bold" data-testid="text-fare">${parseFloat(ride.estimatedFare).toFixed(2)}</span>
                    <span className="text-sm text-muted-foreground">Estimated Fare</span>
                  </div>
                )}
                {ride.isRoundTrip && (
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">Round Trip</Badge>
                    {ride.returnPickupTime && (
                      <span className="text-sm text-muted-foreground">Return: {ride.returnPickupTime}</span>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {driverInfo?.ride.estimatedArrivalTime && (
              <Card>
                <CardHeader className="py-3">
                  <CardTitle className="text-base">Schedule</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="w-4 h-4 text-muted-foreground" />
                    <span>Scheduled ETA: {format(new Date(driverInfo.ride.estimatedArrivalTime), "h:mm a")}</span>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            {!driver && (
              <Button
                variant="outline"
                onClick={() => setShowChat(!showChat)}
                disabled={!driver}
                data-testid="button-toggle-chat-fallback"
              >
                <MessageCircle className="w-4 h-4 mr-2" />
                {showChat ? "Hide Chat" : "Chat with Driver"}
              </Button>
            )}

            <Dialog open={shareDialogOpen} onOpenChange={(open) => {
              setShareDialogOpen(open);
              if (!open) setCreatedShareCode(null);
            }}>
              <DialogTrigger asChild>
                <Button variant="outline" data-testid="button-share-trip">
                  <Share2 className="w-4 h-4 mr-2" />
                  Share Trip
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Shield className="w-5 h-5" />
                    Share Your Trip
                  </DialogTitle>
                </DialogHeader>
                {createdShareCode ? (
                  <div className="space-y-4">
                    <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-md border border-green-200 dark:border-green-800">
                      <p className="text-sm font-medium text-green-800 dark:text-green-200 mb-2">
                        Trip shared successfully!
                      </p>
                      <p className="text-sm text-muted-foreground mb-3">
                        Your contact can track your ride using this share link:
                      </p>
                      <div className="flex items-center gap-2">
                        <Input
                          readOnly
                          value={`${window.location.origin}/share/${createdShareCode}`}
                          className="text-sm"
                          data-testid="input-share-link"
                        />
                        <Button
                          size="icon"
                          variant="outline"
                          onClick={() => {
                            navigator.clipboard.writeText(`${window.location.origin}/share/${createdShareCode}`);
                            toast({ title: "Copied", description: "Share link copied to clipboard" });
                          }}
                          data-testid="button-copy-link"
                        >
                          <Copy className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        className="flex-1"
                        onClick={() => {
                          setCreatedShareCode(null);
                        }}
                        data-testid="button-share-another"
                      >
                        Share with Another Contact
                      </Button>
                      <Button
                        className="flex-1"
                        onClick={() => setShareDialogOpen(false)}
                        data-testid="button-close-share"
                      >
                        Done
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                      Share your trip with a trusted contact so they can track your ride in real-time.
                    </p>
                    <div className="space-y-3">
                      <div>
                        <Label htmlFor="contact-name">Contact Name</Label>
                        <Input
                          id="contact-name"
                          value={shareContact.name}
                          onChange={(e) => setShareContact(prev => ({ ...prev, name: e.target.value }))}
                          placeholder="Emergency contact name"
                          data-testid="input-share-name"
                        />
                      </div>
                      <div>
                        <Label htmlFor="contact-phone">Phone Number</Label>
                        <Input
                          id="contact-phone"
                          value={shareContact.phone}
                          onChange={(e) => setShareContact(prev => ({ ...prev, phone: e.target.value }))}
                          placeholder="(555) 123-4567"
                          data-testid="input-share-phone"
                        />
                      </div>
                      <div>
                        <Label htmlFor="contact-email">Email (Optional)</Label>
                        <Input
                          id="contact-email"
                          type="email"
                          value={shareContact.email}
                          onChange={(e) => setShareContact(prev => ({ ...prev, email: e.target.value }))}
                          placeholder="contact@example.com"
                          data-testid="input-share-email"
                        />
                      </div>
                    </div>
                    <Button
                      onClick={() => shareTripMutation.mutate()}
                      disabled={!shareContact.name || !shareContact.phone || shareTripMutation.isPending}
                      className="w-full"
                      data-testid="button-confirm-share"
                    >
                      {shareTripMutation.isPending ? "Sharing..." : "Share Trip"}
                    </Button>
                  </div>
                )}
              </DialogContent>
            </Dialog>

            <Button
              variant="destructive"
              onClick={() => window.open("tel:911")}
              data-testid="button-sos"
            >
              <AlertTriangle className="w-4 h-4 mr-2" />
              Emergency SOS
            </Button>

            {ride.status === "completed" && (
              <Link href={`/receipt/${ride.id}`}>
                <Button variant="outline" data-testid="button-view-receipt">
                  View Receipt
                </Button>
              </Link>
            )}

            <Link href={`/report/${ride.id}`}>
              <Button variant="outline" data-testid="button-report-issue">
                <AlertTriangle className="w-4 h-4 mr-2" />
                Report Issue
              </Button>
            </Link>

            {ride.status === "completed" && !ride.tipAmount && (
              <Dialog open={tipDialogOpen} onOpenChange={(open) => {
                setTipDialogOpen(open);
                if (!open) {
                  setShowTipPayment(false);
                  setTipClientSecret(null);
                }
              }}>
                <DialogTrigger asChild>
                  <Button variant="default" data-testid="button-add-tip">
                    <Heart className="w-4 h-4 mr-2" />
                    Add Tip
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <Heart className="w-5 h-5 text-red-500" />
                      Thank Your Driver
                    </DialogTitle>
                  </DialogHeader>
                  
                  {showTipPayment && tipClientSecret && stripePromise ? (
                    <div className="space-y-4">
                      <Elements 
                        stripe={stripePromise} 
                        options={{ 
                          clientSecret: tipClientSecret,
                          appearance: { theme: 'stripe' },
                        }}
                      >
                        <TipPaymentFormContent 
                          onSuccess={handleTipPaymentSuccess} 
                          onCancel={handleTipPaymentCancel}
                          amount={pendingTipAmount}
                        />
                      </Elements>
                      <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                        <Shield className="w-4 h-4" />
                        <span>Secure payment powered by Stripe</span>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <p className="text-sm text-muted-foreground">
                        Show your appreciation! 100% of tips go directly to your driver.
                      </p>
                      
                      <div className="flex gap-2">
                        {tipOptions.map((option) => (
                          <Button
                            key={option.percent}
                            variant={selectedTip === option.percent ? "default" : "outline"}
                            onClick={() => {
                              setSelectedTip(option.percent);
                              setCustomTip("");
                            }}
                            className="flex-1"
                            data-testid={`button-tip-${option.percent}`}
                          >
                            <div className="text-center">
                              <div className="font-semibold">{option.label}</div>
                              <div className="text-xs opacity-75">
                                ${(getFinalFare() * option.percent / 100).toFixed(2)}
                              </div>
                            </div>
                          </Button>
                        ))}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="custom-tip">Or enter a custom amount</Label>
                        <div className="relative">
                          <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                          <Input
                            id="custom-tip"
                            type="number"
                            step="0.01"
                            min="0"
                            value={customTip}
                            onChange={(e) => {
                              setCustomTip(e.target.value);
                              setSelectedTip(null);
                            }}
                            placeholder="0.00"
                            className="pl-8"
                            data-testid="input-custom-tip"
                          />
                        </div>
                      </div>

                      <Button
                        onClick={handleTip}
                        disabled={(!selectedTip && !customTip) || createTipPaymentMutation.isPending || confirmTipMutation.isPending}
                        className="w-full"
                        data-testid="button-submit-tip"
                      >
                        {createTipPaymentMutation.isPending || confirmTipMutation.isPending ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            {createTipPaymentMutation.isPending ? "Setting up..." : "Sending..."}
                          </>
                        ) : stripePromise ? (
                          <>
                            <CreditCard className="w-4 h-4 mr-2" />
                            Continue to Pay ${customTip || (selectedTip ? (getFinalFare() * selectedTip / 100).toFixed(2) : "0.00")}
                          </>
                        ) : (
                          `Add $${customTip || (selectedTip ? (getFinalFare() * selectedTip / 100).toFixed(2) : "0.00")} Tip`
                        )}
                      </Button>
                    </div>
                  )}
                </DialogContent>
              </Dialog>
            )}

            {ride.status === "completed" && ride.tipAmount && parseFloat(ride.tipAmount) > 0 && (
              <Badge variant="secondary" className="px-3 py-2" data-testid="badge-tip-added">
                <Heart className="w-4 h-4 mr-1 text-red-500" />
                Tip Added: ${parseFloat(ride.tipAmount).toFixed(2)}
              </Badge>
            )}

            {ride.status === "completed" && !hasRated && !existingRating && (
              <Dialog open={ratingDialogOpen} onOpenChange={setRatingDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="border-yellow-400 text-yellow-600 hover:bg-yellow-50 dark:hover:bg-yellow-950/30" data-testid="button-rate-ride">
                    <Star className="w-4 h-4 mr-2 fill-yellow-400 text-yellow-400" />
                    Rate Your Ride
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-sm">
                  <DialogHeader>
                    <DialogTitle className="text-center text-lg">How was your ride?</DialogTitle>
                  </DialogHeader>
                  <div className="flex flex-col items-center gap-4 py-4">
                    <div className="flex gap-2" data-testid="rating-stars">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          className="p-1 transition-transform hover:scale-110 focus:outline-none"
                          onMouseEnter={() => setRatingHover(star)}
                          onMouseLeave={() => setRatingHover(0)}
                          onClick={() => setRatingValue(star)}
                          data-testid={`star-${star}`}
                        >
                          <Star
                            className={`w-10 h-10 transition-colors ${
                              star <= (ratingHover || ratingValue)
                                ? "fill-yellow-400 text-yellow-400"
                                : "text-gray-300 dark:text-gray-600"
                            }`}
                          />
                        </button>
                      ))}
                    </div>
                    {ratingValue > 0 && (
                      <p className="text-sm text-muted-foreground" data-testid="rating-label">
                        {ratingValue === 1 && "Poor"}
                        {ratingValue === 2 && "Fair"}
                        {ratingValue === 3 && "Good"}
                        {ratingValue === 4 && "Great"}
                        {ratingValue === 5 && "Excellent!"}
                      </p>
                    )}
                    <div className="w-full">
                      <Label htmlFor="rating-comment" className="text-sm text-muted-foreground">
                        Comments (optional)
                      </Label>
                      <Input
                        id="rating-comment"
                        placeholder="Tell us about your experience..."
                        value={ratingComment}
                        onChange={(e) => setRatingComment(e.target.value)}
                        className="mt-1"
                        data-testid="input-rating-comment"
                      />
                    </div>
                    <Button
                      className="w-full"
                      disabled={ratingValue === 0 || submitRatingMutation.isPending}
                      onClick={() => submitRatingMutation.mutate({ rating: ratingValue, comment: ratingComment })}
                      data-testid="button-submit-rating"
                    >
                      {submitRatingMutation.isPending ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Star className="w-4 h-4 mr-2" />
                      )}
                      Submit Rating
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            )}

            {(hasRated || existingRating) && (
              <Badge variant="secondary" className="px-3 py-2" data-testid="badge-rating">
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      className={`w-3 h-3 ${
                        star <= (existingRating?.rating || ratingValue)
                          ? "fill-yellow-400 text-yellow-400"
                          : "text-gray-300"
                      }`}
                    />
                  ))}
                  <span className="ml-1 text-xs">{existingRating?.rating || ratingValue}/5</span>
                </div>
              </Badge>
            )}
          </div>

          {showChat && driver && (
            <div className="mt-6 h-96">
              <RideChat rideId={rideId} userType="patient" onClose={() => setShowChat(false)} />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
