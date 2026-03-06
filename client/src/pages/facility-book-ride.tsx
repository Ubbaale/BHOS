import { useState, useEffect, useRef, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import {
  Building2,
  MapPin,
  User,
  Phone,
  Mail,
  Car,
  Accessibility,
  ArrowRight,
  CheckCircle2,
  Loader2,
  ArrowLeft,
  Clock,
  AlertTriangle,
  FileText,
} from "lucide-react";
import type { Facility, FacilityStaff } from "@shared/schema";

const facilityBookRideSchema = z.object({
  transportType: z.enum(["discharge", "appointment"]),
  patientName: z.string().min(1, "Patient name is required"),
  patientPhone: z.string().min(10, "Valid phone number is required"),
  patientEmail: z.string().optional().transform(val => val === "" ? undefined : val).pipe(z.string().email().optional().or(z.literal("")).or(z.undefined())),
  pickupAddress: z.string().min(1, "Pickup address is required"),
  pickupLat: z.string(),
  pickupLng: z.string(),
  dropoffAddress: z.string().min(1, "Dropoff address is required"),
  dropoffLat: z.string(),
  dropoffLng: z.string(),
  appointmentTime: z.string().min(1, "Appointment/pickup time is required"),
  mobilityNeeds: z.array(z.string()).optional(),
  notes: z.string().optional(),
  requiredVehicleType: z.string().optional(),
  waitAtAppointment: z.boolean().default(false),
});

type FacilityBookRideFormData = z.infer<typeof facilityBookRideSchema>;

interface FacilityStaffCheck {
  isFacilityStaff: boolean;
  staff: (FacilityStaff & { facility?: Facility }) | null;
}

const mobilityOptions = [
  { id: "wheelchair", label: "Wheelchair" },
  { id: "stretcher", label: "Stretcher" },
  { id: "walker", label: "Walker/Cane" },
  { id: "oxygen", label: "Oxygen Tank" },
];

const vehicleTypes = [
  { value: "sedan", label: "Sedan" },
  { value: "suv", label: "SUV" },
  { value: "wheelchair_van", label: "Wheelchair Van" },
  { value: "stretcher_van", label: "Stretcher Van" },
  { value: "minivan", label: "Minivan" },
];

interface AddressAutocompleteProps {
  onPlaceSelect: (address: string, lat: number, lng: number) => void;
  placeholder?: string;
  value?: string;
  testId?: string;
}

function AddressAutocomplete({ onPlaceSelect, placeholder, value = "", testId }: AddressAutocompleteProps) {
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
          const autocomplete = new google.maps.places.Autocomplete(inputRef.current, {
            componentRestrictions: { country: "us" },
            fields: ["formatted_address", "geometry", "name"],
          });

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
  }, []);

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

