import { useState, useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocation, useParams } from "wouter";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  MapPin,
  Calendar,
  Clock,
  User,
  Phone,
  Car,
  Accessibility,
  ArrowRight,
  CheckCircle2,
  Loader2,
  Navigation,
  Heart,
  LocateFixed,
  FileText,
} from "lucide-react";
import type { CaregiverPatient, Ride } from "@shared/schema";

const BASE_FARE = 20.0;
const PER_MILE_RATE = 2.5;
const MINIMUM_FARE = 22.0;

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3959;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function calculateFare(distanceMiles: number): number {
  const fare = BASE_FARE + distanceMiles * PER_MILE_RATE;
  return Math.max(fare, MINIMUM_FARE);
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

const bookRideSchema = z.object({
  pickupAddress: z.string().min(1, "Pickup address is required"),
  pickupLat: z.string(),
  pickupLng: z.string(),
  dropoffAddress: z.string().min(1, "Dropoff address is required"),
  dropoffLat: z.string(),
  dropoffLng: z.string(),
  appointmentTime: z.string().min(1, "Appointment time is required"),
  notes: z.string().optional(),
  requiredVehicleType: z.string().optional(),
  waitAtAppointment: z.boolean().default(false),
});

type BookRideFormData = z.infer<typeof bookRideSchema>;

interface AddressAutocompleteProps {
  onPlaceSelect: (address: string, lat: number, lng: number) => void;
  placeholder?: string;
  value?: string;
  testId?: string;
}

function AddressAutocomplete({ onPlaceSelect, placeholder, value = "", testId }: AddressAutocompleteProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [localValue, setLocalValue] = useState(value);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const onPlaceSelectRef = useRef(onPlaceSelect);

  useEffect(() => {
    onPlaceSelectRef.current = onPlaceSelect;
  }, [onPlaceSelect]);

  useEffect(() => {
    setLocalValue(value);
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
                if (window.google?.maps?.places) resolve();
                else setTimeout(checkGoogle, 100);
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
              setLocalValue(address);
              onPlaceSelectRef.current(address, place.geometry.location.lat(), place.geometry.location.lng());
            }
          });
        }
      } catch (error) {
        console.error("Failed to load Google Places:", error);
      }
    };

    loadPlacesLibrary();
    return () => { mounted = false; };
  }, []);

  return (
    <Input
      ref={inputRef}
      placeholder={placeholder}
      value={localValue}
      onChange={(e) => setLocalValue(e.target.value)}
      data-testid={testId}
    />
  );
}

