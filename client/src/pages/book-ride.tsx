import { useState, useEffect, useRef, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useLocation, Link } from "wouter";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";

import Header from "@/components/Header";
import Footer from "@/components/Footer";
import BackToHome from "@/components/BackToHome";
import { NotificationPrompt } from "@/components/NotificationPrompt";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { MapPin, Calendar, Clock, User, Phone, Car, Accessibility, ArrowRight, CheckCircle2, DollarSign, CreditCard, Shield, FileText, Navigation, AlertTriangle, Heart, Users, Loader2, ArrowLeft, UserCog, ArrowUpDown, Circle, LocateFixed, X } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import type { Ride } from "@shared/schema";

const BASE_FARE = 20.00;
const PER_MILE_RATE = 2.50;
const MINIMUM_FARE = 22.00;

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3959;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

function calculateFare(distanceMiles: number): number {
  const fare = BASE_FARE + (distanceMiles * PER_MILE_RATE);
  return Math.max(fare, MINIMUM_FARE);
}

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

const bookRideSchema = z.object({
  patientName: z.string().min(1, "Name is required"),
  patientPhone: z.string().min(10, "Valid phone number is required"),
  // Booking for someone else
  bookedByOther: z.boolean().default(false),
  bookerName: z.string().optional(),
  bookerPhone: z.string().optional(),
  bookerEmail: z.string().optional().transform(val => val === "" ? undefined : val).pipe(z.string().email().optional().or(z.literal("")).or(z.undefined())),
  bookerRelation: z.enum(["spouse", "child", "parent", "caregiver", "other"]).optional(),
  pickupAddress: z.string().min(1, "Pickup address is required"),
  pickupLat: z.string(),
  pickupLng: z.string(),
  dropoffAddress: z.string().min(1, "Dropoff address is required"),
  dropoffLat: z.string(),
  dropoffLng: z.string(),
  appointmentTime: z.string().min(1, "Appointment time is required"),
  mobilityNeeds: z.array(z.string()).optional(),
  notes: z.string().optional(),
  paymentType: z.enum(["self_pay", "insurance"]).default("self_pay"),
  insuranceProvider: z.string().optional(),
  memberId: z.string().optional(),
  groupNumber: z.string().optional(),
  priorAuthNumber: z.string().optional(),
}).refine((data) => {
  if (data.bookedByOther) {
    return data.bookerName && data.bookerName.trim().length > 0;
  }
  return true;
}, {
  message: "Your name is required when booking for someone else",
  path: ["bookerName"],
}).refine((data) => {
  if (data.bookedByOther) {
    return data.bookerPhone && data.bookerPhone.trim().length >= 10;
  }
  return true;
}, {
  message: "Your phone number is required when booking for someone else",
  path: ["bookerPhone"],
}).refine((data) => {
  if (data.bookedByOther) {
    return data.bookerRelation !== undefined;
  }
  return true;
}, {
  message: "Please select your relationship to the patient",
  path: ["bookerRelation"],
}).refine((data) => {
  if (data.paymentType === "insurance") {
    return data.insuranceProvider && data.insuranceProvider.trim().length > 0;
  }
  return true;
}, {
  message: "Insurance provider is required when using insurance",
  path: ["insuranceProvider"],
}).refine((data) => {
  if (data.paymentType === "insurance") {
    return data.memberId && data.memberId.trim().length > 0;
  }
  return true;
}, {
  message: "Member ID is required when using insurance",
  path: ["memberId"],
});

type BookRideFormData = z.infer<typeof bookRideSchema>;

interface LocationPickerProps {
  onPickupChange: (lat: number, lng: number) => void;
  onDropoffChange: (lat: number, lng: number) => void;
  pickupPos: [number, number] | null;
  dropoffPos: [number, number] | null;
  mode: "pickup" | "dropoff";
}

function LocationPicker({ onPickupChange, onDropoffChange, pickupPos, dropoffPos, mode }: LocationPickerProps) {
  const map = useMap();
  
  useMapEvents({
    click(e) {
      if (mode === "pickup") {
        onPickupChange(e.latlng.lat, e.latlng.lng);
      } else {
        onDropoffChange(e.latlng.lat, e.latlng.lng);
      }
    },
  });

  useEffect(() => {
    if (pickupPos) {
      map.flyTo(pickupPos, 14);
    }
  }, [pickupPos, map]);

  useEffect(() => {
    if (dropoffPos) {
      map.flyTo(dropoffPos, 14);
    }
  }, [dropoffPos, map]);

  return (
    <>
      {pickupPos && <Marker position={pickupPos} icon={pickupIcon} />}
      {dropoffPos && <Marker position={dropoffPos} icon={dropoffIcon} />}
    </>
  );
}

const mobilityOptions = [
  { id: "wheelchair", label: "Wheelchair" },
  { id: "stretcher", label: "Stretcher" },
  { id: "walker", label: "Walker/Cane" },
  { id: "oxygen", label: "Oxygen Tank" },
];

interface AddressAutocompleteProps {
  onPlaceSelect: (address: string, lat: number, lng: number) => void;
  placeholder?: string;
  value?: string;
  testId?: string;
  userLocation?: { lat: number; lng: number } | null;
}