export default function FacilityBookRide() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [selectedNeeds, setSelectedNeeds] = useState<string[]>([]);
  const [bookingSuccess, setBookingSuccess] = useState(false);
  const [fareEstimate, setFareEstimate] = useState<{ distance: number; fare: number; tolls: number; tollZones: Array<{ name: string; amount: number }> } | null>(null);

  const { data: staffCheck, isLoading: staffCheckLoading } = useQuery<FacilityStaffCheck>({
    queryKey: ["/api/facility/staff-check"],
    enabled: isAuthenticated,
  });

  const { data: dashboard } = useQuery<{
    facility: Facility;
    rides: any[];
    staff: FacilityStaff;
  }>({
    queryKey: ["/api/facility/dashboard"],
    enabled: isAuthenticated && staffCheck?.isFacilityStaff === true,
  });

  const facility = dashboard?.facility;

  const form = useForm<FacilityBookRideFormData>({
    resolver: zodResolver(facilityBookRideSchema),
    defaultValues: {
      transportType: "discharge",
      patientName: "",
      patientPhone: "",
      patientEmail: "",
      pickupAddress: "",
      pickupLat: "",
      pickupLng: "",
      dropoffAddress: "",
      dropoffLat: "",
      dropoffLng: "",
      appointmentTime: "",
      mobilityNeeds: [],
      notes: "",
      requiredVehicleType: undefined,
      waitAtAppointment: false,
    },
  });

  const transportType = form.watch("transportType");

  useEffect(() => {
    if (facility) {
      if (transportType === "discharge") {
        form.setValue("pickupAddress", facility.address);
        form.setValue("pickupLat", facility.lat || "0");
        form.setValue("pickupLng", facility.lng || "0");
        form.setValue("dropoffAddress", "");
        form.setValue("dropoffLat", "");
        form.setValue("dropoffLng", "");
      } else {
        form.setValue("dropoffAddress", facility.address);
        form.setValue("dropoffLat", facility.lat || "0");
        form.setValue("dropoffLng", facility.lng || "0");
        form.setValue("pickupAddress", "");
        form.setValue("pickupLat", "");
        form.setValue("pickupLng", "");
      }
    }
  }, [transportType, facility]);

  const pickupLat = form.watch("pickupLat");
  const pickupLng = form.watch("pickupLng");
  const dropoffLat = form.watch("dropoffLat");
  const dropoffLng = form.watch("dropoffLng");

  useEffect(() => {
    const pLat = parseFloat(pickupLat);
    const pLng = parseFloat(pickupLng);
    const dLat = parseFloat(dropoffLat);
    const dLng = parseFloat(dropoffLng);
    
    if (!isNaN(pLat) && !isNaN(pLng) && !isNaN(dLat) && !isNaN(dLng) &&
        pLat !== 0 && pLng !== 0 && dLat !== 0 && dLng !== 0) {
      const R = 3959;
      const dLatR = (dLat - pLat) * Math.PI / 180;
      const dLngR = (dLng - pLng) * Math.PI / 180;
      const a = Math.sin(dLatR/2) * Math.sin(dLatR/2) +
        Math.cos(pLat * Math.PI / 180) * Math.cos(dLat * Math.PI / 180) *
        Math.sin(dLngR/2) * Math.sin(dLngR/2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      const distance = R * c;

      const baseFare = Math.max(22, 20 + distance * 2.50);

      fetch("/api/toll-zones/estimate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pickupLat: pLat, pickupLng: pLng, dropoffLat: dLat, dropoffLng: dLng }),
      })
        .then(res => res.json())
        .then(data => {
          const tolls = parseFloat(data.estimatedTolls || "0");
          setFareEstimate({ distance, fare: baseFare + tolls, tolls, tollZones: data.tollZones || [] });
        })
        .catch(() => {
          setFareEstimate({ distance, fare: baseFare, tolls: 0, tollZones: [] });
        });
    } else {
      setFareEstimate(null);
    }
  }, [pickupLat, pickupLng, dropoffLat, dropoffLng]);

  const bookRideMutation = useMutation({
    mutationFn: async (data: FacilityBookRideFormData) => {
      const response = await apiRequest("POST", "/api/facility/book-ride", {
        patientName: data.patientName,
        patientPhone: data.patientPhone,
        patientEmail: data.patientEmail || undefined,
        pickupAddress: data.pickupAddress,
        pickupLat: data.pickupLat,
        pickupLng: data.pickupLng,
        dropoffAddress: data.dropoffAddress,
        dropoffLat: data.dropoffLat,
        dropoffLng: data.dropoffLng,
        appointmentTime: new Date(data.appointmentTime).toISOString(),
        mobilityNeeds: data.mobilityNeeds,
        notes: data.notes,
        requiredVehicleType: data.requiredVehicleType || undefined,
        distanceMiles: fareEstimate?.distance.toFixed(2),
        estimatedFare: fareEstimate?.fare.toFixed(2),
        estimatedTolls: fareEstimate?.tolls?.toFixed(2) || "0",
      });
      return response.json();
    },
    onSuccess: () => {
      setBookingSuccess(true);
      queryClient.invalidateQueries({ queryKey: ["/api/facility/dashboard"] });
      toast({
        title: "Transport Requested",
        description: "The ride has been booked successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Booking Failed",
        description: error.message || "Failed to book transport. Please try again.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: FacilityBookRideFormData) => {
    data.mobilityNeeds = selectedNeeds;
    bookRideMutation.mutate(data);
  };

  if (authLoading || staffCheckLoading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header title="Request Transport" showBack />
        <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-8">
          <Skeleton className="h-10 w-full mb-4" />
          <Skeleton className="h-64 w-full" />
        </main>
      </div>
    );
  }

  if (!isAuthenticated || !staffCheck?.isFacilityStaff) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header title="Request Transport" showBack />
        <main className="flex-1 flex items-center justify-center px-4">
          <Card className="max-w-md w-full">
            <CardContent className="pt-6 text-center space-y-4">
              <AlertTriangle className="w-12 h-12 text-muted-foreground mx-auto" />
              <h2 className="text-xl font-semibold" data-testid="text-no-access">Access Denied</h2>
              <p className="text-muted-foreground">
                You must be facility staff to book facility rides.
              </p>
              <Button variant="outline" onClick={() => navigate("/")} data-testid="button-go-home">
                Go Home
              </Button>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  if (bookingSuccess) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header title="Transport Requested" showBack />
        <main className="flex-1 flex items-center justify-center px-4">
          <Card className="max-w-md w-full">
            <CardContent className="pt-6 text-center space-y-4">
              <CheckCircle2 className="w-16 h-16 text-primary mx-auto" />
              <h2 className="text-xl font-semibold" data-testid="text-success">Transport Requested</h2>
              <p className="text-muted-foreground">
                The ride has been submitted and a driver will be assigned shortly.
              </p>
              <div className="flex flex-col gap-2">
                <Button onClick={() => navigate("/facility")} data-testid="button-back-dashboard">
                  Back to Dashboard
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setBookingSuccess(false);
                    form.reset();
                    setSelectedNeeds([]);
                  }}
                  data-testid="button-book-another"
                >
                  Book Another Ride
                </Button>
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header title="Request Transport" showBack />
      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-6 md:py-8">
        {facility && (
          <div className="flex items-center gap-2 mb-4 p-3 rounded-md bg-muted/50">
            <Building2 className="w-5 h-5 text-primary" />
            <span className="text-sm font-medium" data-testid="text-booking-facility">
              Booking from: {facility.name}
            </span>
          </div>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Car className="w-5 h-5" />
                  Transport Type
                </CardTitle>
              </CardHeader>
              <CardContent>
                <FormField
                  control={form.control}
                  name="transportType"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <RadioGroup
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                          className="grid grid-cols-1 sm:grid-cols-2 gap-3"
                        >
                          <Label
                            htmlFor="discharge"
                            className={`flex flex-col items-center gap-2 p-4 rounded-md border-2 cursor-pointer transition-colors ${
                              field.value === "discharge"
                                ? "border-primary bg-primary/5"
                                : "border-border"
                            }`}
                          >
                            <RadioGroupItem value="discharge" id="discharge" className="sr-only" />
                            <Building2 className="w-6 h-6" />
                            <span className="font-medium">Discharge Transport</span>
                            <span className="text-xs text-muted-foreground text-center">
                              Facility to patient's home
                            </span>
                          </Label>
                          <Label
                            htmlFor="appointment"
                            className={`flex flex-col items-center gap-2 p-4 rounded-md border-2 cursor-pointer transition-colors ${
                              field.value === "appointment"
                                ? "border-primary bg-primary/5"
                                : "border-border"
                            }`}
                          >
                            <RadioGroupItem value="appointment" id="appointment" className="sr-only" />
                            <MapPin className="w-6 h-6" />
                            <span className="font-medium">Appointment Transport</span>
                            <span className="text-xs text-muted-foreground text-center">
                              Patient's home to facility
                            </span>
                          </Label>
                        </RadioGroup>
                      </FormControl>
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="w-5 h-5" />
                  Patient Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="patientName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Patient Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Full name" {...field} data-testid="input-patient-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="patientPhone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Phone Number</FormLabel>
                        <FormControl>
                          <Input placeholder="(555) 555-5555" {...field} data-testid="input-patient-phone" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="patientEmail"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email (Optional)</FormLabel>
                        <FormControl>
                          <Input placeholder="patient@email.com" {...field} data-testid="input-patient-email" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="w-5 h-5" />
                  {transportType === "discharge" ? "Destination Address" : "Pickup Address"}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {transportType === "discharge" ? (
                  <>
                    <div className="p-3 rounded-md bg-muted/50 text-sm">
                      <span className="font-medium">Pickup:</span> {facility?.address || "Facility address"}
                    </div>
                    <FormField
                      control={form.control}
                      name="dropoffAddress"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Patient's Destination</FormLabel>
                          <FormControl>
                            <AddressAutocomplete
                              placeholder="Enter destination address"
                              value={field.value}
                              onPlaceSelect={(address, lat, lng) => {
                                form.setValue("dropoffAddress", address);
                                form.setValue("dropoffLat", lat.toString());
                                form.setValue("dropoffLng", lng.toString());
                              }}
                              testId="input-dropoff-address"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </>
                ) : (
                  <>
                    <FormField
                      control={form.control}
                      name="pickupAddress"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Patient's Pickup Location</FormLabel>
                          <FormControl>
                            <AddressAutocomplete
                              placeholder="Enter pickup address"
                              value={field.value}
                              onPlaceSelect={(address, lat, lng) => {
                                form.setValue("pickupAddress", address);
                                form.setValue("pickupLat", lat.toString());
                                form.setValue("pickupLng", lng.toString());
                              }}
                              testId="input-pickup-address"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="p-3 rounded-md bg-muted/50 text-sm">
                      <span className="font-medium">Dropoff:</span> {facility?.address || "Facility address"}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="w-5 h-5" />
                  Schedule & Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="appointmentTime"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {transportType === "discharge" ? "Pickup Time" : "Appointment Time"}
                      </FormLabel>
                      <FormControl>
                        <Input type="datetime-local" {...field} data-testid="input-appointment-time" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="requiredVehicleType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Vehicle Type</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || ""}>
                        <FormControl>
                          <SelectTrigger data-testid="select-vehicle-type">
                            <SelectValue placeholder="Select vehicle type (optional)" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {vehicleTypes.map((vt) => (
                            <SelectItem key={vt.value} value={vt.value}>
                              {vt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="space-y-3">
                  <Label className="flex items-center gap-2">
                    <Accessibility className="w-4 h-4" />
                    Mobility Needs
                  </Label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {mobilityOptions.map((option) => (
                      <label
                        key={option.id}
                        htmlFor={`mobility-${option.id}`}
                        className={`flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-colors active:bg-accent/50 ${
                          selectedNeeds.includes(option.id)
                            ? "border-primary bg-primary/5"
                            : "border-border hover:bg-accent/30"
                        }`}
                      >
                        <Checkbox
                          id={`mobility-${option.id}`}
                          checked={selectedNeeds.includes(option.id)}
                          onCheckedChange={(checked) => {
                            setSelectedNeeds((prev) =>
                              checked
                                ? [...prev, option.id]
                                : prev.filter((n) => n !== option.id)
                            );
                          }}
                          data-testid={`checkbox-mobility-${option.id}`}
                        />
                        <span className="text-sm font-medium select-none">
                          {option.label}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                {transportType === "appointment" && (
                  <FormField
                    control={form.control}
                    name="waitAtAppointment"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-md border p-3">
                        <div className="space-y-0.5">
                          <FormLabel className="text-sm">Wait at Appointment</FormLabel>
                          <p className="text-xs text-muted-foreground">
                            Driver waits while patient is at their appointment
                          </p>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            data-testid="switch-wait-appointment"
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                )}

                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Special Instructions</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="e.g., Patient requires assistance, specific entrance, etc."
                          className="resize-none"
                          {...field}
                          data-testid="input-notes"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {fareEstimate && (
              <Card data-testid="fare-estimate">
                <CardContent className="p-4">
                  <h3 className="font-semibold mb-2 flex items-center gap-2">
                    <Car className="w-4 h-4" />
                    Fare Estimate
                  </h3>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <span className="text-muted-foreground">Distance:</span>
                    <span className="font-medium" data-testid="text-fare-distance">{fareEstimate.distance.toFixed(1)} miles</span>
                    {fareEstimate.tolls > 0 && (
                      <>
                        <span className="text-muted-foreground">Tolls:</span>
                        <span className="font-medium text-orange-600 dark:text-orange-400" data-testid="text-fare-tolls">${fareEstimate.tolls.toFixed(2)}</span>
                      </>
                    )}
                    <span className="text-muted-foreground">Estimated Fare:</span>
                    <span className="font-bold text-lg" data-testid="text-fare-amount">${fareEstimate.fare.toFixed(2)}</span>
                  </div>
                  {fareEstimate.tollZones.length > 0 && (
                    <p className="mt-2 text-xs text-muted-foreground" data-testid="toll-zones-list">
                      <span className="text-orange-600 dark:text-orange-400">Toll zones:</span>{" "}
                      {fareEstimate.tollZones.map(z => `${z.name} ($${z.amount.toFixed(2)})`).join(", ")}
                    </p>
                  )}
                </CardContent>
              </Card>
            )}

            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate("/facility")}
                className="flex-1"
                data-testid="button-cancel"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={bookRideMutation.isPending}
                className="flex-1"
                data-testid="button-submit-booking"
              >
                {bookRideMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Booking...
                  </>
                ) : (
                  <>
                    <ArrowRight className="w-4 h-4 mr-2" />
                    Request Transport
                  </>
                )}
              </Button>
            </div>
          </form>
        </Form>
      </main>
      <Footer />
    </div>
  );
}
