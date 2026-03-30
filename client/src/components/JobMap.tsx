import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MapPin, Clock, DollarSign, Building2, ExternalLink, Car, User, Accessibility, Wrench, Server } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { format } from "date-fns";
import type { Job, Ride } from "@shared/schema";

interface ExternalJob {
  GigId: number;
  Title: string;
  FreelancerName: string;
  HourlyRate: number;
  CategoryName: string;
  City: string;
  State: string;
  Country: string;
  Lat: number;
  Long: number;
  Skills: string[];
  Distance?: number;
}

interface ExternalJobsResponse {
  Code: string;
  Status: string;
  Body: {
    ItemList: ExternalJob[];
    TotalRecords: number;
  };
}

const urgencyColors: Record<string, string> = {
  immediate: "bg-red-500 dark:bg-red-600",
  within_24hrs: "bg-amber-500 dark:bg-amber-600",
  scheduled: "bg-green-500 dark:bg-green-600",
  external: "bg-blue-500 dark:bg-blue-600",
};

const urgencyLabels: Record<string, string> = {
  immediate: "Immediate",
  within_24hrs: "Within 24hrs",
  scheduled: "Scheduled",
  external: "External",
};

function createMarkerIcon(color: string) {
  return L.divIcon({
    className: "custom-marker",
    html: `<div style="background-color: ${color}; width: 24px; height: 24px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 6px rgba(0,0,0,0.3);"></div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
}

const greenMarkerIcon = createMarkerIcon("#22c55e");
const blueMarkerIcon = createMarkerIcon("#3b82f6");
const purpleMarkerIcon = createMarkerIcon("#a855f7"); // For ride requests (pickup)
const orangeMarkerIcon = createMarkerIcon("#f97316"); // For ride destinations (dropoff)
const redMarkerIcon = createMarkerIcon("#ef4444"); // For IT service tickets

type CombinedJob = Job & { isExternal?: boolean };

interface ITTicketMapItem {
  id: string;
  title: string;
  category: string;
  priority: string;
  status: string;
  city: string | null;
  state: string | null;
  lat: string;
  lng: string;
  payType: string | null;
  payRate: string | null;
  scheduledDate: string | null;
}

// Ride marker types
interface RideMarker {
  id: number;
  type: "pickup" | "dropoff";
  ride: Ride;
  lat: number;
  lng: number;
}

function MapController({ selectedJob }: { selectedJob: CombinedJob | null }) {
  const map = useMap();

  useEffect(() => {
    if (selectedJob) {
      map.flyTo([parseFloat(selectedJob.lat), parseFloat(selectedJob.lng)], 12, { duration: 0.5 });
    }
  }, [selectedJob, map]);

  return null;
}

export default function JobMap() {
  const [selectedJob, setSelectedJob] = useState<CombinedJob | null>(null);
  const [selectedRide, setSelectedRide] = useState<Ride | null>(null);
  const [selectedTicket, setSelectedTicket] = useState<ITTicketMapItem | null>(null);
  const [externalJobs, setExternalJobs] = useState<CombinedJob[]>([]);
  const [activeTab, setActiveTab] = useState<"jobs" | "rides" | "it">("jobs");
  const queryClient = useQueryClient();
  const wsRef = useRef<WebSocket | null>(null);
  const ridesWsRef = useRef<WebSocket | null>(null);

  const { data: localJobs = [], isLoading } = useQuery<Job[]>({
    queryKey: ["/api/jobs"],
  });

  // Fetch active rides for the map
  const { data: activeRides = [], isLoading: ridesLoading } = useQuery<Ride[]>({
    queryKey: ["/api/rides/all"],
    refetchInterval: 30000,
  });

  const { data: itTickets = [] } = useQuery<ITTicketMapItem[]>({
    queryKey: ["/api/it/tickets/map"],
    refetchInterval: 60000,
  });

  useEffect(() => {
    const fetchExternalJobs = async () => {
      try {
        const response = await apiRequest("POST", "/api/external-jobs", {
          latitude: 39.8283,
          longitude: -98.5795,
          pageSize: 100,
        });
        const data: ExternalJobsResponse = await response.json();
        
        if (data.Code === "200" && data.Body?.ItemList) {
          const mapped: CombinedJob[] = data.Body.ItemList.map((ext) => ({
            id: ext.GigId,
            // Show the title of the service provider needed (e.g., "LPN", "CNA")
            title: `${ext.Title.toUpperCase()} - ${ext.CategoryName}`,
            // Show as external listing
            facility: "External Listing",
            location: ext.City && ext.State ? `${ext.City}, ${ext.State}` : ext.Country || "United States",
            zipCode: null,
            state: ext.State,
            lat: String(ext.Lat),
            lng: String(ext.Long),
            pay: `$${ext.HourlyRate}/hr`,
            shift: "Available Now",
            urgency: "external" as const,
            requirements: ext.Skills?.slice(0, 5) || [],
            status: "available" as const,
            isExternal: true,
          }));
          setExternalJobs(mapped);
        }
      } catch (error) {
        console.error("Failed to fetch external jobs:", error);
      }
    };
    
    fetchExternalJobs();
  }, []);

  const jobs: CombinedJob[] = [...localJobs.map(j => ({ ...j, isExternal: false })), ...externalJobs];

  const handleWebSocketMessage = useCallback((event: MessageEvent) => {
    try {
      const { type, job } = JSON.parse(event.data);
      
      queryClient.setQueryData<Job[]>(["/api/jobs"], (oldJobs = []) => {
        if (type === "add") {
          const exists = oldJobs.some(j => j.id === job.id);
          if (exists) {
            return oldJobs.map(j => j.id === job.id ? job : j);
          }
          return [...oldJobs, job];
        } else if (type === "remove") {
          return oldJobs.filter(j => j.id !== job.id);
        } else if (type === "update") {
          return oldJobs.map(j => j.id === job.id ? job : j);
        }
        return oldJobs;
      });

      if (type === "remove" && selectedJob?.id === job.id) {
        setSelectedJob(null);
      }
    } catch (error) {
      console.error("Error processing WebSocket message:", error);
    }
  }, [queryClient, selectedJob]);

  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws/jobs`;
    
    const connect = () => {
      wsRef.current = new WebSocket(wsUrl);
      
      wsRef.current.onmessage = handleWebSocketMessage;
      
      wsRef.current.onclose = () => {
        setTimeout(connect, 3000);
      };
      
      wsRef.current.onerror = (error) => {
        console.error("WebSocket error:", error);
      };
    };
    
    connect();
    
    return () => {
      wsRef.current?.close();
    };
  }, [handleWebSocketMessage]);

  // WebSocket for ride updates (requires authentication)
  useEffect(() => {
    let reconnectTimeout: NodeJS.Timeout | null = null;
    let isMounted = true;
    
    const connect = async () => {
      if (!isMounted) return;
      
      try {
        // Get authentication token for WebSocket
        const tokenResponse = await fetch("/api/auth/ws-token", { credentials: "include" });
        if (!tokenResponse.ok || !isMounted) {
          // Not authenticated - skip rides WebSocket on public pages
          return;
        }
        const { token } = await tokenResponse.json();
        
        if (!isMounted) return;
        
        const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
        const wsUrl = `${protocol}//${window.location.host}/ws/rides?token=${token}`;
        
        ridesWsRef.current = new WebSocket(wsUrl);
        
        ridesWsRef.current.onmessage = () => {
          if (!isMounted) return;
          // Refetch rides when there's an update
          queryClient.invalidateQueries({ queryKey: ["/api/rides/all"] });
        };
        
        ridesWsRef.current.onclose = () => {
          // Only reconnect if still mounted
          if (isMounted) {
            reconnectTimeout = setTimeout(connect, 30000);
          }
        };
        
        ridesWsRef.current.onerror = (error) => {
          console.error("Rides WebSocket error:", error);
        };
      } catch (error) {
        console.error("Failed to connect rides WebSocket:", error);
      }
    };
    
    connect();
    
    return () => {
      isMounted = false;
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (ridesWsRef.current) {
        ridesWsRef.current.onclose = null; // Prevent onclose from triggering reconnect
        ridesWsRef.current.close();
      }
    };
  }, [queryClient]);

  // Create ride markers from active rides
  const rideMarkers: RideMarker[] = activeRides
    .filter(ride => ["requested", "accepted", "en_route", "arrived", "in_progress"].includes(ride.status))
    .flatMap(ride => [
      {
        id: ride.id,
        type: "pickup" as const,
        ride,
        lat: parseFloat(ride.pickupLat),
        lng: parseFloat(ride.pickupLng),
      },
      {
        id: ride.id,
        type: "dropoff" as const,
        ride,
        lat: parseFloat(ride.dropoffLat),
        lng: parseFloat(ride.dropoffLng),
      },
    ]);

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      requested: "Awaiting Driver",
      accepted: "Driver Assigned",
      en_route: "Driver En Route",
      arrived: "Driver Arrived",
      in_progress: "In Transit",
      completed: "Completed",
      cancelled: "Cancelled",
    };
    return labels[status] || status;
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      requested: "bg-amber-500",
      accepted: "bg-blue-500",
      en_route: "bg-blue-600",
      arrived: "bg-green-500",
      in_progress: "bg-green-600",
      completed: "bg-gray-500",
      cancelled: "bg-red-500",
    };
    return colors[status] || "bg-gray-500";
  };

  if (isLoading) {
    return (
      <section id="jobs" className="py-20 bg-card">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-12">
            <Skeleton className="h-10 w-96 mx-auto mb-4" />
            <Skeleton className="h-6 w-80 mx-auto" />
          </div>
          <div className="flex flex-col lg:flex-row gap-6">
            <Skeleton className="lg:w-[60%] h-[400px] lg:h-[500px] rounded-md" />
            <div className="lg:w-[40%] space-y-4">
              <Skeleton className="h-40" />
              <Skeleton className="h-40" />
              <Skeleton className="h-40" />
            </div>
          </div>
        </div>
      </section>
    );
  }

  // Count active rides
  const activeRideCount = activeRides.filter(r => 
    ["requested", "accepted", "en_route", "arrived", "in_progress"].includes(r.status)
  ).length;

  return (
    <section id="jobs" className="py-20 bg-card">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-semibold mb-4">
            Live Activity Map
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            View healthcare shifts, ride requests, and IT service jobs in real-time across the nation.
          </p>
        </div>

        <div className="flex flex-col lg:flex-row gap-6">
          <div className="lg:w-[60%] h-[400px] lg:h-[500px] rounded-md overflow-hidden border">
            <MapContainer
              center={[39.8283, -98.5795]}
              zoom={4}
              className="h-full w-full"
              scrollWheelZoom={true}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <MapController selectedJob={selectedJob} />
              
              {/* Healthcare Job Markers */}
              {jobs.map((job) => (
                <Marker
                  key={`${job.isExternal ? 'ext' : 'local'}-${job.id}`}
                  position={[parseFloat(job.lat), parseFloat(job.lng)]}
                  icon={job.isExternal ? blueMarkerIcon : greenMarkerIcon}
                  eventHandlers={{
                    click: () => {
                      setSelectedJob(job);
                      setSelectedRide(null);
                      setActiveTab("jobs");
                    },
                  }}
                >
                  <Popup>
                    <div className="p-1">
                      <p className="font-semibold">{job.title}</p>
                      <p className="text-sm text-muted-foreground">{job.facility}</p>
                      <p className="text-sm font-medium text-primary">{job.pay}</p>
                      {job.isExternal && (
                        <p className="text-xs text-blue-500 mt-1 flex items-center gap-1">
                          <ExternalLink className="w-3 h-3" /> External Listing
                        </p>
                      )}
                      <a
                        href={`https://app.carehubapp.com/#/login?ref=job&jobId=${job.id}&title=${encodeURIComponent(job.title)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-block mt-2 text-xs font-medium text-white bg-primary px-3 py-1 rounded hover:opacity-90"
                        data-testid={`link-apply-popup-${job.id}`}
                      >
                        Apply in App
                      </a>
                    </div>
                  </Popup>
                </Marker>
              ))}

              {/* IT Service Ticket Markers */}
              {itTickets.map((ticket) => (
                <Marker
                  key={`it-${ticket.id}`}
                  position={[parseFloat(ticket.lat), parseFloat(ticket.lng)]}
                  icon={redMarkerIcon}
                  eventHandlers={{
                    click: () => {
                      setSelectedTicket(ticket);
                      setSelectedJob(null);
                      setSelectedRide(null);
                      setActiveTab("it");
                    },
                  }}
                >
                  <Popup>
                    <div className="p-1">
                      <p className="font-semibold flex items-center gap-1">
                        <Wrench className="w-3 h-3" />
                        {ticket.title}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {ticket.city}{ticket.state ? `, ${ticket.state}` : ""}
                      </p>
                      <p className="text-xs mt-1">
                        {ticket.category} • {ticket.priority} priority
                      </p>
                      {ticket.payRate && (
                        <p className="text-xs font-medium text-primary mt-1">
                          ${ticket.payRate}/{ticket.payType === "hourly" ? "hr" : "fixed"}
                        </p>
                      )}
                    </div>
                  </Popup>
                </Marker>
              ))}

              {/* Ride Request Markers */}
              {rideMarkers.map((marker) => {
                // Extract zip code from address (last 5 digits pattern)
                const address = marker.type === "pickup" ? marker.ride.pickupAddress : marker.ride.dropoffAddress;
                const zipMatch = address?.match(/\b\d{5}(?:-\d{4})?\b/);
                const zipCode = zipMatch ? zipMatch[0] : "Area";
                
                // Extract city and state from pickup address
                const addressParts = marker.ride.pickupAddress?.split(',') || [];
                let city = "";
                let state = "";
                if (addressParts.length >= 2) {
                  city = addressParts[addressParts.length - 2]?.trim() || "";
                  const lastPart = addressParts[addressParts.length - 1]?.trim() || "";
                  const stateMatch = lastPart.match(/^([A-Z]{2})/);
                  state = stateMatch ? stateMatch[1] : "";
                }
                
                // Get distance in miles (cast to any for optional field)
                const rideAny = marker.ride as any;
                const distance = rideAny.estimatedDistance 
                  ? parseFloat(rideAny.estimatedDistance).toFixed(1) 
                  : null;
                
                return (
                  <Marker
                    key={`ride-${marker.type}-${marker.id}`}
                    position={[marker.lat, marker.lng]}
                    icon={marker.type === "pickup" ? purpleMarkerIcon : orangeMarkerIcon}
                    eventHandlers={{
                      click: () => {
                        setSelectedRide(marker.ride);
                        setSelectedJob(null);
                        setActiveTab("rides");
                      },
                    }}
                  >
                    <Popup>
                      <div className="p-1">
                        <p className="font-semibold flex items-center gap-1">
                          <Car className="w-3 h-3" />
                          Ride Requested
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {city}{state ? `, ${state}` : ""} {distance ? `• ${distance} mi` : ""}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {marker.type === "pickup" ? "Pickup" : "Dropoff"} - Zip: {zipCode}
                        </p>
                        <p className="text-xs mt-1">
                          Status: {getStatusLabel(marker.ride.status)}
                        </p>
                      </div>
                    </Popup>
                  </Marker>
                );
              })}
            </MapContainer>
          </div>

          <div className="lg:w-[40%] max-h-[500px] overflow-y-auto">
            {/* Map Legend */}
            <div className="flex flex-wrap items-center gap-2 mb-4 p-3 bg-muted/50 rounded-md">
              <span className="text-sm font-medium">Map Legend:</span>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full bg-green-500" />
                <span className="text-xs">Local Shifts</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full bg-blue-500" />
                <span className="text-xs">External Shifts</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full bg-purple-500" />
                <span className="text-xs">Ride Pickup</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full bg-orange-500" />
                <span className="text-xs">Ride Dropoff</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <span className="text-xs">IT Jobs</span>
              </div>
            </div>

            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "jobs" | "rides" | "it")} className="w-full">
              <TabsList className="w-full grid grid-cols-3 mb-4">
                <TabsTrigger value="jobs" className="flex items-center gap-2" data-testid="tab-shifts">
                  <Building2 className="w-4 h-4" />
                  Shifts ({jobs.length})
                </TabsTrigger>
                <TabsTrigger value="rides" className="flex items-center gap-2" data-testid="tab-rides">
                  <Car className="w-4 h-4" />
                  Rides ({activeRideCount})
                </TabsTrigger>
                <TabsTrigger value="it" className="flex items-center gap-2" data-testid="tab-it">
                  <Wrench className="w-4 h-4" />
                  IT ({itTickets.length})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="jobs" className="space-y-4 mt-0">
                <div className="flex flex-wrap items-center gap-2 mb-4">
                  <span className="text-sm text-muted-foreground">Urgency:</span>
                  <Badge variant="secondary" className="bg-red-500 text-white no-default-hover-elevate">
                    Immediate
                  </Badge>
                  <Badge variant="secondary" className="bg-amber-500 text-white no-default-hover-elevate">
                    Within 24hrs
                  </Badge>
                  <Badge variant="secondary" className="bg-green-500 text-white no-default-hover-elevate">
                    Scheduled
                  </Badge>
                  <Badge variant="secondary" className="bg-blue-500 text-white no-default-hover-elevate">
                    External
                  </Badge>
                </div>

                {jobs.length === 0 ? (
                  <Card>
                    <CardContent className="p-6 text-center text-muted-foreground">
                      No shifts available at the moment. Check back soon!
                    </CardContent>
                  </Card>
                ) : (
                  jobs.map((job) => (
                    <Card
                      key={`${job.isExternal ? 'ext' : 'local'}-${job.id}`}
                      className={`cursor-pointer hover-elevate transition-all ${
                        selectedJob?.id === job.id && selectedJob?.isExternal === job.isExternal ? "ring-2 ring-primary" : ""
                      }`}
                      onClick={() => {
                        setSelectedJob(job);
                        setSelectedRide(null);
                      }}
                      data-testid={`card-job-${job.isExternal ? 'ext' : 'local'}-${job.id}`}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-4 mb-3">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <Building2 className="w-4 h-4 text-muted-foreground" />
                              <span className="text-sm text-muted-foreground">{job.facility}</span>
                            </div>
                            <h3 className="font-semibold">{job.title}</h3>
                          </div>
                          <Badge
                            variant="secondary"
                            className={`${urgencyColors[job.urgency]} text-white no-default-hover-elevate`}
                          >
                            {urgencyLabels[job.urgency]}
                          </Badge>
                        </div>

                        <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground mb-3">
                          <span className="flex items-center gap-1">
                            <MapPin className="w-4 h-4" />
                            {job.location}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-4 h-4" />
                            {job.shift}
                          </span>
                          <span className="flex items-center gap-1 font-semibold text-foreground">
                            <DollarSign className="w-4 h-4" />
                            {job.pay}
                          </span>
                        </div>

                        <div className="flex flex-wrap gap-2 mb-4">
                          {job.requirements.map((req, i) => (
                            <Badge key={i} variant="secondary" className="text-xs no-default-hover-elevate">
                              {req}
                            </Badge>
                          ))}
                        </div>

                        <Button
                          className="w-full"
                          data-testid={`button-apply-${job.id}`}
                          asChild
                        >
                          <a
                            href={`https://app.carehubapp.com/#/login?ref=job&jobId=${job.id}&title=${encodeURIComponent(job.title)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            Apply Now
                          </a>
                        </Button>
                      </CardContent>
                    </Card>
                  ))
                )}
              </TabsContent>

              <TabsContent value="rides" className="space-y-4 mt-0">
                <div className="flex flex-wrap items-center gap-2 mb-4">
                  <span className="text-sm text-muted-foreground">Status:</span>
                  <Badge variant="secondary" className="bg-amber-500 text-white no-default-hover-elevate">
                    Awaiting Driver
                  </Badge>
                  <Badge variant="secondary" className="bg-blue-500 text-white no-default-hover-elevate">
                    In Progress
                  </Badge>
                  <Badge variant="secondary" className="bg-green-500 text-white no-default-hover-elevate">
                    En Route
                  </Badge>
                </div>

                {activeRideCount === 0 ? (
                  <Card>
                    <CardContent className="p-6 text-center text-muted-foreground">
                      No active ride requests at the moment.
                    </CardContent>
                  </Card>
                ) : (
                  activeRides
                    .filter(r => ["requested", "accepted", "en_route", "arrived", "in_progress"].includes(r.status))
                    .map((ride) => {
                      // Extract zip codes from addresses for privacy
                      const pickupZipMatch = ride.pickupAddress?.match(/\b\d{5}(?:-\d{4})?\b/);
                      const dropoffZipMatch = ride.dropoffAddress?.match(/\b\d{5}(?:-\d{4})?\b/);
                      const pickupZip = pickupZipMatch ? pickupZipMatch[0] : "N/A";
                      const dropoffZip = dropoffZipMatch ? dropoffZipMatch[0] : "N/A";
                      
                      // Extract city and state from pickup address (format: "Street, City, State ZIP")
                      const addressParts = ride.pickupAddress?.split(',') || [];
                      let city = "N/A";
                      let state = "";
                      if (addressParts.length >= 2) {
                        city = addressParts[addressParts.length - 2]?.trim() || "N/A";
                        // State is usually before the zip in the last part
                        const lastPart = addressParts[addressParts.length - 1]?.trim() || "";
                        const stateMatch = lastPart.match(/^([A-Z]{2})/);
                        state = stateMatch ? stateMatch[1] : "";
                      }
                      
                      // Get distance in miles (cast to any for optional field)
                      const rideAny = ride as any;
                      const distance = rideAny.estimatedDistance 
                        ? parseFloat(rideAny.estimatedDistance).toFixed(1) 
                        : null;
                      
                      return (
                        <Card
                          key={`ride-${ride.id}`}
                          className={`cursor-pointer hover-elevate transition-all ${
                            selectedRide?.id === ride.id ? "ring-2 ring-primary" : ""
                          }`}
                          onClick={() => {
                            setSelectedRide(ride);
                            setSelectedJob(null);
                          }}
                          data-testid={`card-ride-${ride.id}`}
                        >
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between gap-4 mb-3">
                              <div>
                                <div className="flex items-center gap-2 mb-1">
                                  <Car className="w-4 h-4 text-muted-foreground" />
                                  <span className="text-sm font-semibold">Ride Requested</span>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                  {city}{state ? `, ${state}` : ""} {distance ? `• ${distance} mi` : ""}
                                </p>
                              </div>
                              <Badge
                                variant="secondary"
                                className={`${getStatusColor(ride.status)} text-white no-default-hover-elevate`}
                              >
                                {getStatusLabel(ride.status)}
                              </Badge>
                            </div>

                            <div className="space-y-2 text-sm mb-3">
                              <div className="flex items-start gap-2">
                                <div className="w-3 h-3 rounded-full bg-purple-500 mt-1 shrink-0" />
                                <div>
                                  <span className="text-muted-foreground text-xs">Pickup Area</span>
                                  <p className="text-xs font-medium">Zip: {pickupZip}</p>
                                </div>
                              </div>
                              <div className="flex items-start gap-2">
                                <div className="w-3 h-3 rounded-full bg-orange-500 mt-1 shrink-0" />
                                <div>
                                  <span className="text-muted-foreground text-xs">Dropoff Area</span>
                                  <p className="text-xs font-medium">Zip: {dropoffZip}</p>
                                </div>
                              </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground mb-3">
                              <span className="flex items-center gap-1">
                                <Clock className="w-4 h-4" />
                                {ride.appointmentTime 
                                  ? format(new Date(ride.appointmentTime), "MMM d, h:mm a")
                                  : "ASAP"
                                }
                              </span>
                              {ride.estimatedFare && (
                                <span className="flex items-center gap-1 font-semibold text-foreground">
                                  <DollarSign className="w-4 h-4" />
                                  ${parseFloat(ride.estimatedFare).toFixed(2)}
                                </span>
                              )}
                            </div>

                            {ride.mobilityNeeds && ride.mobilityNeeds.length > 0 && (
                              <div className="flex flex-wrap gap-2 mb-3">
                                {ride.mobilityNeeds.map((need, i) => (
                                  <Badge key={i} variant="outline" className="text-xs flex items-center gap-1">
                                    <Accessibility className="w-3 h-3" />
                                    {need}
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      );
                    })
                )}
              </TabsContent>

              <TabsContent value="it" className="space-y-4 mt-0">
                <div className="flex flex-wrap items-center gap-2 mb-4">
                  <span className="text-sm text-muted-foreground">Priority:</span>
                  <Badge variant="secondary" className="bg-red-500 text-white no-default-hover-elevate">
                    Critical
                  </Badge>
                  <Badge variant="secondary" className="bg-amber-500 text-white no-default-hover-elevate">
                    High
                  </Badge>
                  <Badge variant="secondary" className="bg-blue-500 text-white no-default-hover-elevate">
                    Medium
                  </Badge>
                  <Badge variant="secondary" className="bg-gray-500 text-white no-default-hover-elevate">
                    Low
                  </Badge>
                </div>

                {itTickets.length === 0 ? (
                  <Card>
                    <CardContent className="p-6 text-center text-muted-foreground">
                      No open IT service tickets at the moment.
                    </CardContent>
                  </Card>
                ) : (
                  itTickets.map((ticket) => {
                    const priorityColor: Record<string, string> = {
                      critical: "bg-red-500",
                      high: "bg-amber-500",
                      medium: "bg-blue-500",
                      low: "bg-gray-500",
                    };
                    const categoryLabels: Record<string, string> = {
                      network: "Network",
                      hardware: "Hardware",
                      software: "Software",
                      printer: "Printer",
                      ehr_system: "EHR System",
                      security: "Security",
                      phone_system: "Phone System",
                      email: "Email",
                      backup: "Backup",
                      general: "General",
                    };
                    return (
                      <Card
                        key={`it-${ticket.id}`}
                        className={`cursor-pointer hover-elevate transition-all ${
                          selectedTicket?.id === ticket.id ? "ring-2 ring-primary" : ""
                        }`}
                        onClick={() => {
                          setSelectedTicket(ticket);
                          setSelectedJob(null);
                          setSelectedRide(null);
                        }}
                        data-testid={`card-it-${ticket.id}`}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between gap-4 mb-3">
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <Wrench className="w-4 h-4 text-muted-foreground" />
                                <span className="text-sm text-muted-foreground">
                                  {categoryLabels[ticket.category] || ticket.category}
                                </span>
                              </div>
                              <h3 className="font-semibold">{ticket.title}</h3>
                            </div>
                            <Badge
                              variant="secondary"
                              className={`${priorityColor[ticket.priority] || "bg-gray-500"} text-white no-default-hover-elevate`}
                            >
                              {ticket.priority.charAt(0).toUpperCase() + ticket.priority.slice(1)}
                            </Badge>
                          </div>

                          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground mb-3">
                            <span className="flex items-center gap-1">
                              <MapPin className="w-4 h-4" />
                              {ticket.city}{ticket.state ? `, ${ticket.state}` : "N/A"}
                            </span>
                            {ticket.scheduledDate && (
                              <span className="flex items-center gap-1">
                                <Clock className="w-4 h-4" />
                                {format(new Date(ticket.scheduledDate), "MMM d, yyyy")}
                              </span>
                            )}
                            {ticket.payRate && (
                              <span className="flex items-center gap-1 font-semibold text-foreground">
                                <DollarSign className="w-4 h-4" />
                                ${ticket.payRate}{ticket.payType === "hourly" ? "/hr" : " fixed"}
                              </span>
                            )}
                          </div>

                          <Badge variant="outline" className="text-xs">
                            {ticket.status === "open" ? "Open" : ticket.status === "assigned" ? "Assigned" : "In Progress"}
                          </Badge>
                        </CardContent>
                      </Card>
                    );
                  })
                )}
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </section>
  );
}
