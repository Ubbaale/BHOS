import { useState, useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useLocation, Link } from "wouter";
import Autocomplete from "react-google-autocomplete";

import Header from "@/components/Header";
import Footer from "@/components/Footer";
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
import { MapPin, Calendar, Clock, User, Phone, Car, Accessibility, ArrowRight, CheckCircle2, DollarSign, CreditCard, Shield, FileText } from "lucide-react";
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

export default function BookRide() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [pickupPos, setPickupPos] = useState<[number, number] | null>(null);
  const [dropoffPos, setDropoffPos] = useState<[number, number] | null>(null);
  const [locationMode, setLocationMode] = useState<"pickup" | "dropoff">("pickup");
  const [selectedNeeds, setSelectedNeeds] = useState<string[]>([]);
  const [bookingSuccess, setBookingSuccess] = useState(false);
  const [bookedRide, setBookedRide] = useState<Ride | null>(null);
  const [fareEstimate, setFareEstimate] = useState<{ distance: number; fare: number } | null>(null);

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

  const paymentType = form.watch("paymentType");

  const createRideMutation = useMutation({
    mutationFn: async (data: BookRideFormData) => {
      const response = await apiRequest("POST", "/api/rides", {
        ...data,
        appointmentTime: new Date(data.appointmentTime).toISOString(),
        mobilityNeeds: selectedNeeds,
        distanceMiles: fareEstimate?.distance.toFixed(2),
        estimatedFare: fareEstimate?.fare.toFixed(2),
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

  const onSubmit = (data: BookRideFormData) => {
    if (!pickupPos || !dropoffPos) {
      toast({
        title: "Location Required",
        description: "Please select both pickup and dropoff locations on the map.",
        variant: "destructive",
      });
      return;
    }
    createRideMutation.mutate(data);
  };

  if (bookingSuccess && bookedRide) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
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

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          <NotificationPrompt userType="user" />
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2">Book a Medical Ride</h1>
            <p className="text-muted-foreground">
              Schedule non-emergency medical transportation for your appointment.
            </p>
          </div>

          <div className="grid lg:grid-cols-2 gap-8">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="w-5 h-5" />
                  Select Locations
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2 mb-4 flex-wrap">
                  <Button
                    type="button"
                    variant={locationMode === "pickup" ? "default" : "outline"}
                    onClick={() => setLocationMode("pickup")}
                    size="sm"
                    data-testid="button-select-pickup"
                  >
                    <MapPin className="w-4 h-4 mr-1" />
                    Set Pickup {pickupPos && <CheckCircle2 className="w-4 h-4 ml-1 text-green-300" />}
                  </Button>
                  <Button
                    type="button"
                    variant={locationMode === "dropoff" ? "default" : "outline"}
                    onClick={() => setLocationMode("dropoff")}
                    size="sm"
                    data-testid="button-select-dropoff"
                  >
                    <MapPin className="w-4 h-4 mr-1" />
                    Set Dropoff {dropoffPos && <CheckCircle2 className="w-4 h-4 ml-1 text-green-300" />}
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                  Click on the map to set your {locationMode} location.
                </p>
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
                    <LocationPicker
                      onPickupChange={handlePickupChange}
                      onDropoffChange={handleDropoffChange}
                      pickupPos={pickupPos}
                      dropoffPos={dropoffPos}
                      mode={locationMode}
                    />
                  </MapContainer>
                </div>
                <div className="mt-4 flex gap-4 text-sm flex-wrap">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-green-500 rounded-full" />
                    <span>Pickup Location</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-red-500 rounded-full" />
                    <span>Dropoff Location</span>
                  </div>
                </div>

                {fareEstimate && (
                  <div className="mt-4 p-4 bg-muted rounded-md" data-testid="fare-estimate">
                    <div className="flex items-center gap-2 mb-2">
                      <DollarSign className="w-5 h-5 text-primary" />
                      <span className="font-semibold">Fare Estimate</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-muted-foreground">Distance:</span>
                        <p className="font-medium" data-testid="text-distance">{fareEstimate.distance.toFixed(1)} miles</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Estimated Fare:</span>
                        <p className="font-medium text-lg" data-testid="text-fare">${fareEstimate.fare.toFixed(2)}</p>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      Base fare: ${BASE_FARE.toFixed(2)} + ${PER_MILE_RATE.toFixed(2)}/mile. Minimum fare: ${MINIMUM_FARE.toFixed(2)}
                    </p>
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
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="patientName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="flex items-center gap-1">
                              <User className="w-4 h-4" /> Name
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
                      name="pickupAddress"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Pickup Address</FormLabel>
                          <FormControl>
                            <Autocomplete
                              apiKey={import.meta.env.VITE_GOOGLE_MAPS_API_KEY}
                              onPlaceSelected={(place) => {
                                if (place.formatted_address) {
                                  field.onChange(place.formatted_address);
                                }
                                if (place.geometry?.location) {
                                  const lat = place.geometry.location.lat();
                                  const lng = place.geometry.location.lng();
                                  handlePickupChange(lat, lng);
                                }
                              }}
                              options={{
                                types: ["address"],
                                componentRestrictions: { country: "us" },
                                fields: ["formatted_address", "geometry", "name"],
                              }}
                              defaultValue={field.value}
                              placeholder="Start typing an address..."
                              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
                              data-testid="input-pickup-address"
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
                          <FormLabel>Dropoff Address (Medical Facility)</FormLabel>
                          <FormControl>
                            <Autocomplete
                              apiKey={import.meta.env.VITE_GOOGLE_MAPS_API_KEY}
                              onPlaceSelected={(place) => {
                                if (place.formatted_address) {
                                  field.onChange(place.formatted_address);
                                }
                                if (place.geometry?.location) {
                                  const lat = place.geometry.location.lat();
                                  const lng = place.geometry.location.lng();
                                  handleDropoffChange(lat, lng);
                                }
                              }}
                              options={{
                                types: ["address"],
                                componentRestrictions: { country: "us" },
                                fields: ["formatted_address", "geometry", "name"],
                              }}
                              defaultValue={field.value}
                              placeholder="Start typing an address..."
                              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
                              data-testid="input-dropoff-address"
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

                    <Button
                      type="submit"
                      className="w-full"
                      disabled={createRideMutation.isPending}
                      data-testid="button-submit-ride"
                    >
                      {createRideMutation.isPending ? (
                        "Booking..."
                      ) : (
                        <>
                          Book Ride <ArrowRight className="w-4 h-4 ml-2" />
                        </>
                      )}
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
