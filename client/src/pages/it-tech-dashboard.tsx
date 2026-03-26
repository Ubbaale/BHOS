import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { useLocation } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2,
  Wrench,
  Clock,
  MapPin,
  AlertCircle,
  CheckCircle2,
  Timer,
  Send,
  ArrowLeft,
  Briefcase,
  Star,
  Wifi,
  Monitor,
  Shield,
  HardDrive,
  Server,
  Printer,
  Phone,
  Mail,
} from "lucide-react";
import type { ItServiceTicket, ItTechProfile } from "@shared/schema";

const categoryIcons: Record<string, typeof Monitor> = {
  network: Wifi, hardware: HardDrive, software: Monitor, printer: Printer,
  ehr_system: Server, security: Shield, phone_system: Phone, email: Mail,
  backup: HardDrive, general: Wrench,
};

const categoryLabels: Record<string, string> = {
  network: "Network / Wi-Fi", hardware: "Hardware", software: "Software",
  printer: "Printer / Scanner", ehr_system: "EHR System", security: "Security",
  phone_system: "Phone System", email: "Email", backup: "Backup / Recovery",
  general: "General IT",
};

const priorityColors: Record<string, string> = {
  low: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  medium: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  high: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
  urgent: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
};

const statusColors: Record<string, string> = {
  open: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  in_progress: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
  resolved: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  closed: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
};