function AddressAutocomplete({ onPlaceSelect, placeholder, value = "", testId, userLocation }: AddressAutocompleteProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [localValue, setLocalValue] = useState(value);
  const [isLoaded, setIsLoaded] = useState(false);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const onPlaceSelectRef = useRef(onPlaceSelect);

  useEffect(() => {
    onPlaceSelectRef.current = onPlaceSelect;
  }, [onPlaceSelect]);

  useEffect(() => {
    setLocalValue(value);
    if (inputRef.current && value === "") {
      inputRef.current.value = "";
    }
  }, [value]);

  // Update autocomplete bounds when user location changes
  useEffect(() => {
    if (autocompleteRef.current && userLocation && window.google?.maps) {
      // Create a circle around the user's location (50km radius) to bias results
      const circle = new (google.maps as any).Circle({
        center: { lat: userLocation.lat, lng: userLocation.lng },
        radius: 50000, // 50km radius for suggestions
      });
      (autocompleteRef.current as any).setBounds(circle.getBounds());
    }
  }, [userLocation]);

  useEffect(() => {
    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
    if (!apiKey || !inputRef.current) return;

    let mounted = true;

    const loadPlacesLibrary = async () => {
      try {
        if (!window.google?.maps?.places) {
          const existingScript = document.querySelector(`script[src*="maps.googleapis.com"]`);
          if (!existingScript) {
            const script = document.createElement("script");
            script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
            script.async = true;
            script.defer = true;
            
            await new Promise<void>((resolve, reject) => {
              script.onload = () => resolve();
              script.onerror = reject;
              document.head.appendChild(script);
            });
          } else {
            await new Promise<void>((resolve) => {
              const checkGoogle = () => {
                if (window.google?.maps?.places) {
                  resolve();
                } else {
                  setTimeout(checkGoogle, 100);
                }
              };
              checkGoogle();
            });
          }
        }
        
        if (!mounted || !inputRef.current) return;
        
        if (!autocompleteRef.current) {
          const autocompleteOptions: google.maps.places.AutocompleteOptions = {
            componentRestrictions: { country: "us" },
            fields: ["formatted_address", "geometry", "name"],
          };
          
          // If user location is available, set initial bounds to bias results
          if (userLocation && window.google?.maps) {
            const circle = new (google.maps as any).Circle({
              center: { lat: userLocation.lat, lng: userLocation.lng },
              radius: 50000, // 50km radius
            });
            (autocompleteOptions as any).bounds = circle.getBounds();
            (autocompleteOptions as any).strictBounds = false; // Allow results outside bounds but prioritize nearby
          }
          
          const autocomplete = new google.maps.places.Autocomplete(inputRef.current, autocompleteOptions);
          
          autocompleteRef.current = autocomplete;
          
          autocomplete.addListener("place_changed", () => {
            const place = autocomplete.getPlace();
            
            if (place.geometry?.location) {
              const address = place.formatted_address || place.name || "";
              const lat = place.geometry.location.lat();
              const lng = place.geometry.location.lng();
              
              setLocalValue(address);
              onPlaceSelectRef.current(address, lat, lng);
            }
          });
          
          setIsLoaded(true);
        }
      } catch (error) {
        console.error("Failed to load Google Places:", error);
        if (mounted) setIsLoaded(false);
      }
    };

    loadPlacesLibrary();

    return () => {
      mounted = false;
    };
  }, [userLocation]);

  const handleManualEntry = () => {
    if (localValue && !isLoaded) {
      onPlaceSelect(localValue, 0, 0);
    }
  };

  return (
    <Input
      ref={inputRef}
      placeholder={isLoaded ? placeholder : (import.meta.env.VITE_GOOGLE_MAPS_API_KEY ? "Loading..." : placeholder)}
      value={localValue}
      onChange={(e) => setLocalValue(e.target.value)}
      onBlur={handleManualEntry}
      data-testid={testId}
    />
  );
}

interface PatientAccountStatus {
  accountStatus: string;
  outstandingBalance: string;
  canBookRide: boolean;
  tier: string;
  requiresAcknowledgment?: boolean;
  message?: string;
}

interface PaymentFormProps {
  clientSecret: string;
  onSuccess: () => void;
  onCancel: () => void;
  amount: number;
}

function PaymentFormContent({ onSuccess, onCancel, amount }: Omit<PaymentFormProps, 'clientSecret'>) {
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
        return_url: window.location.origin + '/book-ride',
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
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="text-center mb-6">
        <h3 className="text-xl font-semibold mb-2">Complete Payment</h3>
        <p className="text-muted-foreground">
          Total: <span className="text-2xl font-bold text-foreground">${amount.toFixed(2)}</span>
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
          data-testid="button-cancel-payment"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        <Button 
          type="submit" 
          disabled={!stripe || isProcessing}
          className="flex-1"
          data-testid="button-confirm-payment"
        >
          {isProcessing ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              <CreditCard className="w-4 h-4 mr-2" />
              Pay ${amount.toFixed(2)}
            </>
          )}
        </Button>
      </div>
    </form>
  );
}

