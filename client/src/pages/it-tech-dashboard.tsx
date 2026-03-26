import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { useLocation } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2,
  Wrench,
  Clock,
  MapPin,
  AlertCircle,
  CheckCircle2,
  Timer,
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
  Navigation,
  LogIn,
  LogOut,
  FileText,
  DollarSign,
  TrendingUp,
  StarIcon,
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

const etaLabels: Record<string, string> = {
  none: "Not started",
  en_route: "On My Way",
  arriving: "Arriving Soon",
  on_site: "On Site",
};

const etaColors: Record<string, string> = {
  none: "bg-gray-100 text-gray-600",
  en_route: "bg-blue-100 text-blue-700",
  arriving: "bg-yellow-100 text-yellow-700",
  on_site: "bg-green-100 text-green-700",
};

function RatingDialog({ ticketId, type, onRated }: { ticketId: string; type: "customer" | "tech"; onRated: () => void }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [review, setReview] = useState("");

  const submitRating = useMutation({
    mutationFn: () => {
      const endpoint = type === "tech"
        ? `/api/it/tech/rate-customer/${ticketId}`
        : `/api/it/tickets/${ticketId}/rate`;
      return apiRequest("POST", endpoint, { rating, review });
    },
    onSuccess: () => {
      toast({ title: "Rating submitted!" });
      setOpen(false);
      onRated();
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" data-testid={`button-rate-${ticketId}`}>
          <Star className="h-3 w-3 mr-1" /> Rate
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rate {type === "tech" ? "Customer" : "Technician"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex items-center gap-2 justify-center">
            {[1, 2, 3, 4, 5].map(n => (
              <button
                key={n}
                type="button"
                onClick={() => setRating(n)}
                className="focus:outline-none"
                data-testid={`star-${n}`}
              >
                <Star className={`h-8 w-8 ${n <= rating ? "fill-yellow-400 text-yellow-400" : "text-gray-300"}`} />
              </button>
            ))}
          </div>
          <Textarea
            placeholder="Write a review (optional)..."
            value={review}
            onChange={(e) => setReview(e.target.value)}
            data-testid="input-review"
          />
          <Button
            className="w-full"
            disabled={rating === 0 || submitRating.isPending}
            onClick={() => submitRating.mutate()}
            data-testid="button-submit-rating"
          >
            {submitRating.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Submit Rating
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function DeliverableDialog({ ticketId, onAdded }: { ticketId: string; onAdded: () => void }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [description, setDescription] = useState("");

  const addDeliverable = useMutation({
    mutationFn: () => apiRequest("POST", `/api/it/tech/deliverables/${ticketId}`, { description, type: "note" }),
    onSuccess: () => {
      toast({ title: "Deliverable added" });
      setDescription("");
      setOpen(false);
      onAdded();
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" data-testid={`button-deliverable-${ticketId}`}>
          <FileText className="h-3 w-3 mr-1" /> Add Proof
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Proof of Work</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <Textarea
            placeholder="Describe what was done (e.g., 'Replaced network switch, tested all ports, speeds confirmed at 1Gbps')"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            data-testid="input-deliverable-desc"
          />
          <Button
            className="w-full"
            disabled={!description.trim() || addDeliverable.isPending}
            onClick={() => addDeliverable.mutate()}
            data-testid="button-submit-deliverable"
          >
            {addDeliverable.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Submit Proof of Work
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ActiveTicketCard({ ticket }: { ticket: ItServiceTicket }) {
  const { toast } = useToast();
  const CategoryIcon = categoryIcons[ticket.category] || Wrench;
  let deliverables: any[] = [];
  try { deliverables = JSON.parse(ticket.deliverables || "[]"); } catch { deliverables = []; }

  const setEta = useMutation({
    mutationFn: (etaStatus: string) => apiRequest("PATCH", `/api/it/tech/eta/${ticket.id}`, { etaStatus }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/it/tech/my-jobs"] });
      toast({ title: "Status updated" });
    },
  });

  const checkIn = useMutation({
    mutationFn: () => apiRequest("POST", `/api/it/tech/checkin/${ticket.id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/it/tech/my-jobs"] });
      toast({ title: "Checked in!", description: "Your time is now being tracked." });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const checkOut = useMutation({
    mutationFn: () => apiRequest("POST", `/api/it/tech/checkout/${ticket.id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/it/tech/my-jobs"] });
      toast({ title: "Checked out!", description: "Hours logged and payment calculated." });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const completeTicket = useMutation({
    mutationFn: () => apiRequest("POST", `/api/it/tech/complete-ticket/${ticket.id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/it/tech/my-jobs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/it/tech/available-tickets"] });
      toast({ title: "Job completed!" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  return (
    <Card data-testid={`active-ticket-${ticket.id}`}>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0 flex-1">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <CategoryIcon className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="text-xs font-mono text-muted-foreground">{ticket.ticketNumber}</span>
                <Badge className={priorityColors[ticket.priority]} variant="secondary">{ticket.priority}</Badge>
                <Badge className={etaColors[ticket.etaStatus || "none"]} variant="secondary">
                  {etaLabels[ticket.etaStatus || "none"]}
                </Badge>
              </div>
              <p className="font-medium">{ticket.title}</p>
              <p className="text-sm text-muted-foreground line-clamp-2">{ticket.description}</p>
              <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                {ticket.siteCity && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{ticket.siteCity}, {ticket.siteState}</span>}
                {ticket.scheduledDate && <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{new Date(ticket.scheduledDate).toLocaleDateString()}</span>}
                {ticket.payRate && <span className="flex items-center gap-1"><DollarSign className="h-3 w-3" />${ticket.payRate}/{ticket.payType === "fixed" ? "flat" : "hr"}</span>}
              </div>
            </div>
          </div>
        </div>

        {(ticket.siteAddress || ticket.contactOnSite) && (
          <div className="text-sm space-y-1 border-t pt-2">
            {ticket.siteAddress && <p className="text-muted-foreground flex items-center gap-1"><MapPin className="h-3 w-3" />{[ticket.siteAddress, ticket.siteCity, ticket.siteState].filter(Boolean).join(", ")}</p>}
            {ticket.contactOnSite && <p className="text-muted-foreground">Contact: {ticket.contactOnSite} {ticket.contactPhone && `• ${ticket.contactPhone}`}</p>}
            {ticket.specialInstructions && <p className="text-muted-foreground italic">{ticket.specialInstructions}</p>}
          </div>
        )}

        {ticket.checkInTime && (
          <div className="border rounded-lg p-3 bg-muted/50 text-sm space-y-1">
            <p className="flex items-center gap-2"><LogIn className="h-4 w-4 text-green-600" /> Checked in: {new Date(ticket.checkInTime).toLocaleString()}</p>
            {ticket.checkOutTime && <p className="flex items-center gap-2"><LogOut className="h-4 w-4 text-blue-600" /> Checked out: {new Date(ticket.checkOutTime).toLocaleString()}</p>}
            {ticket.hoursWorked && <p className="flex items-center gap-2"><Clock className="h-4 w-4" /> Hours: {Number(ticket.hoursWorked).toFixed(2)}</p>}
            {ticket.techPayout && <p className="flex items-center gap-2 font-medium"><DollarSign className="h-4 w-4 text-green-600" /> Your payout: ${Number(ticket.techPayout).toFixed(2)}</p>}
          </div>
        )}

        {deliverables.length > 0 && (
          <div className="border rounded-lg p-3 bg-muted/50">
            <p className="text-xs font-medium mb-2 flex items-center gap-1"><FileText className="h-3 w-3" /> Proof of Work ({deliverables.length})</p>
            {deliverables.map((d: any) => (
              <div key={d.id} className="text-sm text-muted-foreground border-t pt-1 mt-1">
                {d.description} <span className="text-xs">• {new Date(d.addedAt).toLocaleDateString()}</span>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center gap-2 flex-wrap border-t pt-3">
          {!ticket.checkInTime && ticket.etaStatus !== "en_route" && ticket.etaStatus !== "arriving" && (
            <Button size="sm" variant="outline" onClick={() => setEta.mutate("en_route")} disabled={setEta.isPending} data-testid={`button-onmyway-${ticket.id}`}>
              <Navigation className="h-3 w-3 mr-1" /> On My Way
            </Button>
          )}
          {!ticket.checkInTime && (
            <Button size="sm" onClick={() => checkIn.mutate()} disabled={checkIn.isPending} data-testid={`button-checkin-${ticket.id}`}>
              {checkIn.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <LogIn className="h-3 w-3 mr-1" />}
              Check In
            </Button>
          )}
          {ticket.checkInTime && !ticket.checkOutTime && (
            <Button size="sm" variant="secondary" onClick={() => checkOut.mutate()} disabled={checkOut.isPending} data-testid={`button-checkout-${ticket.id}`}>
              {checkOut.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <LogOut className="h-3 w-3 mr-1" />}
              Check Out
            </Button>
          )}
          <DeliverableDialog ticketId={ticket.id} onAdded={() => queryClient.invalidateQueries({ queryKey: ["/api/it/tech/my-jobs"] })} />
          {ticket.checkOutTime && (
            <Button size="sm" onClick={() => completeTicket.mutate()} disabled={completeTicket.isPending} data-testid={`button-complete-${ticket.id}`}>
              {completeTicket.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <CheckCircle2 className="h-3 w-3 mr-1" />}
              Mark Complete
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function AvailableTicketCard({ ticket, onAccept, isAccepting }: { ticket: ItServiceTicket; onAccept: () => void; isAccepting: boolean }) {
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
                <span className="text-xs font-mono text-muted-foreground">{ticket.ticketNumber}</span>
                <Badge className={priorityColors[ticket.priority]} variant="secondary">{ticket.priority}</Badge>
              </div>
              <p className="font-medium">{ticket.title}</p>
              <p className="text-sm text-muted-foreground line-clamp-2">{ticket.description}</p>
              <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground flex-wrap">
                <span className="flex items-center gap-1"><Wrench className="h-3 w-3" />{categoryLabels[ticket.category] || ticket.category}</span>
                {ticket.scheduledDate && <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{new Date(ticket.scheduledDate).toLocaleDateString()} {ticket.scheduledTime}</span>}
                {ticket.siteCity && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{ticket.siteCity}, {ticket.siteState}</span>}
                {ticket.estimatedDuration && <span className="flex items-center gap-1"><Timer className="h-3 w-3" />{ticket.estimatedDuration}</span>}
                {ticket.payRate && <span className="flex items-center gap-1 font-medium text-green-600"><DollarSign className="h-3 w-3" />${ticket.payRate}/{ticket.payType === "fixed" ? "flat" : "hr"}</span>}
              </div>
            </div>
          </div>
          <Button size="sm" onClick={onAccept} disabled={isAccepting} data-testid={`button-accept-${ticket.id}`}>
            {isAccepting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Accept"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function CompletedTicketCard({ ticket }: { ticket: ItServiceTicket }) {
  const CategoryIcon = categoryIcons[ticket.category] || Wrench;
  return (
    <Card data-testid={`completed-ticket-${ticket.id}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0 flex-1">
            <div className="h-10 w-10 rounded-lg bg-green-100 dark:bg-green-900 flex items-center justify-center shrink-0">
              <CategoryIcon className="h-5 w-5 text-green-600" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="text-xs font-mono text-muted-foreground">{ticket.ticketNumber}</span>
                <Badge className={statusColors[ticket.status]} variant="secondary">{ticket.status}</Badge>
                {ticket.customerRating && (
                  <Badge variant="outline" className="flex items-center gap-1">
                    <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                    {ticket.customerRating}/5
                  </Badge>
                )}
              </div>
              <p className="font-medium">{ticket.title}</p>
              <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                {ticket.hoursWorked && <span>{Number(ticket.hoursWorked).toFixed(1)} hrs</span>}
                {ticket.techPayout && <span className="text-green-600 font-medium">${Number(ticket.techPayout).toFixed(2)} earned</span>}
                {ticket.resolvedAt && <span>{new Date(ticket.resolvedAt).toLocaleDateString()}</span>}
              </div>
              {ticket.customerReview && <p className="text-sm text-muted-foreground mt-1 italic">"{ticket.customerReview}"</p>}
            </div>
          </div>
          <div className="flex flex-col gap-1">
            {!ticket.techRating && (
              <RatingDialog ticketId={ticket.id} type="tech" onRated={() => queryClient.invalidateQueries({ queryKey: ["/api/it/tech/my-jobs"] })} />
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function ITTechDashboardPage() {
  const { isAuthenticated, user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [acceptingId, setAcceptingId] = useState<string | null>(null);

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

  const { data: earnings } = useQuery<any>({
    queryKey: ["/api/it/tech/earnings"],
    enabled: isAuthenticated && profile?.applicationStatus === "approved",
  });

  const acceptTicket = useMutation({
    mutationFn: (ticketId: string) => apiRequest("POST", `/api/it/tech/accept-ticket/${ticketId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/it/tech/available-tickets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/it/tech/my-jobs"] });
      toast({ title: "Job accepted!" });
      setAcceptingId(null);
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
      setAcceptingId(null);
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
              <p className="text-muted-foreground mb-2">Hi {profile.fullName}, your application is being reviewed.</p>
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
              <p className="text-muted-foreground">Please contact support for more information.</p>
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
            <CheckCircle2 className="h-3 w-3 mr-1" /> Approved
          </Badge>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
          <Card data-testid="stat-tech-available">
            <CardContent className="p-3 text-center">
              <p className="text-2xl font-bold text-blue-600">{availableTickets.length}</p>
              <p className="text-xs text-muted-foreground">Available</p>
            </CardContent>
          </Card>
          <Card data-testid="stat-tech-active">
            <CardContent className="p-3 text-center">
              <p className="text-2xl font-bold text-yellow-600">{activeJobs.length}</p>
              <p className="text-xs text-muted-foreground">Active</p>
            </CardContent>
          </Card>
          <Card data-testid="stat-tech-completed">
            <CardContent className="p-3 text-center">
              <p className="text-2xl font-bold text-green-600">{profile.totalJobsCompleted || 0}</p>
              <p className="text-xs text-muted-foreground">Completed</p>
            </CardContent>
          </Card>
          <Card data-testid="stat-tech-rating">
            <CardContent className="p-3 text-center">
              <p className="text-2xl font-bold flex items-center justify-center gap-1">
                <Star className="h-4 w-4 text-yellow-500" />
                {Number(profile.averageRating) > 0 ? Number(profile.averageRating).toFixed(1) : "N/A"}
              </p>
              <p className="text-xs text-muted-foreground">Rating</p>
            </CardContent>
          </Card>
          <Card data-testid="stat-tech-earnings">
            <CardContent className="p-3 text-center">
              <p className="text-2xl font-bold text-emerald-600">${Number(profile.totalEarnings || 0).toFixed(0)}</p>
              <p className="text-xs text-muted-foreground">Earned</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="available" className="space-y-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="available" data-testid="tab-available">Available ({availableTickets.length})</TabsTrigger>
            <TabsTrigger value="active" data-testid="tab-active">Active ({activeJobs.length})</TabsTrigger>
            <TabsTrigger value="completed" data-testid="tab-completed">Done ({completedJobs.length})</TabsTrigger>
            <TabsTrigger value="earnings" data-testid="tab-earnings">Earnings</TabsTrigger>
          </TabsList>

          <TabsContent value="available" className="space-y-3">
            {loadingAvailable ? (
              <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>
            ) : availableTickets.length === 0 ? (
              <Card><CardContent className="py-12 text-center">
                <Briefcase className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-medium mb-2">No available jobs</h3>
                <p className="text-muted-foreground">Check back later for new IT service requests</p>
              </CardContent></Card>
            ) : (
              availableTickets.map(ticket => (
                <AvailableTicketCard
                  key={ticket.id}
                  ticket={ticket}
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
              <Card><CardContent className="py-12 text-center">
                <Timer className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-medium mb-2">No active jobs</h3>
                <p className="text-muted-foreground">Accept a job from the Available tab</p>
              </CardContent></Card>
            ) : (
              activeJobs.map(ticket => <ActiveTicketCard key={ticket.id} ticket={ticket} />)
            )}
          </TabsContent>

          <TabsContent value="completed" className="space-y-3">
            {completedJobs.length === 0 ? (
              <Card><CardContent className="py-12 text-center">
                <CheckCircle2 className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-medium mb-2">No completed jobs yet</h3>
                <p className="text-muted-foreground">Your completed work will appear here</p>
              </CardContent></Card>
            ) : (
              completedJobs.map(ticket => <CompletedTicketCard key={ticket.id} ticket={ticket} />)
            )}
          </TabsContent>

          <TabsContent value="earnings" className="space-y-4">
            {earnings ? (
              <>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <Card>
                    <CardContent className="p-4 text-center">
                      <DollarSign className="h-8 w-8 mx-auto mb-2 text-emerald-500" />
                      <p className="text-3xl font-bold text-emerald-600">${Number(earnings.totalEarnings).toFixed(2)}</p>
                      <p className="text-sm text-muted-foreground">Total Earnings</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4 text-center">
                      <Clock className="h-8 w-8 mx-auto mb-2 text-yellow-500" />
                      <p className="text-3xl font-bold text-yellow-600">${Number(earnings.pendingPayout).toFixed(2)}</p>
                      <p className="text-sm text-muted-foreground">Pending Payout</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4 text-center">
                      <TrendingUp className="h-8 w-8 mx-auto mb-2 text-blue-500" />
                      <p className="text-3xl font-bold">{earnings.timelinessScore}%</p>
                      <p className="text-sm text-muted-foreground">Timeliness Score</p>
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardHeader><CardTitle className="text-lg">Performance</CardTitle></CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Total Jobs</span>
                      <span className="font-medium">{earnings.totalJobs}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Average Rating</span>
                      <span className="font-medium flex items-center gap-1">
                        <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                        {Number(earnings.averageRating) > 0 ? Number(earnings.averageRating).toFixed(1) : "N/A"}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Paid Out</span>
                      <span className="font-medium text-green-600">${Number(earnings.paidOut).toFixed(2)}</span>
                    </div>
                  </CardContent>
                </Card>
              </>
            ) : (
              <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>
            )}
          </TabsContent>
        </Tabs>
      </main>
      <Footer />
    </div>
  );
}