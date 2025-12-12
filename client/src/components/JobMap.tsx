import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { MapPin, Clock, DollarSign, Building2 } from "lucide-react";
import type { Job } from "@shared/schema";

const urgencyColors: Record<string, string> = {
  immediate: "bg-red-500 dark:bg-red-600",
  within_24hrs: "bg-amber-500 dark:bg-amber-600",
  scheduled: "bg-green-500 dark:bg-green-600",
};

const urgencyLabels: Record<string, string> = {
  immediate: "Immediate",
  within_24hrs: "Within 24hrs",
  scheduled: "Scheduled",
};

function createMarkerIcon(urgency: string) {
  const colors: Record<string, string> = {
    immediate: "#ef4444",
    within_24hrs: "#f59e0b",
    scheduled: "#22c55e",
  };

  const color = colors[urgency] || "#3b82f6";

  return L.divIcon({
    className: "custom-marker",
    html: `<div style="background-color: ${color}; width: 24px; height: 24px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 6px rgba(0,0,0,0.3);"></div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
}

function MapController({ selectedJob }: { selectedJob: Job | null }) {
  const map = useMap();

  useEffect(() => {
    if (selectedJob) {
      map.flyTo([parseFloat(selectedJob.lat), parseFloat(selectedJob.lng)], 12, { duration: 0.5 });
    }
  }, [selectedJob, map]);

  return null;
}

export default function JobMap() {
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);

  const { data: jobs = [], isLoading } = useQuery<Job[]>({
    queryKey: ["/api/jobs"],
  });

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

  return (
    <section id="jobs" className="py-20 bg-card">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-semibold mb-4">
            Available Healthcare Positions
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Explore open positions near you. Click on a marker or job card for details.
          </p>
        </div>

        <div className="flex flex-col lg:flex-row gap-6">
          <div className="lg:w-[60%] h-[400px] lg:h-[500px] rounded-md overflow-hidden border">
            <MapContainer
              center={[36.7783, -119.4179]}
              zoom={6}
              className="h-full w-full"
              scrollWheelZoom={true}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <MapController selectedJob={selectedJob} />
              {jobs.map((job) => (
                <Marker
                  key={job.id}
                  position={[parseFloat(job.lat), parseFloat(job.lng)]}
                  icon={createMarkerIcon(job.urgency)}
                  eventHandlers={{
                    click: () => setSelectedJob(job),
                  }}
                >
                  <Popup>
                    <div className="p-1">
                      <p className="font-semibold">{job.title}</p>
                      <p className="text-sm text-muted-foreground">{job.facility}</p>
                      <p className="text-sm font-medium text-primary">{job.pay}</p>
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          </div>

          <div className="lg:w-[40%] max-h-[500px] overflow-y-auto space-y-4">
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
            </div>

            {jobs.length === 0 ? (
              <Card>
                <CardContent className="p-6 text-center text-muted-foreground">
                  No jobs available at the moment. Check back soon!
                </CardContent>
              </Card>
            ) : (
              jobs.map((job) => (
                <Card
                  key={job.id}
                  className={`cursor-pointer hover-elevate transition-all ${
                    selectedJob?.id === job.id ? "ring-2 ring-primary" : ""
                  }`}
                  onClick={() => setSelectedJob(job)}
                  data-testid={`card-job-${job.id}`}
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

                    <Button className="w-full" data-testid={`button-apply-${job.id}`}>
                      Apply Now
                    </Button>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