export default function BookRide() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [pickupPos, setPickupPos] = useState<[number, number] | null>(null);
  const [dropoffPos, setDropoffPos] = useState<[number, number] | null>(null);
  const [locationMode, setLocationMode] = useState<"pickup" | "dropoff">("pickup");
  const [selectedNeeds, setSelectedNeeds] = useState<string[]>([]);
  const [bookingSuccess, setBookingSuccess] = useState(false);
  const [bookedRide, setBookedRide] = useState<(Ride & { trackingToken?: string | null }) | null>(null);
  const [fareEstimate, setFareEstimate] = useState<{ distance: number; fare: number } | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [accountStatus, setAccountStatus] = useState<PatientAccountStatus | null>(null);
  const [isEmergency, setIsEmergency] = useState(false);
  const [emergencyAcknowledged, setEmergencyAcknowledged] = useState(false);
  const [phoneForAccountCheck, setPhoneForAccountCheck] = useState("");
  const [userDeviceLocation, setUserDeviceLocation] = useState<{ lat: number; lng: number } | null>(null);
  
  const [showPaymentStep, setShowPaymentStep] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [stripePromise, setStripePromise] = useState<Promise<any> | null>(null);
  const [pendingFormData, setPendingFormData] = useState<BookRideFormData | null>(null);
  const [paymentIntentId, setPaymentIntentId] = useState<string | null>(null);
  
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

  // Automatically detect user's device location on page load for better address suggestions
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserDeviceLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        (error) => {
          console.log("Location access denied or unavailable:", error.message);
          // Silently fail - address autocomplete will work without location bias
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
      );
    }
  }, []);

  useEffect(() => {
    if (pickupPos && dropoffPos) {
      const distance = calculateDistance(pickupPos[0], pickupPos[1], dropoffPos[0], dropoffPos[1]);
      const fare = calculateFare(distance);
      setFareEstimate({ distance, fare });
    } else {
      setFareEstimate(null);
    }
  }, [pickupPos, dropoffPos]);

  const form = useForm<BookRideFormData>({
    resolver: zodResolver(bookRideSchema),
    defaultValues: {
      patientName: "",
      patientPhone: "",
      bookedByOther: false,
      bookerName: "",
      bookerPhone: "",
      bookerEmail: "",
      bookerRelation: undefined,
      pickupAddress: "",
      pickupLat: "",
      pickupLng: "",
      dropoffAddress: "",
      dropoffLat: "",
      dropoffLng: "",
      appointmentTime: "",
      mobilityNeeds: [],
      notes: "",
      paymentType: "self_pay",
      insuranceProvider: "",
      memberId: "",
      groupNumber: "",
      priorAuthNumber: "",
    },
  });

  const bookedByOther = form.watch("bookedByOther");

  const paymentType = form.watch("paymentType");
  const patientPhone = form.watch("patientPhone");

  // Check account status when phone number is entered
  useEffect(() => {
    const checkAccountStatus = async () => {
      // Reset state if phone is too short or cleared
      if (!patientPhone || patientPhone.length < 10) {
        setAccountStatus(null);
        setIsEmergency(false);
        setEmergencyAcknowledged(false);
        setPhoneForAccountCheck("");
        return;
      }
      
      if (patientPhone !== phoneForAccountCheck) {
        // Reset emergency fields when phone changes
        setIsEmergency(false);
        setEmergencyAcknowledged(false);
        
        try {
          const response = await fetch(`/api/patient-account/${encodeURIComponent(patientPhone)}`);
          
          if (response.ok) {
            const data = await response.json();
            // Validate response has expected shape before setting
            if (data && (typeof data.tier === 'string' || typeof data.accountStatus === 'string')) {
              setAccountStatus({
                accountStatus: data.accountStatus || "good_standing",
                outstandingBalance: data.outstandingBalance || "0",
                canBookRide: data.canBookRide !== false,
                tier: data.tier || "green",
                requiresAcknowledgment: data.requiresAcknowledgment,
                message: data.message
              });
              setPhoneForAccountCheck(patientPhone);
            } else {
              // Invalid response structure - show warning and allow retry
              console.warn("Unexpected account status response:", data);
              setAccountStatus(null);
              setPhoneForAccountCheck(""); // Allow retry
              toast({
                title: "Unable to verify account",
                description: "Could not check account status. Please try again.",
                variant: "destructive",
              });
            }
          } else if (response.status === 404) {
            // New patient with no account - default to good standing, allow re-fetch later
            setAccountStatus({
              accountStatus: "good_standing",
              outstandingBalance: "0",
              canBookRide: true,
              tier: "green"
            });
            // Don't lock phoneForAccountCheck - allow re-fetch if account is created later
            // But set it temporarily to prevent immediate re-fetch loop
            setPhoneForAccountCheck(patientPhone);
          } else {
            // Other errors - reset to allow booking attempt
            setAccountStatus(null);
            setPhoneForAccountCheck(""); // Allow retry
          }
        } catch (error) {
          // Network error - reset to allow retry
          console.error("Failed to check account status:", error);
          setAccountStatus(null);
          setPhoneForAccountCheck(""); // Allow retry on next change
        }
      }
    };
    checkAccountStatus();
  }, [patientPhone, phoneForAccountCheck, toast]);

  const isAccountBlocked = accountStatus?.tier === "red" || accountStatus?.tier === "blocked" || accountStatus?.accountStatus === "blocked";
  const canProceedWithBooking = !isAccountBlocked || (isEmergency && emergencyAcknowledged);

  const createRideMutation = useMutation({
    mutationFn: async (data: BookRideFormData) => {
      const response = await apiRequest("POST", "/api/rides", {
        ...data,
        appointmentTime: new Date(data.appointmentTime).toISOString(),
        mobilityNeeds: selectedNeeds,
        distanceMiles: fareEstimate?.distance.toFixed(2),
        estimatedFare: fareEstimate?.fare.toFixed(2),
        isEmergency: isEmergency && emergencyAcknowledged,
      });
      return response.json();
    },
    onSuccess: (ride: Ride) => {
      toast({
        title: "Ride Booked",
        description: "Your ride has been requested. A driver will be assigned shortly.",
      });
      setBookedRide(ride);
      setBookingSuccess(true);
      queryClient.invalidateQueries({ queryKey: ["/api/rides"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Booking Failed",
        description: error.message || "Failed to book ride. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handlePickupChange = (lat: number, lng: number) => {
    setPickupPos([lat, lng]);
    form.setValue("pickupLat", lat.toString());
    form.setValue("pickupLng", lng.toString());
  };

  const handleDropoffChange = (lat: number, lng: number) => {
    setDropoffPos([lat, lng]);
    form.setValue("dropoffLat", lat.toString());
    form.setValue("dropoffLng", lng.toString());
  };

  const toggleMobilityNeed = (need: string) => {
    setSelectedNeeds((prev) =>
      prev.includes(need) ? prev.filter((n) => n !== need) : [...prev, need]
    );
  };

  const [isLocatingDropoff, setIsLocatingDropoff] = useState(false);

  const useMyLocation = (locationType: "pickup" | "dropoff" = "pickup") => {
    if (!navigator.geolocation) {
      toast({
        title: "Location Not Supported",
        description: "Your browser doesn't support location services.",
        variant: "destructive",
      });
      return;
    }

    if (locationType === "pickup") {
      setIsLocating(true);
    } else {
      setIsLocatingDropoff(true);
    }
    
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        
        if (locationType === "pickup") {
          handlePickupChange(latitude, longitude);
        } else {
          handleDropoffChange(latitude, longitude);
        }
        
        try {
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&addressdetails=1`
          );
          const data = await response.json();
          const address = data.display_name || `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
          
          if (locationType === "pickup") {
            form.setValue("pickupAddress", address);
          } else {
            form.setValue("dropoffAddress", address);
          }
          
          toast({
            title: "Location Found",
            description: `Your current location has been set as the ${locationType} address.`,
          });
        } catch (error) {
          const coordsStr = `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
          if (locationType === "pickup") {
            form.setValue("pickupAddress", coordsStr);
          } else {
            form.setValue("dropoffAddress", coordsStr);
          }
          toast({
            title: "Location Set",
            description: "Coordinates set. You may want to add a street address.",
          });
        }
        
        if (locationType === "pickup") {
          setIsLocating(false);
        } else {
          setIsLocatingDropoff(false);
        }
      },
      (error) => {
        if (locationType === "pickup") {
          setIsLocating(false);
        } else {
          setIsLocatingDropoff(false);
        }
        let message = "Unable to get your location.";
        if (error.code === error.PERMISSION_DENIED) {
          message = "Location permission denied. Please allow location access.";
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          message = "Location information unavailable.";
        } else if (error.code === error.TIMEOUT) {
          message = "Location request timed out.";
        }
        toast({
          title: "Location Error",
          description: message,
          variant: "destructive",
        });
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const createPaymentIntentMutation = useMutation({
    mutationFn: async (data: { estimatedFare: number; patientName: string; patientEmail?: string }) => {
      const response = await apiRequest("POST", "/api/rides/create-payment-intent", data);
      return response.json();
    },
    onSuccess: (data) => {
      setClientSecret(data.clientSecret);
      setPaymentIntentId(data.paymentIntentId);
      setShowPaymentStep(true);
    },
    onError: (error: Error) => {
      toast({
        title: "Payment Setup Failed",
        description: error.message || "Could not initialize payment. Please try again.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = async (data: BookRideFormData) => {
    if (!pickupPos || !dropoffPos) {
      toast({
        title: "Location Required",
        description: "Please select both pickup and dropoff locations on the map.",
        variant: "destructive",
      });
      return;
    }
    
    if (isAccountBlocked && !(isEmergency && emergencyAcknowledged)) {
      toast({
        title: "Account Restricted",
        description: "Your account has an outstanding balance. Please contact billing or use the emergency booking option for urgent medical transport.",
        variant: "destructive",
      });
      return;
    }
    
    if (data.paymentType === "self_pay" && stripePromise && fareEstimate) {
      setPendingFormData(data);
      createPaymentIntentMutation.mutate({
        estimatedFare: fareEstimate.fare,
        patientName: data.patientName,
        patientEmail: data.bookedByOther ? data.bookerEmail : undefined,
      });
    } else {
      createRideMutation.mutate(data);
    }
  };

  const handlePaymentSuccess = async () => {
    if (!pendingFormData || !paymentIntentId) return;
    
    try {
      const response = await apiRequest("POST", "/api/rides", {
        ...pendingFormData,
        appointmentTime: new Date(pendingFormData.appointmentTime).toISOString(),
        mobilityNeeds: selectedNeeds,
        distanceMiles: fareEstimate?.distance.toFixed(2),
        estimatedFare: fareEstimate?.fare.toFixed(2),
        isEmergency: isEmergency && emergencyAcknowledged,
        stripePaymentIntentId: paymentIntentId,
        paidAmount: fareEstimate?.fare.toFixed(2),
        paymentStatus: "paid",
      });
      
      const ride = await response.json();
      toast({
        title: "Ride Booked & Paid",
        description: "Your payment was successful. A driver will be assigned shortly.",
      });
      setBookedRide(ride);
      setBookingSuccess(true);
      setShowPaymentStep(false);
      queryClient.invalidateQueries({ queryKey: ["/api/rides"] });
    } catch (error: any) {
      toast({
        title: "Booking Failed",
        description: error.message || "Payment was successful but booking failed. Please contact support.",
        variant: "destructive",
      });
    }
  };

  const handlePaymentCancel = () => {
    setShowPaymentStep(false);
    setClientSecret(null);
    setPaymentIntentId(null);
    setPendingFormData(null);
  };

  if (showPaymentStep && clientSecret && stripePromise && fareEstimate) {
    return (
      <div className="min-h-screen bg-background">
        <Header title="Book a Ride" showBack />
        <main className="container mx-auto px-4 py-16">
          <Card className="max-w-md mx-auto">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="w-5 h-5" />
                Secure Payment
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="mb-6 p-4 bg-muted rounded-md">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="text-muted-foreground">Patient:</div>
                  <div className="font-medium">{pendingFormData?.patientName}</div>
                  <div className="text-muted-foreground">Distance:</div>
                  <div className="font-medium">{fareEstimate.distance.toFixed(1)} miles</div>
                  <div className="text-muted-foreground">Fare:</div>
                  <div className="font-bold text-lg">${fareEstimate.fare.toFixed(2)}</div>
                </div>
              </div>
              <Elements 
                stripe={stripePromise} 
                options={{ 
                  clientSecret,
                  appearance: { theme: 'stripe' },
                }}
              >
                <PaymentFormContent 
                  onSuccess={handlePaymentSuccess} 
                  onCancel={handlePaymentCancel}
                  amount={fareEstimate.fare}
                />
              </Elements>
              <div className="mt-4 flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <Shield className="w-4 h-4" />
                <span>Secure payment powered by Stripe</span>
              </div>
            </CardContent>
          </Card>
        </main>
        <Footer />
      </div>
    );
  }

  if (bookingSuccess && bookedRide) {
    return (
      <div className="min-h-screen bg-background">
        <Header title="Book a Ride" showBack />
        <main className="container mx-auto px-4 py-16">
          <Card className="max-w-2xl mx-auto">
            <CardContent className="p-8 text-center">
              <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
              <h2 className="text-2xl font-bold mb-2">Ride Booked Successfully</h2>
              <p className="text-muted-foreground mb-6">
                Your ride request has been submitted. A driver will be assigned shortly.
              </p>
              <div className="bg-muted p-4 rounded-md mb-6 text-left">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Ride ID:</span>
                    <p className="font-medium">#{bookedRide.id}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Status:</span>
                    <Badge variant="secondary" className="ml-2">{bookedRide.status}</Badge>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Pickup:</span>
                    <p className="font-medium">{bookedRide.pickupAddress}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Dropoff:</span>
                    <p className="font-medium">{bookedRide.dropoffAddress}</p>
                  </div>
                  {bookedRide.distanceMiles && (
                    <div>
                      <span className="text-muted-foreground">Distance:</span>
                      <p className="font-medium">{parseFloat(bookedRide.distanceMiles).toFixed(1)} miles</p>
                    </div>
                  )}
                  {bookedRide.estimatedFare && (
                    <div>
                      <span className="text-muted-foreground">Estimated Fare:</span>
                      <p className="font-medium text-lg">${parseFloat(bookedRide.estimatedFare).toFixed(2)}</p>
                    </div>
                  )}
                  <div>
                    <span className="text-muted-foreground">Payment:</span>
                    <Badge variant="secondary" className="ml-2" data-testid="badge-payment-type">
                      {bookedRide.paymentType === "insurance" ? "Insurance" : "Self Pay"}
                    </Badge>
                  </div>
                  {bookedRide.paymentType === "insurance" && bookedRide.insuranceProvider && (
                    <div>
                      <span className="text-muted-foreground">Provider:</span>
                      <p className="font-medium">{bookedRide.insuranceProvider}</p>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex gap-4 justify-center flex-wrap">
                <Link href={`/track/${bookedRide.id}${bookedRide.trackingToken ? `?token=${bookedRide.trackingToken}` : ''}`}>
                  <Button data-testid="button-track-ride">
                    <MapPin className="w-4 h-4 mr-2" />
                    Track Your Ride
                  </Button>
                </Link>
                <Button onClick={() => navigate("/")} variant="outline" data-testid="button-back-home">
                  Back to Home
                </Button>
                <Link href={`/receipt/${bookedRide.id}`}>
                  <Button variant="outline" data-testid="button-view-receipt">
                    <FileText className="w-4 h-4 mr-2" />
                    View Receipt
                  </Button>
                </Link>
                <Button onClick={() => { setBookingSuccess(false); form.reset(); setPickupPos(null); setDropoffPos(null); }} data-testid="button-book-another">
                  Book Another Ride
                </Button>
              </div>
            </CardContent>
          </Card>
        </main>
        <Footer />
      </div>
    );
  }

  const swapLocations = () => {
    const currentPickup = form.getValues("pickupAddress");
    const currentPickupLat = form.getValues("pickupLat");
    const currentPickupLng = form.getValues("pickupLng");
    const currentDropoff = form.getValues("dropoffAddress");
    const currentDropoffLat = form.getValues("dropoffLat");
    const currentDropoffLng = form.getValues("dropoffLng");

    form.setValue("pickupAddress", currentDropoff);
    form.setValue("pickupLat", currentDropoffLat);
    form.setValue("pickupLng", currentDropoffLng);
    form.setValue("dropoffAddress", currentPickup);
    form.setValue("dropoffLat", currentPickupLat);
    form.setValue("dropoffLng", currentPickupLng);

    const newPickup = dropoffPos;
    const newDropoff = pickupPos;
    setPickupPos(newPickup);
    setDropoffPos(newDropoff);
  };

  const clearPickup = () => {
    form.setValue("pickupAddress", "");
    form.setValue("pickupLat", "");
    form.setValue("pickupLng", "");
    setPickupPos(null);
  };

  const clearDropoff = () => {
    form.setValue("dropoffAddress", "");
    form.setValue("dropoffLat", "");
    form.setValue("dropoffLng", "");
    setDropoffPos(null);
  };

  return (
    <div className="min-h-screen bg-background">
      <Header title="Book a Ride" showBack />
      <main className="container mx-auto px-4 py-6 pb-32 md:pb-8">
        <div className="mb-4">
          <BackToHome />
        </div>
        <div className="max-w-4xl mx-auto">
          <NotificationPrompt userType="user" />
          <div className="mb-6">
            <h1 className="text-2xl md:text-3xl font-bold mb-1">Where are you going?</h1>
            <p className="text-sm text-muted-foreground">
              Non-emergency medical transportation
            </p>
          </div>

          <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>

          <div className="bg-card rounded-xl border shadow-sm p-4 md:p-6 mb-4" data-testid="address-panel">
            <div className="flex gap-3">
              <div className="flex flex-col items-center pt-3 pb-1">
                <div className="w-3 h-3 rounded-full bg-green-500 border-2 border-green-600 flex-shrink-0" />
                <div className="w-0.5 flex-1 bg-border my-1 min-h-[24px]" style={{ backgroundImage: 'repeating-linear-gradient(to bottom, hsl(var(--border)) 0px, hsl(var(--border)) 4px, transparent 4px, transparent 8px)' }} />
                <div className="w-3 h-3 rounded-full bg-red-500 border-2 border-red-600 flex-shrink-0" />
              </div>

              <div className="flex-1 space-y-2 min-w-0">
                <FormField
                  control={form.control}
                  name="pickupAddress"
                  render={({ field }) => (
                    <FormItem className="space-y-0">
                      <div className="relative">
                        <FormControl>
                          <AddressAutocomplete
                            onPlaceSelect={(address, lat, lng) => {
                              field.onChange(address);
                              handlePickupChange(lat, lng);
                              setLocationMode("dropoff");
                            }}
                            placeholder="Pickup location"
                            value={field.value}
                            testId="input-pickup-address"
                            userLocation={userDeviceLocation}
                          />
                        </FormControl>
                        <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
                          {field.value && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground hover:text-foreground"
                              onClick={clearPickup}
                              data-testid="button-clear-pickup"
                            >
                              <X className="w-3.5 h-3.5" />
                            </Button>
                          )}
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-primary"
                            onClick={() => useMyLocation("pickup")}
                            disabled={isLocating}
                            data-testid="button-use-my-location"
                          >
                            {isLocating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LocateFixed className="w-3.5 h-3.5" />}
                          </Button>
                        </div>
                      </div>
                      <FormMessage className="text-xs mt-1" />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="dropoffAddress"
                  render={({ field }) => (
                    <FormItem className="space-y-0">
                      <div className="relative">
                        <FormControl>
                          <AddressAutocomplete
                            onPlaceSelect={(address, lat, lng) => {
                              field.onChange(address);
                              handleDropoffChange(lat, lng);
                            }}
                            placeholder="Dropoff — hospital, clinic, etc."
                            value={field.value}
                            testId="input-dropoff-address"
                            userLocation={userDeviceLocation}
                          />
                        </FormControl>
                        <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
                          {field.value && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground hover:text-foreground"
                              onClick={clearDropoff}
                              data-testid="button-clear-dropoff"
                            >
                              <X className="w-3.5 h-3.5" />
                            </Button>
                          )}
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-primary"
                            onClick={() => useMyLocation("dropoff")}
                            disabled={isLocatingDropoff}
                            data-testid="button-use-my-location-dropoff"
                          >
                            {isLocatingDropoff ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LocateFixed className="w-3.5 h-3.5" />}
                          </Button>
                        </div>
                      </div>
                      <FormMessage className="text-xs mt-1" />
                    </FormItem>
                  )}
                />
              </div>

              <div className="flex items-center pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted"
                  onClick={swapLocations}
                  data-testid="button-swap-locations"
                >
                  <ArrowUpDown className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
              <Navigation className="w-3 h-3" />
              <span>Tap the crosshair icon to use your current location</span>
            </div>
          </div>

          <div className="rounded-xl overflow-hidden border shadow-sm mb-4" data-testid="map-container">
            <div className="relative">
              <div className="h-[280px] md:h-[350px]">
                <MapContainer
                  center={userDeviceLocation ? [userDeviceLocation.lat, userDeviceLocation.lng] : [39.8283, -98.5795]}
                  zoom={userDeviceLocation ? 12 : 4}
                  style={{ height: "100%", width: "100%" }}
                >
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  <LocationPicker
                    onPickupChange={(lat, lng) => {
                      handlePickupChange(lat, lng);
                      fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1`)
                        .then(r => r.json())
                        .then(data => {
                          if (data.display_name) form.setValue("pickupAddress", data.display_name);
                        })
                        .catch(() => {});
                      setLocationMode("dropoff");
                    }}
                    onDropoffChange={(lat, lng) => {
                      handleDropoffChange(lat, lng);
                      fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1`)
                        .then(r => r.json())
                        .then(data => {
                          if (data.display_name) form.setValue("dropoffAddress", data.display_name);
                        })
                        .catch(() => {});
                    }}
                    pickupPos={pickupPos}
                    dropoffPos={dropoffPos}
                    mode={locationMode}
                  />
                </MapContainer>
              </div>
              <div className="absolute bottom-3 left-3 z-[400] flex gap-2">
                <Button
                  type="button"
                  variant={locationMode === "pickup" ? "default" : "secondary"}
                  onClick={() => setLocationMode("pickup")}
                  size="sm"
                  className="shadow-md text-xs h-8"
                  data-testid="button-select-pickup"
                >
                  <div className={`w-2 h-2 rounded-full mr-1.5 ${locationMode === "pickup" ? "bg-green-300" : "bg-green-500"}`} />
                  Pickup {pickupPos && <CheckCircle2 className="w-3 h-3 ml-1" />}
                </Button>
                <Button
                  type="button"
                  variant={locationMode === "dropoff" ? "default" : "secondary"}
                  onClick={() => setLocationMode("dropoff")}
                  size="sm"
                  className="shadow-md text-xs h-8"
                  data-testid="button-select-dropoff"
                >
                  <div className={`w-2 h-2 rounded-full mr-1.5 ${locationMode === "dropoff" ? "bg-red-300" : "bg-red-500"}`} />
                  Dropoff {dropoffPos && <CheckCircle2 className="w-3 h-3 ml-1" />}
                </Button>
              </div>
            </div>
          </div>

          {fareEstimate && (
            <div className="bg-card rounded-xl border shadow-sm p-4 mb-4" data-testid="fare-estimate">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <Car className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Medical Transport</p>
                    <p className="text-xs text-muted-foreground" data-testid="text-distance">{fareEstimate.distance.toFixed(1)} mi · Est. {Math.ceil(fareEstimate.distance * 2.5)} min</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xl font-bold" data-testid="text-fare">${fareEstimate.fare.toFixed(2)}</p>
                  <p className="text-xs text-muted-foreground">estimated fare</p>
                </div>
              </div>
              <div className="mt-2 pt-2 border-t flex items-center gap-4 text-xs text-muted-foreground">
                <span>Base: ${BASE_FARE.toFixed(2)}</span>
                <span>·</span>
                <span>${PER_MILE_RATE.toFixed(2)}/mi</span>
                <span>·</span>
                <span>Min: ${MINIMUM_FARE.toFixed(2)}</span>
              </div>
            </div>
          )}

          <Card className="rounded-xl shadow-sm">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Car className="w-5 h-5" />
                Ride Details
              </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="patientName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center gap-1">
                            <User className="w-4 h-4" /> Patient Name
                          </FormLabel>
                          <FormControl>
                            <Input placeholder="Full name" {...field} data-testid="input-patient-name" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="patientPhone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center gap-1">
                            <Phone className="w-4 h-4" /> Phone
                          </FormLabel>
                          <FormControl>
                            <Input placeholder="(555) 123-4567" {...field} data-testid="input-patient-phone" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="bookedByOther"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-md border p-3">
                        <div className="space-y-0.5">
                          <FormLabel className="text-sm font-medium flex items-center gap-2">
                            <Heart className="w-4 h-4 text-primary" />
                            Booking for a family member or loved one?
                          </FormLabel>
                          <p className="text-xs text-muted-foreground">
                            You can book a ride on behalf of someone else and track their journey
                          </p>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            data-testid="switch-booked-by-other"
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  {bookedByOther && (
                    <Card className="border-primary/20">
                      <CardContent className="pt-4 space-y-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Users className="w-4 h-4 text-primary" />
                          <span className="text-sm font-medium">Your Information (Person Booking)</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <FormField
                            control={form.control}
                            name="bookerName"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Your Name</FormLabel>
                                <FormControl>
                                  <Input placeholder="Your full name" {...field} data-testid="input-booker-name" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="bookerPhone"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Your Phone</FormLabel>
                                <FormControl>
                                  <Input placeholder="(555) 123-4567" {...field} data-testid="input-booker-phone" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <FormField
                            control={form.control}
                            name="bookerEmail"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Your Email (for updates)</FormLabel>
                                <FormControl>
                                  <Input type="email" placeholder="your@email.com" {...field} data-testid="input-booker-email" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="bookerRelation"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Relationship to Patient</FormLabel>
                                  <Select onValueChange={field.onChange} value={field.value}>
                                    <FormControl>
                                      <SelectTrigger data-testid="select-booker-relation">
                                        <SelectValue placeholder="Select..." />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      <SelectItem value="spouse">Spouse/Partner</SelectItem>
                                      <SelectItem value="child">Son/Daughter</SelectItem>
                                      <SelectItem value="parent">Parent</SelectItem>
                                      <SelectItem value="caregiver">Caregiver</SelectItem>
                                      <SelectItem value="other">Other</SelectItem>
                                    </SelectContent>
                                  </Select>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                          <p className="text-xs text-muted-foreground">
                            You'll receive a tracking link after booking so you can monitor your loved one's ride in real-time.
                          </p>
                        </CardContent>
                      </Card>
                    )}

                    <FormField
                      control={form.control}
                      name="pickupAddress"
                      render={({ field }) => (
                        <FormItem>
                          <div className="flex items-center justify-between gap-2">
                            <FormLabel>Pickup Address</FormLabel>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => useMyLocation("pickup")}
                              disabled={isLocating}
                              className="text-xs"
                              data-testid="button-use-my-location"
                            >
                              <Navigation className="w-3 h-3 mr-1" />
                              {isLocating ? "Locating..." : "Use My Location"}
                            </Button>
                          </div>
                          <FormControl>
                            <AddressAutocomplete
                              onPlaceSelect={(address, lat, lng) => {
                                field.onChange(address);
                                handlePickupChange(lat, lng);
                              }}
                              placeholder="Start typing an address..."
                              value={field.value}
                              testId="input-pickup-address"
                              userLocation={userDeviceLocation}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="dropoffAddress"
                      render={({ field }) => (
                        <FormItem>
                          <div className="flex items-center justify-between gap-2">
                            <FormLabel>Dropoff Address (Medical Facility)</FormLabel>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => useMyLocation("dropoff")}
                              disabled={isLocatingDropoff}
                              className="text-xs"
                              data-testid="button-use-my-location-dropoff"
                            >
                              <Navigation className="w-3 h-3 mr-1" />
                              {isLocatingDropoff ? "Locating..." : "Use My Location"}
                            </Button>
                          </div>
                          <FormControl>
                            <AddressAutocomplete
                              onPlaceSelect={(address, lat, lng) => {
                                field.onChange(address);
                                handleDropoffChange(lat, lng);
                              }}
                              placeholder="Start typing an address..."
                              value={field.value}
                              testId="input-dropoff-address"
                              userLocation={userDeviceLocation}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="appointmentTime"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center gap-1">
                            <Calendar className="w-4 h-4" /> Appointment Date & Time
                          </FormLabel>
                          <FormControl>
                            <Input type="datetime-local" {...field} data-testid="input-appointment-time" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div>
                      <FormLabel className="flex items-center gap-1 mb-3">
                        <Accessibility className="w-4 h-4" /> Mobility Needs
                      </FormLabel>
                      <div className="grid grid-cols-2 gap-2">
                        {mobilityOptions.map((option) => (
                          <div key={option.id} className="flex items-center gap-2">
                            <Checkbox
                              id={option.id}
                              checked={selectedNeeds.includes(option.id)}
                              onCheckedChange={() => toggleMobilityNeed(option.id)}
                              data-testid={`checkbox-${option.id}`}
                            />
                            <label htmlFor={option.id} className="text-sm cursor-pointer">
                              {option.label}
                            </label>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="border-t pt-4">
                      <FormField
                        control={form.control}
                        name="paymentType"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="flex items-center gap-1">
                              <CreditCard className="w-4 h-4" /> Payment Method
                            </FormLabel>
                            <FormControl>
                              <RadioGroup
                                onValueChange={field.onChange}
                                defaultValue={field.value}
                                className="flex gap-4"
                              >
                                <div className="flex items-center gap-2">
                                  <RadioGroupItem value="self_pay" id="self_pay" data-testid="radio-self-pay" />
                                  <Label htmlFor="self_pay" className="cursor-pointer">Self Pay</Label>
                                </div>
                                <div className="flex items-center gap-2">
                                  <RadioGroupItem value="insurance" id="insurance" data-testid="radio-insurance" />
                                  <Label htmlFor="insurance" className="cursor-pointer">Insurance</Label>
                                </div>
                              </RadioGroup>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {paymentType === "insurance" && (
                        <div className="mt-4 p-4 bg-muted rounded-md space-y-4">
                          <div className="flex items-center gap-2 text-sm font-medium">
                            <Shield className="w-4 h-4" />
                            Insurance Information
                          </div>
                          <FormField
                            control={form.control}
                            name="insuranceProvider"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Insurance Provider</FormLabel>
                                <FormControl>
                                  <Input placeholder="e.g., Medicare, Medicaid, Blue Cross" {...field} data-testid="input-insurance-provider" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <div className="grid grid-cols-2 gap-4">
                            <FormField
                              control={form.control}
                              name="memberId"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Member ID</FormLabel>
                                  <FormControl>
                                    <Input placeholder="Member ID number" {...field} data-testid="input-member-id" />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name="groupNumber"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Group Number</FormLabel>
                                  <FormControl>
                                    <Input placeholder="Group number (if applicable)" {...field} data-testid="input-group-number" />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                          <FormField
                            control={form.control}
                            name="priorAuthNumber"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Prior Authorization Number (Optional)</FormLabel>
                                <FormControl>
                                  <Input placeholder="If you have a prior auth number" {...field} data-testid="input-prior-auth" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <p className="text-xs text-muted-foreground">
                            Your insurance will be billed for this ride. You may be responsible for any copays or non-covered amounts.
                          </p>
                        </div>
                      )}
                    </div>

                    <FormField
                      control={form.control}
                      name="notes"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Additional Notes</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Any special instructions or requirements..."
                              {...field}
                              data-testid="textarea-notes"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Account Status Alerts */}
                    {accountStatus?.tier === "yellow" && (
                      <Alert data-testid="alert-account-yellow">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertTitle>Account Notice</AlertTitle>
                        <AlertDescription>
                          {accountStatus.message || "You have a small outstanding balance on your account."}
                        </AlertDescription>
                      </Alert>
                    )}

                    {accountStatus?.tier === "orange" && (
                      <Alert variant="destructive" data-testid="alert-account-orange">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertTitle>Outstanding Balance</AlertTitle>
                        <AlertDescription>
                          {accountStatus.message || "Please contact billing to discuss payment options."}
                        </AlertDescription>
                      </Alert>
                    )}

                    {/* Emergency Booking Section - Only shown when account is blocked */}
                    {isAccountBlocked && (
                      <Alert variant="destructive" className="border-2" data-testid="alert-account-blocked">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertTitle>Account Restricted</AlertTitle>
                        <AlertDescription className="space-y-3">
                          <p>
                            Your account has a high outstanding balance and regular bookings are temporarily unavailable. 
                            Please contact billing at 1-800-CAREHUB to set up a payment plan.
                          </p>
                          
                          <div className="pt-2 border-t border-destructive/20">
                            <p className="font-semibold text-sm mb-2">
                              Emergency Medical Transport Only:
                            </p>
                            <p className="text-sm mb-3">
                              If you have a genuine medical emergency requiring immediate transport, you may use the emergency override below. 
                              This is strictly for urgent medical needs such as:
                            </p>
                            <ul className="list-disc list-inside text-sm mb-3 space-y-1">
                              <li>Emergency room or urgent care visits</li>
                              <li>Dialysis or chemotherapy appointments</li>
                              <li>Post-surgical follow-ups</li>
                              <li>Other time-sensitive medical care</li>
                            </ul>
                            
                            <div className="flex items-start gap-2 mt-3">
                              <Checkbox
                                id="emergency-checkbox"
                                checked={isEmergency}
                                onCheckedChange={(checked) => {
                                  setIsEmergency(checked === true);
                                  if (!checked) setEmergencyAcknowledged(false);
                                }}
                                data-testid="checkbox-emergency"
                              />
                              <Label htmlFor="emergency-checkbox" className="text-sm font-medium leading-tight cursor-pointer">
                                This is a medical emergency requiring immediate transport
                              </Label>
                            </div>

                            {isEmergency && (
                              <div className="mt-3 p-3 bg-background/50 rounded-md border">
                                <p className="text-sm font-semibold text-foreground mb-2">
                                  Important Notice:
                                </p>
                                <p className="text-sm text-muted-foreground mb-3">
                                  Misuse of the emergency booking feature may result in account suspension. 
                                  Emergency overrides are logged and reviewed. By proceeding, you confirm this is a genuine medical emergency.
                                </p>
                                <div className="flex items-start gap-2">
                                  <Checkbox
                                    id="emergency-acknowledge"
                                    checked={emergencyAcknowledged}
                                    onCheckedChange={(checked) => setEmergencyAcknowledged(checked === true)}
                                    data-testid="checkbox-emergency-acknowledge"
                                  />
                                  <Label htmlFor="emergency-acknowledge" className="text-sm leading-tight cursor-pointer">
                                    I understand and confirm this is a genuine medical emergency. I acknowledge that misuse may result in account suspension.
                                  </Label>
                                </div>
                              </div>
                            )}
                          </div>
                        </AlertDescription>
                      </Alert>
                    )}

                    <Button
                      type="submit"
                      className="w-full"
                      disabled={createRideMutation.isPending || createPaymentIntentMutation.isPending || !canProceedWithBooking}
                      data-testid="button-submit-ride"
                    >
                      {createRideMutation.isPending || createPaymentIntentMutation.isPending ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          {createPaymentIntentMutation.isPending ? "Setting up payment..." : "Booking..."}
                        </>
                      ) : isAccountBlocked && canProceedWithBooking ? (
                        <>
                          Book Emergency Ride <ArrowRight className="w-4 h-4 ml-2" />
                        </>
                      ) : form.watch("paymentType") === "self_pay" && stripePromise ? (
                        <>
                          <CreditCard className="w-4 h-4 mr-2" />
                          Continue to Payment
                        </>
                      ) : (
                        <>
                          Book Ride <ArrowRight className="w-4 h-4 ml-2" />
                        </>
                      )}
                    </Button>
                </div>
              </CardContent>
            </Card>

          </form>
          </Form>
        </div>
      </main>
      <Footer />
    </div>
  );
}
