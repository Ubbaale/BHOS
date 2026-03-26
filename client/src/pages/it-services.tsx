import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/lib/auth";
import { useLocation } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
  Plus,
  Ticket,
  Clock,
  MapPin,
  AlertCircle,
  CheckCircle2,
  Timer,
  XCircle,
  ArrowLeft,
  Send,
  Monitor,
  Wrench,
  Wifi,
  Printer,
  Shield,
  Phone,
  Mail,
  HardDrive,
  Server,
  ChevronRight,
  Building2,
  LogIn,
} from "lucide-react";
import type { ItServiceTicket, ItTicketNote } from "@shared/schema";

const ticketSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().min(1, "Description is required"),
  category: z.enum(["network", "hardware", "software", "printer", "ehr_system", "security", "phone_system", "email", "backup", "general"]).default("general"),
  priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
  scheduledDate: z.string().optional(),
  scheduledTime: z.string().optional(),
  estimatedDuration: z.enum(["30min", "1hr", "2hr", "4hr", "full_day"]).optional(),
  siteAddress: z.string().optional(),
  siteCity: z.string().optional(),
  siteState: z.string().optional(),
  siteZipCode: z.string().optional(),
  contactOnSite: z.string().optional(),
  contactPhone: z.string().optional(),
  specialInstructions: z.string().optional(),
  equipmentNeeded: z.string().optional(),
});

const categoryIcons: Record<string, typeof Monitor> = {
  network: Wifi,
  hardware: HardDrive,
  software: Monitor,
  printer: Printer,
  ehr_system: Server,
  security: Shield,
  phone_system: Phone,
  email: Mail,
  backup: HardDrive,
  general: Wrench,
};