export default function CaregiverBookRide() {
  const [, navigate] = useLocation();
  const params = useParams<{ patientId: string }>();
  const patientId = params.patientId ? parseInt(params.patientId) : null;
  const { toast } = useToast();

  const [selectedNeeds, setSelectedNeeds] = useState<string[]>([]);
  const [pickupCoords, setPickupCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [dropoffCoords, setDropoffCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [fareEstimate, setFareEstimate] = useState<{ distance: number; fare: number; tolls: number; tollZones: Array<{ name: string; amount: number }> } | null>(null);
  const [bookingSuccess, setBookingSuccess] = useState(false);
  const [bookedRide, setBoostedRide] = useState<Ride | null>(null);
  const [isLocatingPickup, setIsLocatingPickup] = useState(false);
  const [isLocatingDropoff, setIsLocatingDropoff] = useState(false);

  const patientQuery = useQuery<CaregiverPatient[]>({
    queryKey: ["/api/caregiver/patients"],
  });

  const patient = patientQuery.data?.find((p) => p.id === patientId) || null;

  useEffect(() => {
    if (patient) {
      setSelectedNeeds(patient.mobilityNeeds || []);
    }
  }, [patient]);

  useEffect(() => {
    if (pickupCoords && dropoffCoords) {
      const distance = calculateDistance(
        pickupCoords.lat,
        pickupCoords.lng,
        dropoffCoords.lat,
        dropoffCoords.lng
      );
      const baseFare = calculateFare(distance);
      
      fetch("/api/toll-zones/estimate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pickupLat: pickupCoords.lat,
          pickupLng: pickupCoords.lng,
          dropoffLat: dropoffCoords.lat,
          dropoffLng: dropoffCoords.lng,
        }),
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
  }, [pickupCoords, dropoffCoords]);

  const form = useForm<BookRideFormData>({
    resolver: zodResolver(bookRideSchema),
    defaultValues: {
      pickupAddress: "",
      pickupLat: "",
      pickupLng: "",
      dropoffAddress: "",
      dropoffLat: "",
      dropoffLng: "",
      appointmentTime: "",
      notes: "",
      requiredVehicleType: "",
      waitAtAppointment: false,
    },
  });

  const bookRideMutation = useMutation({
    mutationFn: async (data: BookRideFormData) => {
      const response = await apiRequest("POST", "/api/caregiver/book-ride", {
        patientId: patientId,
        pickupAddress: data.pickupAddress,
        pickupLat: data.pickupLat,
        pickupLng: data.pickupLng,
        dropoffAddress: data.dropoffAddress,
        dropoffLat: data.dropoffLat,
        dropoffLng: data.dropoffLng,
        appointmentTime: new Date(data.appointmentTime).toISOString(),
        mobilityNeeds: selectedNeeds,
        notes: data.notes,
        requiredVehicleType: data.requiredVehicleType || undefined,
        distanceMiles: fareEstimate?.distance.toFixed(2),
        estimatedFare: fareEstimate?.fare.toFixed(2),
        estimatedTolls: fareEstimate?.tolls?.toFixed(2) || "0",
      });
      return response.json();
    },
    onSuccess: (ride) => {
      toast({
        title: "Ride Booked",
        description: `Ride booked for ${patient?.patientName || "patient"}. A driver will be assigned shortly.`,
      });
      setBoostedRide(ride);
      setBookingSuccess(true);
      queryClient.invalidateQueries({ queryKey: ["/api/caregiver/dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["/api/caregiver/patients"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Booking Failed",
        description: error.message || "Could not book the ride. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handlePickupSelect = (address: string, lat: number, lng: number) => {
    form.setValue("pickupAddress", address);
    form.setValue("pickupLat", lat.toString());
    form.setValue("pickupLng", lng.toString());
    setPickupCoords({ lat, lng });
  };

  const handleDropoffSelect = (address: string, lat: number, lng: number) => {
    form.setValue("dropoffAddress", address);
    form.setValue("dropoffLat", lat.toString());
    form.setValue("dropoffLng", lng.toString());
    setDropoffCoords({ lat, lng });
  };

  const useMyLocation = (type: "pickup" | "dropoff") => {
    if (!navigator.geolocation) {
      toast({ title: "Not Supported", description: "Location services not available.", variant: "destructive" });
      return;
    }

    if (type === "pickup") setIsLocatingPickup(true);
    else setIsLocatingDropoff(true);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        const handler = type === "pickup" ? handlePickupSelect : handleDropoffSelect;

        try {
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&addressdetails=1`
          );
          const data = await response.json();
          handler(data.display_name || `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`, latitude, longitude);
        } catch {
          handler(`${latitude.toFixed(6)}, ${longitude.toFixed(6)}`, latitude, longitude);
        }

        if (type === "pickup") setIsLocatingPickup(false);
        else setIsLocatingDropoff(false);
      },
      () => {
        toast({ title: "Location Error", description: "Unable to get your location.", variant: "destructive" });
        if (type === "pickup") setIsLocatingPickup(false);
        else setIsLocatingDropoff(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const onSubmit = (data: BookRideFormData) => {
    if (!pickupCoords || !dropoffCoords) {
      toast({
        title: "Location Required",
        description: "Please enter both pickup and dropoff addresses.",
        variant: "destructive",
      });
      return;
    }
    bookRideMutation.mutate(data);
  };

  if (patientQuery.isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header title="Book Ride" showBack />
        <main className="container mx-auto px-4 py-6 max-w-2xl">
          <Card>
            <CardContent className="p-6 space-y-4">
              <Skeleton className="h-8 w-1/2" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  if (!patient) {
    return (
      <div className="min-h-screen bg-background">
        <Header title="Book Ride" showBack />
        <main className="container mx-auto px-4 py-16 text-center">
          <Card className="max-w-md mx-auto">
            <CardContent className="p-8">
              <User className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
              <h2 className="text-xl font-semibold mb-2">Patient Not Found</h2>
              <p className="text-muted-foreground mb-4">
                The patient could not be found. Please go back and try again.
              </p>
              <Button onClick={() => navigate("/caregiver")} data-testid="button-back-to-portal">
                Back to Family Portal
              </Button>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  if (bookingSuccess && bookedRide) {
    return (
      <div className="min-h-screen bg-background">
        <Header title="Ride Booked" showBack />
        <main className="container mx-auto px-4 py-16">
          <Card className="max-w-2xl mx-auto">
            <CardContent className="p-8 text-center">
              <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
              <h2 className="text-2xl font-bold mb-2" data-testid="text-booking-success">Ride Booked Successfully</h2>
              <p className="text-muted-foreground mb-6">
                A ride has been booked for {patient.patientName}. A driver will be assigned shortly.
              </p>
              <div className="bg-muted p-4 rounded-md mb-6 text-left">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Ride ID:</span>
                    <p className="font-medium">#{bookedRide.id}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Patient:</span>
                    <p className="font-medium">{bookedRide.patientName}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Pickup:</span>
                    <p className="font-medium">{bookedRide.pickupAddress}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Dropoff:</span>
                    <p className="font-medium">{bookedRide.dropoffAddress}</p>
                  </div>
                  {bookedRide.estimatedFare && (
                    <div>
                      <span className="text-muted-foreground">Estimated Fare:</span>
                      <p className="font-medium">${parseFloat(bookedRide.estimatedFare).toFixed(2)}</p>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex gap-3 justify-center flex-wrap">
                <Button onClick={() => navigate("/caregiver")} data-testid="button-back-to-dashboard">
                  Back to Family Portal
                </Button>
                <Button variant="outline" onClick={() => navigate(`/track/${bookedRide.id}`)} data-testid="button-track-booked-ride">
                  Track Ride
                </Button>
              </div>
            </CardContent>
          </Card>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header title="Book Ride" showBack />
      <main className="container mx-auto px-4 py-6 max-w-2xl">
        <Card className="mb-4">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-primary/10">
                <Heart className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h2 className="font-semibold" data-testid="text-booking-patient-name">
                  Booking for {patient.patientName}
                </h2>
                <div className="flex items-center gap-3 text-sm text-muted-foreground flex-wrap">
                  <span className="flex items-center gap-1">
                    <Phone className="w-3.5 h-3.5" />
                    {patient.patientPhone}
                  </span>
                  {patient.mobilityNeeds && patient.mobilityNeeds.length > 0 && (
                    <span className="flex items-center gap-1">
                      <Accessibility className="w-3.5 h-3.5" />
                      {patient.mobilityNeeds.join(", ")}
                    </span>
                  )}
                </div>
              </div>
            </div>
            {patient.medicalNotes && (
              <div className="mt-3 p-2 bg-muted rounded-md text-sm flex items-start gap-2">
                <FileText className="w-3.5 h-3.5 mt-0.5 text-muted-foreground" />
                <span>{patient.medicalNotes}</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Car className="w-5 h-5" />
              Ride Details
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                <FormField
                  control={form.control}
                  name="pickupAddress"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-green-600" />
                        Pickup Address
                      </FormLabel>
                      <div className="flex gap-2">
                        <FormControl>
                          <AddressAutocomplete
                            onPlaceSelect={handlePickupSelect}
                            placeholder="Enter pickup address"
                            value={field.value}
                            testId="input-pickup-address"
                          />
                        </FormControl>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() => useMyLocation("pickup")}
                          disabled={isLocatingPickup}
                          data-testid="button-locate-pickup"
                        >
                          {isLocatingPickup ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <LocateFixed className="w-4 h-4" />
                          )}
                        </Button>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="dropoffAddress"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-red-600" />
                        Dropoff Address
                      </FormLabel>
                      <div className="flex gap-2">
                        <FormControl>
                          <AddressAutocomplete
                            onPlaceSelect={handleDropoffSelect}
                            placeholder="Enter dropoff address"
                            value={field.value}
                            testId="input-dropoff-address"
                          />
                        </FormControl>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() => useMyLocation("dropoff")}
                          disabled={isLocatingDropoff}
                          data-testid="button-locate-dropoff"
                        >
                          {isLocatingDropoff ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <LocateFixed className="w-4 h-4" />
                          )}
                        </Button>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="appointmentTime"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        Appointment Time
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
                      <FormLabel className="flex items-center gap-2">
                        <Car className="w-4 h-4" />
                        Vehicle Type
                      </FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-vehicle-type">
                            <SelectValue placeholder="Any available vehicle" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {vehicleTypes.map((type) => (
                            <SelectItem key={type.value} value={type.value}>
                              {type.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Accessibility className="w-4 h-4" />
                    Mobility Needs
                  </Label>
                  <div className="flex flex-wrap gap-2">
                    {mobilityOptions.map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => {
                          setSelectedNeeds((prev) =>
                            prev.includes(option.id)
                              ? prev.filter((n) => n !== option.id)
                              : [...prev, option.id]
                          );
                        }}
                        className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition-all duration-150 active:scale-[0.96] ${
                          selectedNeeds.includes(option.id)
                            ? "bg-black text-white dark:bg-white dark:text-black"
                            : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                        }`}
                        data-testid={`checkbox-ride-mobility-${option.id}`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>

                <FormField
                  control={form.control}
                  name="waitAtAppointment"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between py-3 border-b border-gray-100 dark:border-gray-800">
                      <div className="pr-4">
                        <FormLabel className="text-sm font-medium">
                          Driver should wait
                        </FormLabel>
                        <FormDescription className="text-xs">
                          Driver waits at the appointment for the patient
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          data-testid="switch-wait-at-appointment"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Special Instructions (Optional)</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Any special instructions for the driver..."
                          {...field}
                          data-testid="input-notes"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {fareEstimate && (
                  <Card>
                    <CardContent className="p-4">
                      <h3 className="font-semibold mb-2">Fare Estimate</h3>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <span className="text-muted-foreground">Distance:</span>
                        <span className="font-medium" data-testid="text-fare-distance">
                          {fareEstimate.distance.toFixed(1)} miles
                        </span>
                        {fareEstimate.tolls > 0 && (
                          <>
                            <span className="text-muted-foreground">Tolls:</span>
                            <span className="font-medium text-orange-600 dark:text-orange-400" data-testid="text-fare-tolls">
                              ${fareEstimate.tolls.toFixed(2)}
                            </span>
                          </>
                        )}
                        <span className="text-muted-foreground">Estimated Fare:</span>
                        <span className="font-bold text-lg" data-testid="text-fare-amount">
                          ${fareEstimate.fare.toFixed(2)}
                        </span>
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

                <Button
                  type="submit"
                  className="w-full h-12 rounded-full bg-black text-white hover:bg-gray-900 dark:bg-white dark:text-black dark:hover:bg-gray-100 text-base font-semibold"
                  disabled={bookRideMutation.isPending}
                  data-testid="button-submit-booking"
                >
                  {bookRideMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Booking Ride...
                    </>
                  ) : (
                    <>
                      <Car className="w-4 h-4 mr-2" />
                      Book Ride for {patient.patientName}
                    </>
                  )}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </main>
      <Footer />
    </div>
  );
}
