import { useState, useEffect, useRef, useCallback } from "react";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
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
  Car,
  XCircle,
  AlertTriangle,
  MapPinned,
  Receipt,
  Upload,
  Trash2,
  Download,
  Settings,
  BadgeCheck,
  ShieldCheck,
  FileCheck,
  Share2,
  PenTool,
} from "lucide-react";
import { ShareMenu } from "@/components/ShareMenu";
import { SignaturePad } from "@/components/SignaturePad";
import { DocumentUpload } from "@/components/DocumentUpload";
import { Alert, AlertDescription } from "@/components/ui/alert";
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

function MileageDialog({ ticketId, onSubmitted }: { ticketId: string; onSubmitted: () => void }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [miles, setMiles] = useState("");

  const submitMileage = useMutation({
    mutationFn: () => apiRequest("POST", `/api/it/tech/mileage/${ticketId}`, { miles: parseFloat(miles) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/it/tech/my-jobs"] });
      toast({ title: "Mileage logged", description: `${miles} miles @ $0.67/mile recorded` });
      setOpen(false);
      setMiles("");
      onSubmitted();
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" data-testid={`button-mileage-${ticketId}`}>
          <Car className="h-3 w-3 mr-1" /> Log Mileage
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Log Travel Mileage</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">Enter one-way driving distance. Mileage is reimbursed at $0.67/mile (IRS standard rate).</p>
        <div className="space-y-3">
          <Input
            type="number"
            placeholder="Miles driven (one way)"
            value={miles}
            onChange={(e) => setMiles(e.target.value)}
            min="0"
            step="0.1"
            data-testid="input-mileage-miles"
          />
          {miles && parseFloat(miles) > 0 && (
            <p className="text-sm font-medium text-green-600">
              Mileage pay: ${(parseFloat(miles) * 0.67).toFixed(2)}
            </p>
          )}
          <Button onClick={() => submitMileage.mutate()} disabled={!miles || parseFloat(miles) <= 0 || submitMileage.isPending} data-testid="button-submit-mileage">
            {submitMileage.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Submit Mileage
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function DelayDialog({ ticketId, onSubmitted }: { ticketId: string; onSubmitted: () => void }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [minutes, setMinutes] = useState("");

  const reportDelay = useMutation({
    mutationFn: () => apiRequest("POST", `/api/it/tech/report-delay/${ticketId}`, { reason, minutes: parseInt(minutes) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/it/tech/my-jobs"] });
      toast({ title: "Delay reported", description: "Company has been notified" });
      setOpen(false);
      setReason("");
      setMinutes("");
      onSubmitted();
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" data-testid={`button-report-delay-${ticketId}`}>
          <AlertTriangle className="h-3 w-3 mr-1" /> Report Delay
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Report On-Site Delay</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">Report unexpected delays (waiting for access, equipment issues, scope change). Delay compensation is calculated at 50% of your hourly rate.</p>
        <div className="space-y-3">
          <Input
            type="number"
            placeholder="Delay duration (minutes)"
            value={minutes}
            onChange={(e) => setMinutes(e.target.value)}
            min="1"
            data-testid="input-delay-minutes"
          />
          <Textarea
            placeholder="Reason for delay (e.g., waiting for server room access, additional scope discovered)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            data-testid="input-delay-reason"
          />
          <Button onClick={() => reportDelay.mutate()} disabled={!reason || !minutes || parseInt(minutes) < 1 || reportDelay.isPending} data-testid="button-submit-delay">
            {reportDelay.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Submit Delay Report
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CancelJobDialog({ ticketId, onCancelled }: { ticketId: string; onCancelled: () => void }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");

  const cancelJob = useMutation({
    mutationFn: () => apiRequest("POST", `/api/it/tickets/${ticketId}/cancel`, { reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/it/tech/my-jobs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/it/tech/available-tickets"] });
      toast({ title: "Job released", description: "The ticket has been returned to the open pool." });
      setOpen(false);
      setReason("");
      onCancelled();
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost" className="text-red-500 hover:text-red-600" data-testid={`button-cancel-job-${ticketId}`}>
          <XCircle className="h-3 w-3 mr-1" /> Release Job
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Release This Job</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">If you can't complete this job (scheduling conflict, can't make it on time, etc.), release it back to the open pool so another tech can pick it up.</p>
        <div className="space-y-3">
          <Textarea
            placeholder="Reason for releasing (e.g., schedule conflict with another ticket, unable to travel)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            data-testid="input-cancel-reason"
          />
          <Button variant="destructive" onClick={() => cancelJob.mutate()} disabled={!reason || cancelJob.isPending} data-testid="button-confirm-cancel">
            {cancelJob.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Release Job
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function useLocationTracking(ticketId: string, isCheckedIn: boolean, isCheckedOut: boolean) {
  const [locationInfo, setLocationInfo] = useState<{
    locationStatus: string;
    distanceMeters: number | null;
    onSite: boolean;
    shouldRemind: boolean;
    hoursCheckedIn: number;
    reminderReason: string | null;
  } | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const active = isCheckedIn && !isCheckedOut;

  const fetchStatusFallback = useCallback(async () => {
    try {
      const resp = await fetch(`/api/it/tech/location-status/${ticketId}`, { credentials: "include" });
      if (resp.ok) {
        const data = await resp.json();
        setLocationInfo({
          locationStatus: data.locationStatus || "unknown",
          distanceMeters: data.lastLocationDistance,
          onSite: data.locationStatus === "on_site",
          shouldRemind: data.hoursCheckedIn > 8 && !data.checkoutReminderSent,
          hoursCheckedIn: data.hoursCheckedIn || 0,
          reminderReason: data.hoursCheckedIn > 8 ? "long_shift" : null,
        });
      }
    } catch {}
  }, [ticketId]);

  const sendPing = useCallback(async () => {
    if (!active) return;
    if (!navigator.geolocation) {
      await fetchStatusFallback();
      return;
    }
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 15000, enableHighAccuracy: true })
      );
      const resp = await fetch(`/api/it/tech/location-ping/${ticketId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        credentials: "include",
      });
      if (resp.ok) {
        const data = await resp.json();
        setLocationInfo(data);
      }
    } catch {
      await fetchStatusFallback();
    }
  }, [ticketId, active, fetchStatusFallback]);

  useEffect(() => {
    if (!active) {
      setLocationInfo(null);
      return;
    }
    sendPing();
    intervalRef.current = setInterval(sendPing, 120000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [active, sendPing]);

  return locationInfo;
}

function LocationStatusBanner({ locationInfo, onCheckout }: {
  locationInfo: { locationStatus: string; distanceMeters: number | null; onSite: boolean; shouldRemind: boolean; hoursCheckedIn: number; reminderReason: string | null } | null;
  onCheckout: () => void;
}) {
  if (!locationInfo) return null;

  const { locationStatus, distanceMeters, hoursCheckedIn, shouldRemind, reminderReason } = locationInfo;

  if (locationStatus === "left_site") {
    return (
      <div data-testid="location-left-site-banner" className="bg-orange-50 dark:bg-orange-950 border border-orange-200 dark:border-orange-800 rounded-lg p-3 flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 text-orange-500 mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-orange-800 dark:text-orange-200">You appear to have left the job site</p>
          <p className="text-xs text-orange-600 dark:text-orange-400 mt-0.5">
            {distanceMeters ? `${distanceMeters}m away from site` : "Away from site"} · {hoursCheckedIn.toFixed(1)}h checked in
          </p>
          {shouldRemind && (
            <p className="text-xs text-orange-700 dark:text-orange-300 font-medium mt-1">
              Don't forget to check out if you're done!
            </p>
          )}
        </div>
        <Button size="sm" variant="outline" className="border-orange-300 text-orange-700 hover:bg-orange-100 shrink-0" onClick={onCheckout} data-testid="btn-checkout-reminder">
          <LogOut className="h-3 w-3 mr-1" /> Check Out
        </Button>
      </div>
    );
  }

  if (hoursCheckedIn > 8 && shouldRemind) {
    return (
      <div data-testid="location-long-shift-banner" className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-3 flex items-start gap-3">
        <Clock className="h-5 w-5 text-blue-500 mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-blue-800 dark:text-blue-200">Long shift reminder</p>
          <p className="text-xs text-blue-600 dark:text-blue-400 mt-0.5">
            You've been checked in for {hoursCheckedIn.toFixed(1)} hours. Remember to check out when done.
          </p>
        </div>
        <Button size="sm" variant="outline" className="border-blue-300 text-blue-700 hover:bg-blue-100 shrink-0" onClick={onCheckout} data-testid="btn-checkout-long-shift">
          <LogOut className="h-3 w-3 mr-1" /> Check Out
        </Button>
      </div>
    );
  }

  if (locationStatus === "on_site") {
    return (
      <div data-testid="location-on-site-badge" className="flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400">
        <MapPinned className="h-3.5 w-3.5" />
        <span>On site{distanceMeters ? ` (${distanceMeters}m)` : ""} · {hoursCheckedIn.toFixed(1)}h</span>
      </div>
    );
  }

  if (locationStatus === "near_site") {
    return (
      <div data-testid="location-near-site-badge" className="flex items-center gap-1.5 text-xs text-yellow-600 dark:text-yellow-400">
        <MapPin className="h-3.5 w-3.5" />
        <span>Near site{distanceMeters ? ` (${distanceMeters}m)` : ""} · {hoursCheckedIn.toFixed(1)}h</span>
      </div>
    );
  }

  return null;
}

function ActiveTicketCard({ ticket }: { ticket: ItServiceTicket }) {
  const { toast } = useToast();
  const [signatureOpen, setSignatureOpen] = useState(false);
  const CategoryIcon = categoryIcons[ticket.category] || Wrench;
  let deliverables: any[] = [];
  try { deliverables = JSON.parse(ticket.deliverables || "[]"); } catch { deliverables = []; }

  const locationInfo = useLocationTracking(
    ticket.id,
    !!ticket.checkInTime,
    !!ticket.checkOutTime
  );

  const setEta = useMutation({
    mutationFn: (etaStatus: string) => apiRequest("PATCH", `/api/it/tech/eta/${ticket.id}`, { etaStatus }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/it/tech/my-jobs"] });
      toast({ title: "Status updated" });
    },
  });

  const checkIn = useMutation({
    mutationFn: async () => {
      let body: Record<string, number> = {};
      try {
        if (navigator.geolocation) {
          const pos = await new Promise<GeolocationPosition>((res, rej) =>
            navigator.geolocation.getCurrentPosition(res, rej, { timeout: 10000, enableHighAccuracy: true })
          );
          body = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        }
      } catch {}
      const resp = await fetch(`/api/it/tech/checkin/${ticket.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        credentials: "include",
      });
      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(text || resp.statusText);
      }
      return resp.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/it/tech/my-jobs"] });
      const locMsg = data?.locationVerified
        ? "GPS verified - you're on site!"
        : data?.distanceMeters != null
          ? `GPS recorded (${Math.round(data.distanceMeters)}m from site)`
          : "GPS not available";
      toast({ title: "Checked in!", description: `Your time is now being tracked. ${locMsg}` });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const checkOut = useMutation({
    mutationFn: () => apiRequest("POST", `/api/it/tech/checkout/${ticket.id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/it/tech/my-jobs"] });
      toast({ title: "Checked out!", description: "Hours logged and payment calculated. Awaiting company approval." });
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

  const captureSignature = useMutation({
    mutationFn: (data: { signatureDataUrl: string; signedName: string }) =>
      apiRequest("POST", `/api/it/tickets/${ticket.id}/signature`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/it/tech/my-jobs"] });
      setSignatureOpen(false);
      toast({ title: "Signature captured!", description: "Customer signature has been saved." });
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
                {(ticket as any).locationVerified && (
                  <Badge className="bg-green-100 text-green-700" variant="secondary">
                    <MapPinned className="h-3 w-3 mr-1" /> GPS Verified
                  </Badge>
                )}
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

        {((ticket as any).mileagePay || (ticket as any).delayCompensation) && (
          <div className="border rounded-lg p-3 bg-blue-50 dark:bg-blue-950 text-sm space-y-1">
            <p className="font-medium text-xs mb-1 flex items-center gap-1"><Receipt className="h-3 w-3" /> Additional Compensation</p>
            {(ticket as any).travelDistance && (
              <p className="flex items-center gap-2"><Car className="h-4 w-4 text-blue-600" /> Mileage: {Number((ticket as any).travelDistance).toFixed(1)} mi × $0.67 = ${Number((ticket as any).mileagePay).toFixed(2)}</p>
            )}
            {(ticket as any).delayMinutes && (
              <p className="flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-orange-500" /> Delay: {(ticket as any).delayMinutes}min — ${Number((ticket as any).delayCompensation).toFixed(2)}</p>
            )}
          </div>
        )}

        {ticket.checkInTime && (
          <div className="border rounded-lg p-3 bg-muted/50 text-sm space-y-1">
            <p className="flex items-center gap-2"><LogIn className="h-4 w-4 text-green-600" /> Checked in: {new Date(ticket.checkInTime).toLocaleString()}</p>
            {(ticket as any).checkInDistance != null && (
              <p className="flex items-center gap-2 text-xs">
                <MapPinned className="h-3 w-3" />
                {(ticket as any).locationVerified
                  ? <span className="text-green-600">On-site verified ({Math.round(Number((ticket as any).checkInDistance))}m from site)</span>
                  : <span className="text-orange-500">Location: {Math.round(Number((ticket as any).checkInDistance))}m from site (not verified — over 500m)</span>
                }
              </p>
            )}
            {ticket.checkOutTime && <p className="flex items-center gap-2"><LogOut className="h-4 w-4 text-blue-600" /> Checked out: {new Date(ticket.checkOutTime).toLocaleString()}</p>}
            {ticket.hoursWorked && <p className="flex items-center gap-2"><Clock className="h-4 w-4" /> Hours: {Number(ticket.hoursWorked).toFixed(2)}</p>}
            {ticket.techPayout && (
              <div className="border-t pt-1 mt-1">
                <p className="flex items-center gap-2 font-medium"><DollarSign className="h-4 w-4 text-green-600" /> Your payout: ${Number(ticket.techPayout).toFixed(2)}</p>
                {(ticket as any).paymentTerms && (ticket as any).paymentTerms !== "instant" && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                    Payment terms: {(ticket as any).paymentTerms === "net7" ? "Net 7" : (ticket as any).paymentTerms === "net14" ? "Net 14" : "Net 30"} days
                    {(ticket as any).platformFeePercent && ` (${(ticket as any).platformFeePercent}% fee)`}
                  </p>
                )}
                {(ticket as any).payoutDate && (
                  <p className="text-xs text-blue-600 flex items-center gap-1 mt-0.5">
                    <Clock className="h-3 w-3" /> Payout: {new Date((ticket as any).payoutDate).toLocaleDateString()}
                  </p>
                )}
                {(ticket as any).overageAmount && parseFloat((ticket as any).overageAmount) > 0 && (
                  <p className="text-xs text-orange-500 flex items-center gap-1 mt-0.5">
                    <AlertCircle className="h-3 w-3" /> Overage: ${Number((ticket as any).overageAmount).toFixed(2)}
                    ({(ticket as any).overageApproved ? "approved" : "pending approval"})
                  </p>
                )}
                {(ticket as any).companyApproval === "pending" && (
                  <p className="text-xs text-orange-500 flex items-center gap-1 mt-1"><Clock className="h-3 w-3" /> Awaiting company approval</p>
                )}
                {(ticket as any).companyApproval === "approved" && (
                  <p className="text-xs text-green-600 flex items-center gap-1 mt-1"><CheckCircle2 className="h-3 w-3" /> Company approved</p>
                )}
                {(ticket as any).companyApproval === "disputed" && (
                  <p className="text-xs text-red-500 flex items-center gap-1 mt-1"><AlertCircle className="h-3 w-3" /> Disputed: {(ticket as any).companyApprovalNotes}</p>
                )}
              </div>
            )}
          </div>
        )}

        {ticket.checkInTime && !ticket.checkOutTime && (
          <LocationStatusBanner locationInfo={locationInfo} onCheckout={() => checkOut.mutate()} />
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
              Check In (GPS)
            </Button>
          )}
          {!ticket.checkOutTime && (
            <MileageDialog ticketId={ticket.id} onSubmitted={() => {}} />
          )}
          {ticket.checkInTime && !ticket.checkOutTime && (
            <>
              <DelayDialog ticketId={ticket.id} onSubmitted={() => {}} />
              <Button size="sm" variant="secondary" onClick={() => checkOut.mutate()} disabled={checkOut.isPending} data-testid={`button-checkout-${ticket.id}`}>
                {checkOut.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <LogOut className="h-3 w-3 mr-1" />}
                Check Out
              </Button>
            </>
          )}
          <DeliverableDialog ticketId={ticket.id} onAdded={() => queryClient.invalidateQueries({ queryKey: ["/api/it/tech/my-jobs"] })} />
          {ticket.checkInTime && !(ticket as any).customerSignatureUrl && (
            <Button size="sm" variant="outline" onClick={() => setSignatureOpen(true)} data-testid={`button-get-signature-${ticket.id}`}>
              <PenTool className="h-3 w-3 mr-1" /> Get Signature
            </Button>
          )}
          {ticket.checkOutTime && (
            <Button size="sm" onClick={() => completeTicket.mutate()} disabled={completeTicket.isPending} data-testid={`button-complete-${ticket.id}`}>
              {completeTicket.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <CheckCircle2 className="h-3 w-3 mr-1" />}
              Mark Complete
            </Button>
          )}
          {!ticket.checkInTime && (
            <CancelJobDialog ticketId={ticket.id} onCancelled={() => {}} />
          )}
        </div>

        {(ticket as any).customerSignatureUrl && (
          <div className="border rounded-lg p-3 bg-green-50 dark:bg-green-950 text-sm">
            <p className="font-medium text-xs mb-2 flex items-center gap-1 text-green-700">
              <CheckCircle2 className="h-3 w-3" /> Customer Signature Captured
            </p>
            <div className="flex items-center gap-3">
              <img
                src={(ticket as any).customerSignatureUrl}
                alt="Customer Signature"
                className="h-12 border rounded bg-white"
                data-testid={`img-signature-${ticket.id}`}
              />
              <div>
                <p className="font-medium">{(ticket as any).customerSignedName}</p>
                {(ticket as any).customerSignedAt && (
                  <p className="text-xs text-muted-foreground">
                    Signed: {new Date((ticket as any).customerSignedAt).toLocaleString()}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        <SignaturePad
          open={signatureOpen}
          onOpenChange={setSignatureOpen}
          onSubmit={(data) => captureSignature.mutate(data)}
          title="Customer Signature"
          description="Have the customer sign below to confirm work completion on this service ticket."
          isPending={captureSignature.isPending}
        />
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
          <div className="flex flex-col gap-1 items-end">
            <ShareMenu
              title={`IT Service Job: ${ticket.title}`}
              text={`IT Service job available on CareHub!\n${ticket.title}\nCategory: ${categoryLabels[ticket.category] || ticket.category}${ticket.siteCity ? `\nLocation: ${ticket.siteCity}, ${ticket.siteState}` : ""}${ticket.payRate ? `\nPay: $${ticket.payRate}/${ticket.payType === "fixed" ? "flat" : "hr"}` : ""}\n\nApply as an IT tech to accept jobs!`}
              url="/it-tech/apply"
              size="icon"
              variant="ghost"
              testId={`button-share-ticket-${ticket.id}`}
            />
            <Button size="sm" onClick={onAccept} disabled={isAccepting} data-testid={`button-accept-${ticket.id}`}>
              {isAccepting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Accept"}
            </Button>
          </div>
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

function ContractorOnboardingSection() {
  const { toast } = useToast();
  const [ssnLast4, setSsnLast4] = useState("");
  const [taxClassification, setTaxClassification] = useState("individual");
  const [businessName, setBusinessName] = useState("");
  const [taxAddress, setTaxAddress] = useState("");
  const [taxCity, setTaxCity] = useState("");
  const [taxState, setTaxState] = useState("");
  const [taxZip, setTaxZip] = useState("");
  const [fullLegalName, setFullLegalName] = useState("");
  const [showAgreement, setShowAgreement] = useState(false);

  const { data: contractorStatus, isLoading } = useQuery<any>({
    queryKey: ["/api/it/tech/contractor-status"],
  });

  const { data: agreementText } = useQuery<any>({
    queryKey: ["/api/it/tech/ic-agreement-text"],
    enabled: showAgreement,
  });

  const onboardMutation = useMutation({
    mutationFn: () => fetch("/api/it/tech/contractor-onboarding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ ssnLast4, taxClassification, businessName, taxAddress, taxCity, taxState, taxZip }),
    }).then(async r => { if (!r.ok) throw new Error((await r.json()).message); return r.json(); }),
    onSuccess: () => {
      toast({ title: "Tax information saved" });
      queryClient.invalidateQueries({ queryKey: ["/api/it/tech/contractor-status"] });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const signAgreementMutation = useMutation({
    mutationFn: () => fetch("/api/it/tech/sign-ic-agreement", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ fullLegalName }),
    }).then(async r => { if (!r.ok) throw new Error((await r.json()).message); return r.json(); }),
    onSuccess: () => {
      toast({ title: "Agreement signed successfully" });
      setShowAgreement(false);
      queryClient.invalidateQueries({ queryKey: ["/api/it/tech/contractor-status"] });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  if (isLoading) return <div className="flex justify-center p-4"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  const isOnboarded = contractorStatus?.isContractorOnboarded;
  const hasSigned = !!contractorStatus?.icAgreementSignedAt;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" /> Independent Contractor Agreement
          </CardTitle>
        </CardHeader>
        <CardContent>
          {hasSigned ? (
            <div className="flex items-center gap-2 text-green-600" data-testid="text-ic-signed">
              <CheckCircle2 className="h-5 w-5" />
              <span>Signed on {new Date(contractorStatus.icAgreementSignedAt).toLocaleDateString()}</span>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                You must sign the Independent Contractor Agreement before receiving payouts. This confirms your status as a 1099 independent contractor.
              </p>
              {!showAgreement ? (
                <Button onClick={() => setShowAgreement(true)} data-testid="button-view-ic-agreement">
                  <FileText className="h-4 w-4 mr-2" /> View & Sign Agreement
                </Button>
              ) : (
                <div className="space-y-3">
                  <div className="max-h-60 overflow-y-auto border rounded-lg p-4 text-xs whitespace-pre-wrap bg-muted/30" data-testid="text-ic-agreement-content">
                    {agreementText?.content || "Loading..."}
                  </div>
                  <div>
                    <Label>Full Legal Name (Digital Signature)</Label>
                    <Input
                      value={fullLegalName}
                      onChange={(e) => setFullLegalName(e.target.value)}
                      placeholder="Type your full legal name"
                      data-testid="input-legal-name"
                    />
                  </div>
                  <Button
                    className="w-full"
                    disabled={fullLegalName.trim().length < 2 || signAgreementMutation.isPending}
                    onClick={() => signAgreementMutation.mutate()}
                    data-testid="button-sign-ic-agreement"
                  >
                    {signAgreementMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Sign Agreement
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <FileCheck className="h-5 w-5" /> Tax Information (W-9)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isOnboarded ? (
            <div className="space-y-2" data-testid="text-tax-info-complete">
              <div className="flex items-center gap-2 text-green-600 mb-3">
                <CheckCircle2 className="h-5 w-5" />
                <span>Tax information on file</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-muted-foreground">SSN:</span>
                  <span className="ml-2 font-medium">{contractorStatus.ssnLast4}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Classification:</span>
                  <span className="ml-2 font-medium capitalize">{contractorStatus.taxClassification?.replace("_", " ")}</span>
                </div>
                {contractorStatus.businessName && (
                  <div className="col-span-2">
                    <span className="text-muted-foreground">Business:</span>
                    <span className="ml-2 font-medium">{contractorStatus.businessName}</span>
                  </div>
                )}
                {contractorStatus.taxAddress && (
                  <div className="col-span-2">
                    <span className="text-muted-foreground">Address:</span>
                    <span className="ml-2 font-medium">{contractorStatus.taxAddress}, {contractorStatus.taxCity}, {contractorStatus.taxState} {contractorStatus.taxZip}</span>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                We need your tax information to issue 1099-NEC forms for earnings over $600/year. This is required by the IRS for all independent contractors.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Last 4 of SSN</Label>
                  <Input
                    value={ssnLast4}
                    onChange={(e) => setSsnLast4(e.target.value.replace(/\D/g, "").slice(0, 4))}
                    placeholder="1234"
                    maxLength={4}
                    data-testid="input-ssn-last4"
                  />
                </div>
                <div>
                  <Label>Tax Classification</Label>
                  <Select value={taxClassification} onValueChange={setTaxClassification}>
                    <SelectTrigger data-testid="select-tax-classification">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="individual">Individual</SelectItem>
                      <SelectItem value="sole_proprietor">Sole Proprietor</SelectItem>
                      <SelectItem value="llc">LLC</SelectItem>
                      <SelectItem value="corporation">Corporation</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {(taxClassification === "llc" || taxClassification === "corporation" || taxClassification === "sole_proprietor") && (
                <div>
                  <Label>Business Name</Label>
                  <Input value={businessName} onChange={(e) => setBusinessName(e.target.value)} placeholder="Business name" data-testid="input-business-name" />
                </div>
              )}
              <div>
                <Label>Tax Address</Label>
                <Input value={taxAddress} onChange={(e) => setTaxAddress(e.target.value)} placeholder="Street address" data-testid="input-tax-address" />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label>City</Label>
                  <Input value={taxCity} onChange={(e) => setTaxCity(e.target.value)} placeholder="City" data-testid="input-tax-city" />
                </div>
                <div>
                  <Label>State</Label>
                  <Input value={taxState} onChange={(e) => setTaxState(e.target.value)} placeholder="IL" maxLength={2} data-testid="input-tax-state" />
                </div>
                <div>
                  <Label>ZIP</Label>
                  <Input value={taxZip} onChange={(e) => setTaxZip(e.target.value)} placeholder="60601" data-testid="input-tax-zip" />
                </div>
              </div>
              <Button
                className="w-full"
                disabled={ssnLast4.length !== 4 || onboardMutation.isPending}
                onClick={() => onboardMutation.mutate()}
                data-testid="button-save-tax-info"
              >
                {onboardMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Save Tax Information
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function CertificationUploadsSection() {
  const { toast } = useToast();
  const [certName, setCertName] = useState("");
  const [certIssuer, setCertIssuer] = useState("");
  const [certExpiry, setCertExpiry] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const { data: contractorStatus, isLoading } = useQuery<any>({
    queryKey: ["/api/it/tech/contractor-status"],
  });

  const uploadMutation = useMutation({
    mutationFn: () => {
      const formData = new FormData();
      if (selectedFile) formData.append("document", selectedFile);
      formData.append("certName", certName);
      formData.append("certIssuer", certIssuer);
      if (certExpiry) formData.append("certExpiry", certExpiry);
      return fetch("/api/it/tech/certifications/upload", {
        method: "POST",
        credentials: "include",
        body: formData,
      }).then(async r => { if (!r.ok) throw new Error((await r.json()).message); return r.json(); });
    },
    onSuccess: () => {
      toast({ title: "Certification uploaded" });
      setCertName("");
      setCertIssuer("");
      setCertExpiry("");
      setSelectedFile(null);
      queryClient.invalidateQueries({ queryKey: ["/api/it/tech/contractor-status"] });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (certId: string) => fetch(`/api/it/tech/certifications/${certId}`, {
      method: "DELETE",
      credentials: "include",
    }).then(async r => { if (!r.ok) throw new Error((await r.json()).message); return r.json(); }),
    onSuccess: () => {
      toast({ title: "Certification removed" });
      queryClient.invalidateQueries({ queryKey: ["/api/it/tech/contractor-status"] });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  if (isLoading) return <div className="flex justify-center p-4"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  const docs = (contractorStatus?.certificationDocs as any[]) || [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <BadgeCheck className="h-5 w-5" /> Certification Documents
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Upload your certification documents (PDF or images) so companies can verify your qualifications. Verified certs appear with a checkmark.
        </p>

        {docs.length > 0 && (
          <div className="space-y-2">
            {docs.map((doc: any) => (
              <div key={doc.id} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-2">
                  {doc.verified ? (
                    <BadgeCheck className="h-4 w-4 text-green-600" />
                  ) : (
                    <Clock className="h-4 w-4 text-yellow-500" />
                  )}
                  <div>
                    <p className="font-medium text-sm">{doc.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {doc.issuer && `${doc.issuer} • `}
                      {doc.expiry ? `Expires ${doc.expiry}` : "No expiry"}
                      {doc.verified && " • Verified"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <a href={doc.filePath} target="_blank" rel="noopener noreferrer">
                    <Button size="sm" variant="ghost"><Download className="h-3 w-3" /></Button>
                  </a>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-red-500"
                    onClick={() => deleteMutation.mutate(doc.id)}
                    disabled={deleteMutation.isPending}
                    data-testid={`button-delete-cert-${doc.id}`}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="border-t pt-4 space-y-3">
          <h4 className="font-medium text-sm">Upload New Certification</h4>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Certification Name</Label>
              <Input value={certName} onChange={(e) => setCertName(e.target.value)} placeholder="e.g., CompTIA A+" data-testid="input-cert-name" />
            </div>
            <div>
              <Label>Issuing Organization</Label>
              <Input value={certIssuer} onChange={(e) => setCertIssuer(e.target.value)} placeholder="e.g., CompTIA" data-testid="input-cert-issuer" />
            </div>
          </div>
          <div>
            <Label>Expiry Date (optional)</Label>
            <Input type="date" value={certExpiry} onChange={(e) => setCertExpiry(e.target.value)} data-testid="input-cert-expiry" />
          </div>
          <div>
            <Label>Document (PDF or Image)</Label>
            <Input
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.webp"
              onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
              data-testid="input-cert-file"
            />
          </div>
          <Button
            className="w-full"
            disabled={!certName.trim() || !selectedFile || uploadMutation.isPending}
            onClick={() => uploadMutation.mutate()}
            data-testid="button-upload-cert"
          >
            {uploadMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
            Upload Certification
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function TaxFormsSection() {
  const { toast } = useToast();

  const { data: taxYears, isLoading } = useQuery<any>({
    queryKey: ["/api/it/tech/tax-years"],
  });

  const [selectedYear, setSelectedYear] = useState<number | null>(null);

  const { data: taxData, isLoading: loadingTax } = useQuery<any>({
    queryKey: ["/api/it/tech/1099", selectedYear],
    enabled: !!selectedYear,
  });

  if (isLoading) return <div className="flex justify-center p-4"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  const years = taxYears?.years || [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Receipt className="h-5 w-5" /> Tax Forms (1099-NEC)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {years.length === 0 ? (
          <p className="text-sm text-muted-foreground">No completed jobs yet. Tax forms will appear here after you complete paid work.</p>
        ) : (
          <>
            <div className="flex gap-2 flex-wrap">
              {years.map((y: number) => (
                <Button
                  key={y}
                  size="sm"
                  variant={selectedYear === y ? "default" : "outline"}
                  onClick={() => setSelectedYear(y)}
                  data-testid={`button-tax-year-${y}`}
                >
                  {y}
                </Button>
              ))}
            </div>

            {selectedYear && (
              <div>
                {loadingTax ? (
                  <div className="flex justify-center p-4"><Loader2 className="h-6 w-6 animate-spin" /></div>
                ) : taxData ? (
                  <div className="space-y-3" data-testid="text-1099-data">
                    <div className={`p-3 rounded-lg ${taxData.requiresForm ? "bg-amber-50 dark:bg-amber-950 border-amber-200" : "bg-gray-50 dark:bg-gray-900"}`}>
                      <p className="text-sm font-medium">
                        {taxData.requiresForm ? "1099-NEC Required" : "1099-NEC Not Required (Under $600)"}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">{taxData.message}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div className="p-3 border rounded-lg">
                        <p className="text-muted-foreground text-xs">Box 1 - Nonemployee Compensation</p>
                        <p className="text-xl font-bold text-emerald-600" data-testid="text-1099-amount">${taxData.box1_nonemployeeCompensation}</p>
                      </div>
                      <div className="p-3 border rounded-lg">
                        <p className="text-muted-foreground text-xs">Total Jobs</p>
                        <p className="text-xl font-bold">{taxData.totalJobs}</p>
                      </div>
                    </div>
                    <div className="p-3 border rounded-lg text-sm">
                      <p className="font-medium mb-1">Recipient</p>
                      <p>{taxData.recipient.name}</p>
                      <p>SSN: XXX-XX-{taxData.recipient.ssnLast4}</p>
                      {taxData.recipient.address && <p>{taxData.recipient.address}, {taxData.recipient.city}, {taxData.recipient.state} {taxData.recipient.zip}</p>}
                    </div>
                  </div>
                ) : null}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function PaymentHistorySection() {
  const { data: payHistory, isLoading } = useQuery<any>({
    queryKey: ["/api/it/tech/payment-history"],
  });

  if (isLoading) return <div className="flex justify-center p-4"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  if (!payHistory || !payHistory.payments?.length) return null;

  const termLabels: Record<string, string> = { instant: "Instant", net7: "Net 7", net14: "Net 14", net30: "Net 30" };
  const statusColors: Record<string, string> = {
    pending: "text-yellow-600",
    scheduled: "text-blue-600",
    processing: "text-green-600",
    completed: "text-green-600",
    disputed: "text-red-600",
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <DollarSign className="h-5 w-5" /> Payment History
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="text-center p-2 bg-emerald-50 dark:bg-emerald-950 rounded-lg">
            <p className="text-lg font-bold text-emerald-600">${payHistory.totalEarned}</p>
            <p className="text-xs text-muted-foreground">Total Earned</p>
          </div>
          <div className="text-center p-2 bg-yellow-50 dark:bg-yellow-950 rounded-lg">
            <p className="text-lg font-bold text-yellow-600">${payHistory.pendingPayout}</p>
            <p className="text-xs text-muted-foreground">Pending</p>
          </div>
          <div className="text-center p-2 bg-green-50 dark:bg-green-950 rounded-lg">
            <p className="text-lg font-bold text-green-600">${payHistory.completedPayout}</p>
            <p className="text-xs text-muted-foreground">Paid Out</p>
          </div>
        </div>
        <div className="space-y-2">
          {payHistory.payments.map((p: any) => (
            <div key={p.id} className="flex items-center justify-between p-2 border rounded-lg text-sm">
              <div>
                <p className="font-medium">{p.ticketNumber}: {p.title}</p>
                <p className="text-xs text-muted-foreground">
                  {p.hoursWorked && `${Number(p.hoursWorked).toFixed(1)}h`}
                  {p.paymentTerms && ` • ${termLabels[p.paymentTerms] || p.paymentTerms}`}
                  {p.payoutDate && ` • Due ${new Date(p.payoutDate).toLocaleDateString()}`}
                </p>
                {p.overageAmount && parseFloat(p.overageAmount) > 0 && (
                  <p className="text-xs text-orange-500">+${Number(p.overageAmount).toFixed(2)} overage ({p.overageApproved ? "approved" : "pending"})</p>
                )}
              </div>
              <div className="text-right">
                <p className="font-bold text-green-600">${Number(p.techPayout).toFixed(2)}</p>
                <p className={`text-xs ${statusColors[p.paymentStatus] || "text-gray-500"}`}>{p.paymentStatus}</p>
              </div>
            </div>
          ))}
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

        {profile.accountStatus && profile.accountStatus !== "active" && (
          <Alert variant="destructive" className="mb-4" data-testid="alert-account-status">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              {profile.accountStatus === "on_hold" && (
                <span>Your account is <strong>on hold</strong> pending admin review. You cannot accept new tickets until the review is complete.
                  {profile.suspensionReason && <> Reason: {profile.suspensionReason}</>}
                </span>
              )}
              {profile.accountStatus === "warning" && (
                <span>Your account has received a <strong>warning</strong>. Further complaints may result in suspension.
                  {profile.suspensionReason && <> Reason: {profile.suspensionReason}</>}
                </span>
              )}
              {profile.accountStatus === "suspended" && (
                <span>Your account is <strong>suspended</strong>.
                  {profile.suspendedUntil && <> Suspension ends: {new Date(profile.suspendedUntil).toLocaleDateString()}.</>}
                  {profile.suspensionReason && <> Reason: {profile.suspensionReason}</>}
                  {" "}Please contact support if you believe this is an error.
                </span>
              )}
              {profile.accountStatus === "banned" && (
                <span>Your account has been <strong>permanently deactivated</strong>.
                  {profile.banReason && <> Reason: {profile.banReason}</>}
                </span>
              )}
            </AlertDescription>
          </Alert>
        )}

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
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="available" data-testid="tab-available">Available ({availableTickets.length})</TabsTrigger>
            <TabsTrigger value="active" data-testid="tab-active">Active ({activeJobs.length})</TabsTrigger>
            <TabsTrigger value="completed" data-testid="tab-completed">Done ({completedJobs.length})</TabsTrigger>
            <TabsTrigger value="earnings" data-testid="tab-earnings">Earnings</TabsTrigger>
            <TabsTrigger value="settings" data-testid="tab-settings">Settings</TabsTrigger>
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

                <PaymentHistorySection />

                <TaxFormsSection />
              </>
            ) : (
              <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>
            )}
          </TabsContent>

          <TabsContent value="settings" className="space-y-4">
            <ContractorOnboardingSection />
            <CertificationUploadsSection />
            <DocumentUpload
              relatedEntityType="general"
              allowedTypes={["signed_agreement", "signed_contract", "ic_agreement", "w9_form", "certification", "insurance_doc", "other"]}
            />
          </TabsContent>
        </Tabs>
      </main>
      <Footer />
    </div>
  );
}