const categoryLabels: Record<string, string> = {
  network: "Network / Wi-Fi",
  hardware: "Hardware",
  software: "Software",
  printer: "Printer / Scanner",
  ehr_system: "EHR System",
  security: "Security",
  phone_system: "Phone System",
  email: "Email",
  backup: "Backup / Recovery",
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

const statusIcons: Record<string, typeof AlertCircle> = {
  open: AlertCircle,
  in_progress: Timer,
  resolved: CheckCircle2,
  closed: XCircle,
};

function CreateTicketDialog({ onCreated }: { onCreated: () => void }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const form = useForm<z.infer<typeof ticketSchema>>({
    resolver: zodResolver(ticketSchema),
    defaultValues: {
      title: "",
      description: "",
      category: "general",
      priority: "medium",
      scheduledDate: "",
      scheduledTime: "",
      siteAddress: "",
      siteCity: "",
      siteState: "",
      siteZipCode: "",
      contactOnSite: "",
      contactPhone: "",
      specialInstructions: "",
      equipmentNeeded: "",
    },
  });

  const createTicket = useMutation({
    mutationFn: (data: z.infer<typeof ticketSchema>) =>
      apiRequest("POST", "/api/it/tickets", data),
    onSuccess: () => {
      toast({ title: "Ticket submitted!", description: "Your IT service request has been created." });
      queryClient.invalidateQueries({ queryKey: ["/api/it/tickets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/it/tickets/stats/summary"] });
      form.reset();
      setOpen(false);
      onCreated();
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Failed to create ticket", variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button data-testid="button-new-ticket">
          <Plus className="mr-2 h-4 w-4" />
          New Ticket
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Ticket className="h-5 w-5" />
            Submit IT Service Request
          </DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((data) => createTicket.mutate(data))} className="space-y-4">
            <FormField control={form.control} name="title" render={({ field }) => (
              <FormItem>
                <FormLabel>Title *</FormLabel>
                <FormControl><Input {...field} placeholder="e.g. Wi-Fi not working in exam room 3" data-testid="input-ticket-title" /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="description" render={({ field }) => (
              <FormItem>
                <FormLabel>Description *</FormLabel>
                <FormControl><Textarea {...field} placeholder="Describe the issue in detail..." rows={3} data-testid="input-ticket-description" /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField control={form.control} name="category" render={({ field }) => (
                <FormItem>
                  <FormLabel>Category</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl><SelectTrigger data-testid="select-ticket-category"><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      {Object.entries(categoryLabels).map(([key, label]) => (
                        <SelectItem key={key} value={key}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="priority" render={({ field }) => (
                <FormItem>
                  <FormLabel>Priority</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl><SelectTrigger data-testid="select-ticket-priority"><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <div className="border rounded-lg p-4 space-y-4">
              <h4 className="font-medium flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Dispatch Details
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField control={form.control} name="scheduledDate" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Preferred Date</FormLabel>
                    <FormControl><Input {...field} type="date" data-testid="input-ticket-date" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="scheduledTime" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Preferred Time</FormLabel>
                    <FormControl><Input {...field} type="time" data-testid="input-ticket-time" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="estimatedDuration" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Estimated Duration</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || ""}>
                      <FormControl><SelectTrigger data-testid="select-ticket-duration"><SelectValue placeholder="Select duration" /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="30min">30 minutes</SelectItem>
                        <SelectItem value="1hr">1 hour</SelectItem>
                        <SelectItem value="2hr">2 hours</SelectItem>
                        <SelectItem value="4hr">4 hours</SelectItem>
                        <SelectItem value="full_day">Full day</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
            </div>

            <div className="border rounded-lg p-4 space-y-4">
              <h4 className="font-medium flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                Site Location
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField control={form.control} name="siteAddress" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Site Address</FormLabel>
                    <FormControl><Input {...field} placeholder="123 Clinic Dr" data-testid="input-ticket-address" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="siteCity" render={({ field }) => (
                  <FormItem>
                    <FormLabel>City</FormLabel>
                    <FormControl><Input {...field} placeholder="City" data-testid="input-ticket-city" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="siteState" render={({ field }) => (
                  <FormItem>
                    <FormLabel>State</FormLabel>
                    <FormControl><Input {...field} placeholder="State" data-testid="input-ticket-state" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="siteZipCode" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Zip Code</FormLabel>
                    <FormControl><Input {...field} placeholder="12345" data-testid="input-ticket-zip" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
            </div>

            <div className="border rounded-lg p-4 space-y-4">
              <h4 className="font-medium">On-Site Contact & Instructions</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField control={form.control} name="contactOnSite" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contact Person</FormLabel>
                    <FormControl><Input {...field} placeholder="Name" data-testid="input-ticket-contact" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="contactPhone" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contact Phone</FormLabel>
                    <FormControl><Input {...field} placeholder="(555) 123-4567" data-testid="input-ticket-contact-phone" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <FormField control={form.control} name="specialInstructions" render={({ field }) => (
                <FormItem>
                  <FormLabel>Special Instructions</FormLabel>
                  <FormControl><Textarea {...field} placeholder="e.g. Check in at front desk, badge required..." rows={2} data-testid="input-ticket-instructions" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="equipmentNeeded" render={({ field }) => (
                <FormItem>
                  <FormLabel>Equipment Needed</FormLabel>
                  <FormControl><Input {...field} placeholder="e.g. Ethernet cables, replacement router" data-testid="input-ticket-equipment" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <Button type="submit" className="w-full" disabled={createTicket.isPending} data-testid="button-submit-ticket">
              {createTicket.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Submitting...</> : "Submit Ticket"}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function TicketDetail({ ticketId, onBack }: { ticketId: string; onBack: () => void }) {
  const { toast } = useToast();
  const [noteContent, setNoteContent] = useState("");

  const { data, isLoading } = useQuery<{ ticket: ItServiceTicket; notes: ItTicketNote[] }>({
    queryKey: ["/api/it/tickets", ticketId],
  });

  const addNote = useMutation({
    mutationFn: (content: string) =>
      apiRequest("POST", `/api/it/tickets/${ticketId}/notes`, { content }),
    onSuccess: () => {
      setNoteContent("");
      queryClient.invalidateQueries({ queryKey: ["/api/it/tickets", ticketId] });
      toast({ title: "Note added" });
    },
  });

  const updateStatus = useMutation({
    mutationFn: (status: string) =>
      apiRequest("PATCH", `/api/it/tickets/${ticketId}`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/it/tickets", ticketId] });
      queryClient.invalidateQueries({ queryKey: ["/api/it/tickets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/it/tickets/stats/summary"] });
      toast({ title: "Status updated" });
    },
  });

  if (isLoading) return <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  if (!data) return <Alert><AlertDescription>Ticket not found</AlertDescription></Alert>;

  const { ticket, notes } = data;
  const StatusIcon = statusIcons[ticket.status] || AlertCircle;
  const CategoryIcon = categoryIcons[ticket.category] || Wrench;

  return (
    <div className="space-y-4">
      <Button variant="ghost" onClick={onBack} data-testid="button-back-tickets">
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Tickets
      </Button>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm text-muted-foreground font-mono">{ticket.ticketNumber}</span>
                <Badge className={priorityColors[ticket.priority]} variant="secondary">
                  {ticket.priority}
                </Badge>
                <Badge className={statusColors[ticket.status]} variant="secondary">
                  <StatusIcon className="h-3 w-3 mr-1" />
                  {ticket.status.replace("_", " ")}
                </Badge>
              </div>
              <CardTitle className="flex items-center gap-2">
                <CategoryIcon className="h-5 w-5" />
                {ticket.title}
              </CardTitle>
              <CardDescription className="mt-1">
                {categoryLabels[ticket.category] || ticket.category}
              </CardDescription>
            </div>
            <div className="flex gap-2">
              {ticket.status === "open" && (
                <Button size="sm" variant="outline" onClick={() => updateStatus.mutate("closed")} data-testid="button-close-ticket">
                  Close
                </Button>
              )}
              {ticket.status === "resolved" && (
                <Button size="sm" variant="outline" onClick={() => updateStatus.mutate("closed")} data-testid="button-close-ticket">
                  Close
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h4 className="text-sm font-medium text-muted-foreground mb-1">Description</h4>
            <p>{ticket.description}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {ticket.scheduledDate && (
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-1">Scheduled</h4>
                <p className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  {new Date(ticket.scheduledDate).toLocaleDateString()}
                  {ticket.scheduledTime && ` at ${ticket.scheduledTime}`}
                </p>
              </div>
            )}
            {ticket.estimatedDuration && (
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-1">Duration</h4>
                <p>{ticket.estimatedDuration}</p>
              </div>
            )}
            {ticket.siteAddress && (
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-1">Location</h4>
                <p className="flex items-center gap-1">
                  <MapPin className="h-4 w-4" />
                  {[ticket.siteAddress, ticket.siteCity, ticket.siteState, ticket.siteZipCode].filter(Boolean).join(", ")}
                </p>
              </div>
            )}
            {ticket.contactOnSite && (
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-1">On-Site Contact</h4>
                <p>{ticket.contactOnSite} {ticket.contactPhone && `• ${ticket.contactPhone}`}</p>
              </div>
            )}
            {ticket.specialInstructions && (
              <div className="md:col-span-2">
                <h4 className="text-sm font-medium text-muted-foreground mb-1">Special Instructions</h4>
                <p>{ticket.specialInstructions}</p>
              </div>
            )}
            {ticket.equipmentNeeded && (
              <div className="md:col-span-2">
                <h4 className="text-sm font-medium text-muted-foreground mb-1">Equipment Needed</h4>
                <p>{ticket.equipmentNeeded}</p>
              </div>
            )}
          </div>

          <div className="text-xs text-muted-foreground">
            Created: {ticket.createdAt ? new Date(ticket.createdAt).toLocaleString() : "N/A"}
            {ticket.resolvedAt && ` • Resolved: ${new Date(ticket.resolvedAt).toLocaleString()}`}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Notes & Updates</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              value={noteContent}
              onChange={(e) => setNoteContent(e.target.value)}
              placeholder="Add a note or update..."
              data-testid="input-ticket-note"
              onKeyDown={(e) => {
                if (e.key === "Enter" && noteContent.trim()) {
                  addNote.mutate(noteContent.trim());
                }
              }}
            />
            <Button
              onClick={() => noteContent.trim() && addNote.mutate(noteContent.trim())}
              disabled={addNote.isPending || !noteContent.trim()}
              data-testid="button-add-note"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>

          {notes && notes.length > 0 ? (
            <div className="space-y-3">
              {notes.map((note) => (
                <div key={note.id} className="border rounded-lg p-3" data-testid={`note-${note.id}`}>
                  <p className="text-sm">{note.content}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {note.createdAt ? new Date(note.createdAt).toLocaleString() : "N/A"}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">No notes yet</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function ITServicesPage() {
  const { isAuthenticated, user } = useAuth();
  const [, setLocation] = useLocation();
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const { data: tickets = [], isLoading: loadingTickets } = useQuery<ItServiceTicket[]>({
    queryKey: ["/api/it/tickets"],
    enabled: isAuthenticated,
  });

  const { data: stats } = useQuery<{ total: number; open: number; inProgress: number; resolved: number; closed: number }>({
    queryKey: ["/api/it/tickets/stats/summary"],
    enabled: isAuthenticated,
  });

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Header />
        <main className="flex-1">
          <div className="max-w-4xl mx-auto px-4 py-16 text-center">
            <Server className="h-16 w-16 mx-auto mb-6 text-primary" />
            <h1 className="text-4xl font-bold mb-4" data-testid="text-it-hero-title">IT Services for Healthcare</h1>
            <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              Dispatch IT support to your healthcare facility. Submit tickets, track progress, and keep your technology running smoothly — just like FieldNation, built for healthcare.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <Card>
                <CardContent className="pt-6 text-center">
                  <Ticket className="h-10 w-10 mx-auto mb-3 text-blue-500" />
                  <h3 className="font-semibold mb-2">Submit Tickets</h3>
                  <p className="text-sm text-muted-foreground">Create IT service requests with dispatch details, location, and priority</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6 text-center">
                  <MapPin className="h-10 w-10 mx-auto mb-3 text-emerald-500" />
                  <h3 className="font-semibold mb-2">Dispatch & Track</h3>
                  <p className="text-sm text-muted-foreground">Include site address, scheduled time, and on-site contact info</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6 text-center">
                  <Shield className="h-10 w-10 mx-auto mb-3 text-purple-500" />
                  <h3 className="font-semibold mb-2">Healthcare Focused</h3>
                  <p className="text-sm text-muted-foreground">Categories for EHR systems, medical devices, HIPAA compliance, and more</p>
                </CardContent>
              </Card>
            </div>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button size="lg" onClick={() => setLocation("/signup")} data-testid="button-it-onboard">
                <Building2 className="mr-2 h-5 w-5" />
                Onboard Your Company
              </Button>
              <Button size="lg" variant="outline" onClick={() => setLocation("/login")} data-testid="button-it-signin">
                <LogIn className="mr-2 h-5 w-5" />
                Sign In
              </Button>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (selectedTicketId) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Header />
        <main className="flex-1 py-8 px-4 max-w-4xl mx-auto w-full">
          <TicketDetail ticketId={selectedTicketId} onBack={() => setSelectedTicketId(null)} />
        </main>
        <Footer />
      </div>
    );
  }

  const filteredTickets = statusFilter === "all" ? tickets : tickets.filter(t => t.status === statusFilter);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1 py-8 px-4 max-w-6xl mx-auto w-full">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-it-dashboard-title">
              <Monitor className="h-6 w-6" />
              IT Services
            </h1>
            <p className="text-muted-foreground">Submit and track IT service requests</p>
          </div>
          <CreateTicketDialog onCreated={() => {}} />
        </div>

        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
            <Card className="cursor-pointer hover:border-primary transition-colors" onClick={() => setStatusFilter("all")} data-testid="stat-total">
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-xs text-muted-foreground">Total</p>
              </CardContent>
            </Card>
            <Card className="cursor-pointer hover:border-primary transition-colors" onClick={() => setStatusFilter("open")} data-testid="stat-open">
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-blue-600">{stats.open}</p>
                <p className="text-xs text-muted-foreground">Open</p>
              </CardContent>
            </Card>
            <Card className="cursor-pointer hover:border-primary transition-colors" onClick={() => setStatusFilter("in_progress")} data-testid="stat-in-progress">
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-yellow-600">{stats.inProgress}</p>
                <p className="text-xs text-muted-foreground">In Progress</p>
              </CardContent>
            </Card>
            <Card className="cursor-pointer hover:border-primary transition-colors" onClick={() => setStatusFilter("resolved")} data-testid="stat-resolved">
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-green-600">{stats.resolved}</p>
                <p className="text-xs text-muted-foreground">Resolved</p>
              </CardContent>
            </Card>
            <Card className="cursor-pointer hover:border-primary transition-colors" onClick={() => setStatusFilter("closed")} data-testid="stat-closed">
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-gray-600">{stats.closed}</p>
                <p className="text-xs text-muted-foreground">Closed</p>
              </CardContent>
            </Card>
          </div>
        )}

        {loadingTickets ? (
          <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>
        ) : filteredTickets.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Ticket className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-medium mb-2">No tickets yet</h3>
              <p className="text-muted-foreground mb-4">Submit your first IT service request to get started</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filteredTickets.map((ticket) => {
              const StatusIcon = statusIcons[ticket.status] || AlertCircle;
              const CategoryIcon = categoryIcons[ticket.category] || Wrench;
              return (
                <Card
                  key={ticket.id}
                  className="cursor-pointer hover:border-primary transition-colors"
                  onClick={() => setSelectedTicketId(ticket.id)}
                  data-testid={`ticket-card-${ticket.id}`}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <CategoryIcon className="h-5 w-5 shrink-0 text-muted-foreground" />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className="text-xs text-muted-foreground font-mono">{ticket.ticketNumber}</span>
                            <Badge className={priorityColors[ticket.priority]} variant="secondary">
                              {ticket.priority}
                            </Badge>
                            <Badge className={statusColors[ticket.status]} variant="secondary">
                              <StatusIcon className="h-3 w-3 mr-1" />
                              {ticket.status.replace("_", " ")}
                            </Badge>
                          </div>
                          <p className="font-medium truncate">{ticket.title}</p>
                          <p className="text-sm text-muted-foreground truncate">{ticket.description}</p>
                          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                            {ticket.scheduledDate && (
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {new Date(ticket.scheduledDate).toLocaleDateString()}
                              </span>
                            )}
                            {ticket.siteCity && (
                              <span className="flex items-center gap-1">
                                <MapPin className="h-3 w-3" />
                                {ticket.siteCity}, {ticket.siteState}
                              </span>
                            )}
                            <span>{ticket.createdAt ? new Date(ticket.createdAt).toLocaleDateString() : ""}</span>
                          </div>
                        </div>
                      </div>
                      <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}