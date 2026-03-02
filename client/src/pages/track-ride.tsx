import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
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
import { 
  Car, Phone, MapPin, Clock, Shield, Share2, AlertTriangle, 
  User, CheckCircle2, Navigation, MessageCircle, Accessibility, Copy, ExternalLink,
  DollarSign, Heart, CreditCard, Loader2
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Ride } from "@shared/schema";
import { format } from "date-fns";

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
                {driverInfo?.ride.verificationCode && (
                  <Badge variant="outline" className="font-mono" data-testid="badge-verification-code">
                    Code: {driverInfo.ride.verificationCode}
                  </Badge>
                )}
              </CardHeader>
              <CardContent>
                {driverLoading ? (
                  <p className="text-muted-foreground">Loading driver info...</p>
                ) : driver ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-4">
                      {driver.profilePhotoDoc ? (
                        <img
                          src={driver.profilePhotoDoc}
                          alt={driver.fullName}
                          className="w-16 h-16 rounded-full object-cover"
                          data-testid="img-driver-photo"
                        />
                      ) : (
                        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                          <User className="w-8 h-8 text-muted-foreground" />
                        </div>
                      )}
                      <div>
                        <h3 className="font-semibold" data-testid="text-driver-name">{driver.fullName}</h3>
                        <a href={`tel:${driver.phone}`} className="text-sm text-primary flex items-center gap-1">
                          <Phone className="w-3 h-3" />
                          {driver.phone}
                        </a>
                      </div>
                    </div>
                    
                    <div className="bg-muted/50 rounded-md p-3 space-y-2">
                      <div className="flex items-center gap-2">
                        <Car className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm" data-testid="text-vehicle-info">
                          {driver.vehicleColor} {driver.vehicleYear} {driver.vehicleMake} {driver.vehicleModel}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" data-testid="badge-plate">{driver.vehiclePlate}</Badge>
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

                    {trackingInfo?.tracking && (trackingInfo.tracking.distanceToPickup || trackingInfo.tracking.distanceToDropoff) && (
                      <div className="bg-primary/10 rounded-md p-3 space-y-2">
                        <div className="flex items-center gap-2 text-sm font-medium">
                          <Navigation className="w-4 h-4 text-primary" />
                          <span className="text-primary">Live Location</span>
                        </div>
                        {["accepted", "driver_enroute"].includes(ride.status) && trackingInfo.tracking.distanceToPickup && (
                          <div className="flex items-center justify-between gap-4">
                            <span className="text-sm text-muted-foreground">Distance to pickup:</span>
                            <span className="font-semibold" data-testid="text-distance-pickup">
                              {trackingInfo.tracking.distanceToPickup} mi
                              {trackingInfo.tracking.estimatedMinutesToPickup && (
                                <span className="text-muted-foreground font-normal"> ({trackingInfo.tracking.estimatedMinutesToPickup} min)</span>
                              )}
                            </span>
                          </div>
                        )}
                        {ride.status === "in_progress" && trackingInfo.tracking.distanceToDropoff && (
                          <div className="flex items-center justify-between gap-4">
                            <span className="text-sm text-muted-foreground">Distance to destination:</span>
                            <span className="font-semibold" data-testid="text-distance-dropoff">
                              {trackingInfo.tracking.distanceToDropoff} mi
                              {trackingInfo.tracking.estimatedMinutesToDropoff && (
                                <span className="text-muted-foreground font-normal"> ({trackingInfo.tracking.estimatedMinutesToDropoff} min)</span>
                              )}
                            </span>
                          </div>
                        )}
                      </div>
                    )}

                    {driverInfo?.ride.estimatedArrivalTime && (
                      <div className="flex items-center gap-2 text-sm">
                        <Clock className="w-4 h-4" />
                        <span>Scheduled ETA: {format(new Date(driverInfo.ride.estimatedArrivalTime), "h:mm a")}</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-6 text-muted-foreground">
                    <Car className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>Waiting for a driver to accept your ride...</p>
                  </div>
                )}
              </CardContent>
            </Card>

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
              </CardContent>
            </Card>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <Button
              variant="outline"
              onClick={() => setShowChat(!showChat)}
              disabled={!driver}
              data-testid="button-toggle-chat"
            >
              <MessageCircle className="w-4 h-4 mr-2" />
              {showChat ? "Hide Chat" : "Chat with Driver"}
            </Button>

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