function TicketCard({
  ticket,
  showAccept,
  showComplete,
  onAccept,
  onComplete,
  onView,
  isAccepting,
  isCompleting,
}: {
  ticket: ItServiceTicket;
  showAccept?: boolean;
  showComplete?: boolean;
  onAccept?: () => void;
  onComplete?: () => void;
  onView?: () => void;
  isAccepting?: boolean;
  isCompleting?: boolean;
}) {
  const CategoryIcon = categoryIcons[ticket.category] || Wrench;

  return (
    <Card className="hover:border-primary/50 transition-colors" data-testid={`tech-ticket-${ticket.id}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0 flex-1">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <CategoryIcon className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="text-xs text-muted-foreground font-mono">{ticket.ticketNumber}</span>
                <Badge className={priorityColors[ticket.priority]} variant="secondary">{ticket.priority}</Badge>
                <Badge className={statusColors[ticket.status]} variant="secondary">{ticket.status.replace("_", " ")}</Badge>
              </div>
              <p className="font-medium">{ticket.title}</p>
              <p className="text-sm text-muted-foreground line-clamp-2">{ticket.description}</p>
              <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground flex-wrap">
                <span className="flex items-center gap-1">
                  <Wrench className="h-3 w-3" />
                  {categoryLabels[ticket.category] || ticket.category}
                </span>
                {ticket.scheduledDate && (
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {new Date(ticket.scheduledDate).toLocaleDateString()}
                    {ticket.scheduledTime && ` ${ticket.scheduledTime}`}
                  </span>
                )}
                {ticket.siteCity && (
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {ticket.siteCity}, {ticket.siteState}
                  </span>
                )}
                {ticket.estimatedDuration && (
                  <span className="flex items-center gap-1">
                    <Timer className="h-3 w-3" />
                    {ticket.estimatedDuration}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-2 shrink-0">
            {showAccept && (
              <Button size="sm" onClick={onAccept} disabled={isAccepting} data-testid={`button-accept-${ticket.id}`}>
                {isAccepting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Accept"}
              </Button>
            )}
            {showComplete && (
              <Button size="sm" variant="outline" onClick={onComplete} disabled={isCompleting} data-testid={`button-complete-${ticket.id}`}>
                {isCompleting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Complete"}
              </Button>
            )}
          </div>
        </div>
        {(ticket.siteAddress || ticket.contactOnSite || ticket.specialInstructions) && (
          <div className="mt-3 pt-3 border-t space-y-1 text-sm">
            {ticket.siteAddress && (
              <p className="flex items-center gap-1 text-muted-foreground">
                <MapPin className="h-3 w-3" />
                {[ticket.siteAddress, ticket.siteCity, ticket.siteState, ticket.siteZipCode].filter(Boolean).join(", ")}
              </p>
            )}
            {ticket.contactOnSite && (
              <p className="text-muted-foreground">
                Contact: {ticket.contactOnSite} {ticket.contactPhone && `• ${ticket.contactPhone}`}
              </p>
            )}
            {ticket.specialInstructions && (
              <p className="text-muted-foreground italic">{ticket.specialInstructions}</p>
            )}
            {ticket.equipmentNeeded && (
              <p className="text-muted-foreground">Equipment: {ticket.equipmentNeeded}</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function ITTechDashboardPage() {
  const { isAuthenticated, user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [completingId, setCompletingId] = useState<string | null>(null);

  const { data: profile, isLoading: loadingProfile } = useQuery<ItTechProfile | null>({
    queryKey: ["/api/it/tech/profile"],
    enabled: isAuthenticated,
  });

  const { data: availableTickets = [], isLoading: loadingAvailable } = useQuery<ItServiceTicket[]>({
    queryKey: ["/api/it/tech/available-tickets"],
    enabled: isAuthenticated && profile?.applicationStatus === "approved",
  });

  const { data: myJobs = [], isLoading: loadingJobs } = useQuery<ItServiceTicket[]>({
    queryKey: ["/api/it/tech/my-jobs"],
    enabled: isAuthenticated && profile?.applicationStatus === "approved",
  });

  const acceptTicket = useMutation({
    mutationFn: (ticketId: string) => apiRequest("POST", `/api/it/tech/accept-ticket/${ticketId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/it/tech/available-tickets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/it/tech/my-jobs"] });
      toast({ title: "Job accepted!", description: "You've been assigned to this ticket." });
      setAcceptingId(null);
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
      setAcceptingId(null);
    },
  });

  const completeTicket = useMutation({
    mutationFn: (ticketId: string) => apiRequest("POST", `/api/it/tech/complete-ticket/${ticketId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/it/tech/my-jobs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/it/tech/available-tickets"] });
      toast({ title: "Job completed!", description: "Great work! The ticket has been resolved." });
      setCompletingId(null);
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
      setCompletingId(null);
    },
  });

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Header />
        <main className="flex-1 flex items-center justify-center py-12 px-4">
          <Card className="w-full max-w-md text-center">
            <CardContent className="pt-8">
              <Wrench className="h-12 w-12 mx-auto mb-4 text-primary" />
              <h2 className="text-xl font-bold mb-2">IT Tech Dashboard</h2>
              <p className="text-muted-foreground mb-4">Sign in to access your dashboard</p>
              <Button onClick={() => setLocation("/login")} data-testid="button-tech-login">Sign In</Button>
            </CardContent>
          </Card>
        </main>
        <Footer />
      </div>
    );
  }

  if (loadingProfile) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Header />
        <main className="flex-1 flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></main>
        <Footer />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Header />
        <main className="flex-1 flex items-center justify-center py-12 px-4">
          <Card className="w-full max-w-md text-center">
            <CardContent className="pt-8">
              <Wrench className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h2 className="text-xl font-bold mb-2">No Tech Profile Found</h2>
              <p className="text-muted-foreground mb-4">Apply to become a CareHub IT Technician first</p>
              <Button onClick={() => setLocation("/it-tech/apply")} data-testid="button-apply-tech">Apply Now</Button>
            </CardContent>
          </Card>
        </main>
        <Footer />
      </div>
    );
  }

  if (profile.applicationStatus === "pending") {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Header />
        <main className="flex-1 flex items-center justify-center py-12 px-4">
          <Card className="w-full max-w-md text-center">
            <CardContent className="pt-8">
              <Timer className="h-12 w-12 mx-auto mb-4 text-yellow-500" />
              <h2 className="text-xl font-bold mb-2" data-testid="text-pending-status">Application Under Review</h2>
              <p className="text-muted-foreground mb-2">
                Hi {profile.fullName}, your application is being reviewed by our team. We'll notify you once you're approved.
              </p>
              <div className="mt-4 space-y-2 text-sm text-left">
                <p><strong>Skills:</strong> {profile.skills?.join(", ") || "None listed"}</p>
                <p><strong>Experience:</strong> {profile.experienceYears} years</p>
                <p><strong>Rate:</strong> ${profile.hourlyRate || "Not set"}/hr</p>
              </div>
            </CardContent>
          </Card>
        </main>
        <Footer />
      </div>
    );
  }

  if (profile.applicationStatus === "rejected") {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Header />
        <main className="flex-1 flex items-center justify-center py-12 px-4">
          <Card className="w-full max-w-md text-center">
            <CardContent className="pt-8">
              <AlertCircle className="h-12 w-12 mx-auto mb-4 text-red-500" />
              <h2 className="text-xl font-bold mb-2">Application Not Approved</h2>
              <p className="text-muted-foreground">Unfortunately your application was not approved at this time. Please contact support for more information.</p>
            </CardContent>
          </Card>
        </main>
        <Footer />
      </div>
    );
  }

  const activeJobs = myJobs.filter(j => j.status === "in_progress");
  const completedJobs = myJobs.filter(j => j.status === "resolved" || j.status === "closed");

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1 py-8 px-4 max-w-4xl mx-auto w-full">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-tech-dashboard-title">
              <Wrench className="h-6 w-6" />
              Welcome, {profile.fullName}
            </h1>
            <p className="text-muted-foreground">IT Technician Dashboard</p>
          </div>
          <Badge variant="outline" className="text-green-600 border-green-600">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Approved
          </Badge>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <Card data-testid="stat-tech-available">
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-blue-600">{availableTickets.length}</p>
              <p className="text-xs text-muted-foreground">Available Jobs</p>
            </CardContent>
          </Card>
          <Card data-testid="stat-tech-active">
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-yellow-600">{activeJobs.length}</p>
              <p className="text-xs text-muted-foreground">Active Jobs</p>
            </CardContent>
          </Card>
          <Card data-testid="stat-tech-completed">
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-green-600">{profile.totalJobsCompleted || 0}</p>
              <p className="text-xs text-muted-foreground">Completed</p>
            </CardContent>
          </Card>
          <Card data-testid="stat-tech-rating">
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold flex items-center justify-center gap-1">
                <Star className="h-5 w-5 text-yellow-500" />
                {Number(profile.averageRating) > 0 ? Number(profile.averageRating).toFixed(1) : "N/A"}
              </p>
              <p className="text-xs text-muted-foreground">Rating</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="available" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="available" data-testid="tab-available">
              Available ({availableTickets.length})
            </TabsTrigger>
            <TabsTrigger value="active" data-testid="tab-active">
              Active ({activeJobs.length})
            </TabsTrigger>
            <TabsTrigger value="completed" data-testid="tab-completed">
              Completed ({completedJobs.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="available" className="space-y-3">
            {loadingAvailable ? (
              <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>
            ) : availableTickets.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Briefcase className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-lg font-medium mb-2">No available jobs</h3>
                  <p className="text-muted-foreground">Check back later for new IT service requests</p>
                </CardContent>
              </Card>
            ) : (
              availableTickets.map(ticket => (
                <TicketCard
                  key={ticket.id}
                  ticket={ticket}
                  showAccept
                  onAccept={() => { setAcceptingId(ticket.id); acceptTicket.mutate(ticket.id); }}
                  isAccepting={acceptingId === ticket.id}
                />
              ))
            )}
          </TabsContent>

          <TabsContent value="active" className="space-y-3">
            {loadingJobs ? (
              <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>
            ) : activeJobs.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Timer className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-lg font-medium mb-2">No active jobs</h3>
                  <p className="text-muted-foreground">Accept a job from the Available tab to get started</p>
                </CardContent>
              </Card>
            ) : (
              activeJobs.map(ticket => (
                <TicketCard
                  key={ticket.id}
                  ticket={ticket}
                  showComplete
                  onComplete={() => { setCompletingId(ticket.id); completeTicket.mutate(ticket.id); }}
                  isCompleting={completingId === ticket.id}
                />
              ))
            )}
          </TabsContent>

          <TabsContent value="completed" className="space-y-3">
            {completedJobs.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <CheckCircle2 className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-lg font-medium mb-2">No completed jobs yet</h3>
                  <p className="text-muted-foreground">Your completed work will appear here</p>
                </CardContent>
              </Card>
            ) : (
              completedJobs.map(ticket => (
                <TicketCard key={ticket.id} ticket={ticket} />
              ))
            )}
          </TabsContent>
        </Tabs>
      </main>
      <Footer />
    </div>
  );
}