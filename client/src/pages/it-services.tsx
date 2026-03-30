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
  Star,
  DollarSign,
  FileText,
  Navigation,
  LogOut,
  Save,
  FolderOpen,
  CheckCircle,
  Car,
  BadgeCheck,
  Download,
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
  payType: z.enum(["hourly", "fixed"]).optional(),
  payRate: z.string().optional(),
  paymentTerms: z.enum(["instant", "net7", "net14", "net30"]).optional(),
  budgetCap: z.string().optional(),
  overtimeRate: z.string().optional(),
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
      payType: "hourly",
      payRate: "",
      paymentTerms: "instant",
      budgetCap: "",
      overtimeRate: "",
    },
  });

  const { data: templates = [] } = useQuery<any[]>({
    queryKey: ["/api/it/templates"],
  });

  const saveTemplate = useMutation({
    mutationFn: () => {
      const values = form.getValues();
      return apiRequest("POST", "/api/it/templates", {
        name: values.title || "Untitled Template",
        category: values.category,
        priority: values.priority,
        description: values.description,
        estimatedDuration: values.estimatedDuration,
        payType: values.payType,
        payRate: values.payRate,
        equipmentNeeded: values.equipmentNeeded,
        specialInstructions: values.specialInstructions,
      });
    },
    onSuccess: () => {
      toast({ title: "Template saved!" });
      queryClient.invalidateQueries({ queryKey: ["/api/it/templates"] });
    },
  });

  const loadTemplate = (template: any) => {
    form.setValue("title", template.name || "");
    form.setValue("description", template.description || "");
    form.setValue("category", template.category || "general");
    form.setValue("priority", template.priority || "medium");
    if (template.estimatedDuration) form.setValue("estimatedDuration", template.estimatedDuration);
    if (template.payType) form.setValue("payType", template.payType);
    if (template.payRate) form.setValue("payRate", template.payRate);
    if (template.equipmentNeeded) form.setValue("equipmentNeeded", template.equipmentNeeded);
    if (template.specialInstructions) form.setValue("specialInstructions", template.specialInstructions);
    toast({ title: "Template loaded" });
  };

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

        {templates.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm text-muted-foreground flex items-center gap-1"><FolderOpen className="h-3 w-3" /> Templates:</span>
            {templates.map((t: any) => (
              <Button key={t.id} variant="outline" size="sm" onClick={() => loadTemplate(t)} data-testid={`template-${t.id}`}>
                {t.name}
              </Button>
            ))}
          </div>
        )}

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

            <div className="border rounded-lg p-4 space-y-4">
              <h4 className="font-medium flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Payment
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField control={form.control} name="payType" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Pay Type</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || "hourly"}>
                      <FormControl><SelectTrigger data-testid="select-pay-type"><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="hourly">Hourly Rate</SelectItem>
                        <SelectItem value="fixed">Fixed Price</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="payRate" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Rate ($)</FormLabel>
                    <FormControl><Input {...field} type="number" step="0.01" placeholder="e.g. 75.00" data-testid="input-pay-rate" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              <FormField control={form.control} name="paymentTerms" render={({ field }) => (
                <FormItem>
                  <FormLabel>Payment Terms</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value || "instant"}>
                    <FormControl><SelectTrigger data-testid="select-payment-terms"><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="instant">Instant — 15% platform fee</SelectItem>
                      <SelectItem value="net7">Net 7 days — 12% platform fee</SelectItem>
                      <SelectItem value="net14">Net 14 days — 10% platform fee</SelectItem>
                      <SelectItem value="net30">Net 30 days — 8% platform fee</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">
                    {field.value === "instant" && "Tech gets paid immediately after you approve the work. 15% fee."}
                    {field.value === "net7" && "Payment releases 7 days after approval. Lower 12% fee."}
                    {field.value === "net14" && "Payment releases 14 days after approval. 10% fee."}
                    {field.value === "net30" && "Payment releases 30 days after approval. Lowest 8% fee."}
                  </p>
                  <FormMessage />
                </FormItem>
              )} />

              {form.watch("payType") === "hourly" && (
                <FormField control={form.control} name="budgetCap" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Budget Cap ($) <span className="text-muted-foreground font-normal">— optional</span></FormLabel>
                    <FormControl><Input {...field} type="number" step="0.01" placeholder="e.g. 300.00 max budget" data-testid="input-budget-cap" /></FormControl>
                    <p className="text-xs text-muted-foreground">Maximum total you'll pay for labor. If tech exceeds this, overage requires your approval.</p>
                    <FormMessage />
                  </FormItem>
                )} />
              )}

              {form.watch("payType") === "fixed" && (
                <FormField control={form.control} name="overtimeRate" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Overtime Rate ($/hr) <span className="text-muted-foreground font-normal">— optional</span></FormLabel>
                    <FormControl><Input {...field} type="number" step="0.01" placeholder="e.g. 50.00/hr for extra time" data-testid="input-overtime-rate" /></FormControl>
                    <p className="text-xs text-muted-foreground">If the tech works beyond the estimated duration, this hourly rate applies to extra time (requires your approval).</p>
                    <FormMessage />
                  </FormItem>
                )} />
              )}

              {form.watch("payRate") && parseFloat(form.watch("payRate") || "0") > 0 && (
                <div className="bg-muted/50 rounded-lg p-3 border">
                  <p className="text-sm font-medium mb-1">Estimated Escrow Amount</p>
                  <p className="text-lg font-bold text-green-600" data-testid="text-escrow-estimate">
                    ${(() => {
                      const rate = parseFloat(form.watch("payRate") || "0");
                      const payType = form.watch("payType") || "hourly";
                      if (payType === "fixed") return rate.toFixed(2);
                      const cap = form.watch("budgetCap");
                      if (cap && parseFloat(cap) > 0) return parseFloat(cap).toFixed(2);
                      const dur = form.watch("estimatedDuration");
                      const hrs: Record<string, number> = { "30min": 0.5, "1hr": 1, "2hr": 2, "4hr": 4, "full_day": 8 };
                      return (rate * (hrs[dur || ""] || 2)).toFixed(2);
                    })()}
                  </p>
                  <p className="text-xs text-muted-foreground">This amount will be held in escrow until you approve the completed work.</p>
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <Button type="submit" className="flex-1" disabled={createTicket.isPending} data-testid="button-submit-ticket">
                {createTicket.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Submitting...</> : "Submit Ticket"}
              </Button>
              <Button type="button" variant="outline" onClick={() => saveTemplate.mutate()} disabled={saveTemplate.isPending} data-testid="button-save-template">
                <Save className="h-4 w-4 mr-1" /> Save as Template
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function RateTicketDialog({ ticketId, onRated }: { ticketId: string; onRated: () => void }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [review, setReview] = useState("");

  const submitRating = useMutation({
    mutationFn: () => apiRequest("POST", `/api/it/tickets/${ticketId}/rate`, { rating, review }),
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
        <Button size="sm" data-testid="button-rate-tech">
          <Star className="h-4 w-4 mr-1" /> Rate Technician
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rate the Technician</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex items-center gap-2 justify-center">
            {[1, 2, 3, 4, 5].map(n => (
              <button key={n} type="button" onClick={() => setRating(n)} className="focus:outline-none" data-testid={`owner-star-${n}`}>
                <Star className={`h-8 w-8 ${n <= rating ? "fill-yellow-400 text-yellow-400" : "text-gray-300"}`} />
              </button>
            ))}
          </div>
          <Textarea placeholder="Write a review (optional)..." value={review} onChange={(e) => setReview(e.target.value)} data-testid="input-owner-review" />
          <Button className="w-full" disabled={rating === 0 || submitRating.isPending} onClick={() => submitRating.mutate()} data-testid="button-submit-owner-rating">
            {submitRating.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Submit Rating
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

const etaLabels: Record<string, string> = {
  none: "Awaiting",
  en_route: "On Their Way",
  arriving: "Arriving Soon",
  on_site: "On Site",
};

const etaColors: Record<string, string> = {
  none: "bg-gray-100 text-gray-600",
  en_route: "bg-blue-100 text-blue-700",
  arriving: "bg-yellow-100 text-yellow-700",
  on_site: "bg-green-100 text-green-700",
};

function TechCertificationsViewer({ ticketAssignedTo }: { ticketAssignedTo: string }) {
  const { data: techProfiles } = useQuery<any[]>({
    queryKey: ["/api/it/admin/techs"],
  });

  const techProfile = techProfiles?.find((t: any) => t.userId === ticketAssignedTo);
  if (!techProfile) return null;

  const certDocs = (techProfile.certificationDocs as any[]) || [];
  const certTags = techProfile.certifications || [];

  if (certDocs.length === 0 && certTags.length === 0) return null;

  return (
    <Card className="bg-muted/50">
      <CardContent className="p-4">
        <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
          <BadgeCheck className="h-4 w-4" /> Tech Certifications
        </h4>
        {certTags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
            {certTags.map((cert: string) => (
              <Badge key={cert} variant="secondary" className="text-xs">{cert}</Badge>
            ))}
          </div>
        )}
        {certDocs.length > 0 && (
          <div className="space-y-1">
            {certDocs.map((doc: any) => (
              <div key={doc.id} className="flex items-center justify-between text-xs p-2 border rounded">
                <div className="flex items-center gap-1">
                  {doc.verified ? (
                    <BadgeCheck className="h-3 w-3 text-green-600 shrink-0" />
                  ) : (
                    <Clock className="h-3 w-3 text-yellow-500 shrink-0" />
                  )}
                  <span className="font-medium">{doc.name}</span>
                  {doc.issuer && <span className="text-muted-foreground">({doc.issuer})</span>}
                  {doc.verified && <span className="text-green-600">Verified</span>}
                </div>
                <a href={doc.filePath} target="_blank" rel="noopener noreferrer">
                  <Button size="sm" variant="ghost" className="h-6 px-1"><Download className="h-3 w-3" /></Button>
                </a>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
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

  const approveWork = useMutation({
    mutationFn: () => apiRequest("POST", `/api/it/tickets/${ticketId}/approve`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/it/tickets", ticketId] });
      queryClient.invalidateQueries({ queryKey: ["/api/it/tickets"] });
      toast({ title: "Work approved!", description: "Payment has been authorized." });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const disputeWork = useMutation({
    mutationFn: (reason: string) => apiRequest("POST", `/api/it/tickets/${ticketId}/dispute`, { reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/it/tickets", ticketId] });
      queryClient.invalidateQueries({ queryKey: ["/api/it/tickets"] });
      toast({ title: "Work disputed", description: "The tech has been notified." });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const requestMediation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/it/tickets/${ticketId}/request-mediation`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/it/tickets", ticketId] });
      toast({ title: "Mediation requested", description: "A platform admin will review this dispute." });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const cancelTicket = useMutation({
    mutationFn: (reason: string) => apiRequest("POST", `/api/it/tickets/${ticketId}/cancel`, { reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/it/tickets", ticketId] });
      queryClient.invalidateQueries({ queryKey: ["/api/it/tickets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/it/tickets/stats/summary"] });
      toast({ title: "Ticket cancelled" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const approveOverage = useMutation({
    mutationFn: () => apiRequest("POST", `/api/it/tickets/${ticketId}/approve-overage`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/it/tickets", ticketId] });
      queryClient.invalidateQueries({ queryKey: ["/api/it/tickets"] });
      toast({ title: "Overage approved", description: "The extra time has been added to the total." });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const rejectOverage = useMutation({
    mutationFn: () => apiRequest("POST", `/api/it/tickets/${ticketId}/reject-overage`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/it/tickets", ticketId] });
      queryClient.invalidateQueries({ queryKey: ["/api/it/tickets"] });
      toast({ title: "Overage rejected", description: "Only the original amount will be paid." });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const fundEscrow = useMutation({
    mutationFn: () => apiRequest("POST", `/api/it/tickets/${ticketId}/fund-escrow`),
    onSuccess: async (resp) => {
      const data = await resp.json();
      queryClient.invalidateQueries({ queryKey: ["/api/it/tickets", ticketId] });
      queryClient.invalidateQueries({ queryKey: ["/api/it/tickets"] });
      if (data.clientSecret) {
        toast({ title: "Escrow initiated", description: `$${data.escrowAmount.toFixed(2)} payment created. Confirming escrow...` });
        await apiRequest("POST", `/api/it/tickets/${ticketId}/confirm-escrow`);
        queryClient.invalidateQueries({ queryKey: ["/api/it/tickets", ticketId] });
        toast({ title: "Escrow funded!", description: "Funds are held securely until you approve the work." });
      }
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  if (isLoading) return <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  if (!data) return <Alert><AlertDescription>Ticket not found</AlertDescription></Alert>;

  const { ticket, notes } = data;
  const StatusIcon = statusIcons[ticket.status] || AlertCircle;
  const CategoryIcon = categoryIcons[ticket.category] || Wrench;
  let deliverables: any[] = [];
  try { deliverables = JSON.parse(ticket.deliverables || "[]"); } catch { deliverables = []; }

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
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <span className="text-sm text-muted-foreground font-mono">{ticket.ticketNumber}</span>
                <Badge className={priorityColors[ticket.priority]} variant="secondary">
                  {ticket.priority}
                </Badge>
                <Badge className={statusColors[ticket.status]} variant="secondary">
                  <StatusIcon className="h-3 w-3 mr-1" />
                  {ticket.status.replace("_", " ")}
                </Badge>
                {ticket.etaStatus && ticket.status === "in_progress" && (
                  <Badge className={etaColors[ticket.etaStatus || "none"]} variant="secondary">
                    <Navigation className="h-3 w-3 mr-1" />
                    {etaLabels[ticket.etaStatus || "none"]}
                  </Badge>
                )}
              </div>
              <CardTitle className="flex items-center gap-2">
                <CategoryIcon className="h-5 w-5" />
                {ticket.title}
              </CardTitle>
              <CardDescription className="mt-1">
                {categoryLabels[ticket.category] || ticket.category}
              </CardDescription>
            </div>
            <div className="flex gap-2 flex-wrap">
              {(ticket.status === "resolved" || ticket.status === "closed") && !ticket.customerRating && (
                <RateTicketDialog ticketId={ticketId} onRated={() => queryClient.invalidateQueries({ queryKey: ["/api/it/tickets", ticketId] })} />
              )}
              {(ticket.status === "open" || ticket.status === "in_progress") && (
                <Button size="sm" variant="destructive" onClick={() => {
                  const reason = prompt("Why are you cancelling this ticket?");
                  if (reason) cancelTicket.mutate(reason);
                }} disabled={cancelTicket.isPending} data-testid="button-cancel-ticket">
                  {cancelTicket.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <XCircle className="h-3 w-3 mr-1" />}
                  Cancel
                </Button>
              )}
              {(ticket.status === "open" || ticket.status === "resolved") && (
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

          {(ticket.checkInTime || ticket.checkOutTime) && (
            <Card className="bg-muted/50">
              <CardContent className="p-4">
                <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                  <Clock className="h-4 w-4" /> Tech Check-In/Out
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                  {ticket.checkInTime && (
                    <div>
                      <div className="flex items-center gap-2">
                        <LogIn className="h-4 w-4 text-green-600 shrink-0" />
                        <span>Checked in: {new Date(ticket.checkInTime).toLocaleString()}</span>
                      </div>
                      {(ticket as any).locationVerified !== undefined && (
                        <div className="flex items-center gap-1 mt-1 ml-6 text-xs">
                          {(ticket as any).locationVerified ? (
                            <span className="text-green-600 flex items-center gap-1"><CheckCircle className="h-3 w-3" /> GPS verified on-site ({Math.round(Number((ticket as any).checkInDistance || 0))}m)</span>
                          ) : (ticket as any).checkInDistance ? (
                            <span className="text-orange-500 flex items-center gap-1"><AlertCircle className="h-3 w-3" /> GPS: {Math.round(Number((ticket as any).checkInDistance))}m from site (not verified)</span>
                          ) : (
                            <span className="text-gray-400 flex items-center gap-1"><AlertCircle className="h-3 w-3" /> No GPS data</span>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                  {ticket.checkOutTime && (
                    <div className="flex items-center gap-2">
                      <LogOut className="h-4 w-4 text-blue-600 shrink-0" />
                      <span>Checked out: {new Date(ticket.checkOutTime).toLocaleString()}</span>
                    </div>
                  )}
                  {ticket.hoursWorked && (
                    <div className="flex items-center gap-2">
                      <Timer className="h-4 w-4 shrink-0" />
                      <span>Hours worked: {Number(ticket.hoursWorked).toFixed(2)}</span>
                    </div>
                  )}
                </div>
                {(ticket as any).delayMinutes && (
                  <div className="border-t mt-3 pt-2 text-sm">
                    <p className="flex items-center gap-2 text-orange-600">
                      <AlertCircle className="h-4 w-4 shrink-0" />
                      Delay reported: {(ticket as any).delayMinutes} minutes — {(ticket as any).delayReason}
                    </p>
                    {(ticket as any).delayCompensation && (
                      <p className="text-xs text-muted-foreground ml-6 mt-1">Delay compensation: ${Number((ticket as any).delayCompensation).toFixed(2)}</p>
                    )}
                  </div>
                )}
                {(ticket as any).travelDistance && (
                  <div className="border-t mt-3 pt-2 text-sm">
                    <p className="flex items-center gap-2 text-blue-600">
                      <MapPin className="h-4 w-4 shrink-0" />
                      Travel: {Number((ticket as any).travelDistance).toFixed(1)} miles × $0.67/mi = ${Number((ticket as any).mileagePay || 0).toFixed(2)}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {ticket.assignedTo && (
            <TechCertificationsViewer ticketAssignedTo={ticket.assignedTo} />
          )}

          {(ticket.payRate || ticket.totalPay) && (
            <Card className="bg-muted/50">
              <CardContent className="p-4">
                <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                  <DollarSign className="h-4 w-4" /> Payment Breakdown
                </h4>
                <div className="space-y-2 text-sm">
                  {ticket.payRate && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Rate</span>
                      <span>${ticket.payRate}/{ticket.payType === "fixed" ? "flat" : "hr"}</span>
                    </div>
                  )}
                  {(ticket as any).mileagePay && parseFloat((ticket as any).mileagePay) > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Mileage ({Number((ticket as any).travelDistance).toFixed(1)} mi)</span>
                      <span>${Number((ticket as any).mileagePay).toFixed(2)}</span>
                    </div>
                  )}
                  {(ticket as any).delayCompensation && parseFloat((ticket as any).delayCompensation) > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Delay compensation</span>
                      <span>${Number((ticket as any).delayCompensation).toFixed(2)}</span>
                    </div>
                  )}
                  {ticket.totalPay && (
                    <>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Total</span>
                        <span className="font-medium">${Number(ticket.totalPay).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Platform fee (10%)</span>
                        <span>${Number(ticket.platformFee || 0).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between border-t pt-1">
                        <span className="text-muted-foreground">Tech payout</span>
                        <span className="font-medium text-green-600">${Number(ticket.techPayout || 0).toFixed(2)}</span>
                      </div>
                    </>
                  )}
                  {ticket.paymentStatus && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Payment status</span>
                      <Badge variant="outline" className={
                        ticket.paymentStatus === "completed" || ticket.paymentStatus === "processing" ? "text-green-600" :
                        ticket.paymentStatus === "disputed" ? "text-red-600" :
                        ticket.paymentStatus === "scheduled" ? "text-blue-600" : "text-yellow-600"
                      }>
                        {ticket.paymentStatus}
                      </Badge>
                    </div>
                  )}
                  {(ticket as any).paymentTerms && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Payment terms</span>
                      <span className="font-medium text-sm">
                        {(ticket as any).paymentTerms === "instant" ? "Instant" :
                         (ticket as any).paymentTerms === "net7" ? "Net 7 days" :
                         (ticket as any).paymentTerms === "net14" ? "Net 14 days" : "Net 30 days"}
                        <span className="text-muted-foreground ml-1">({(ticket as any).platformFeePercent || 15}% fee)</span>
                      </span>
                    </div>
                  )}
                  {(ticket as any).escrowAmount && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Escrow</span>
                      <span className="font-medium">
                        ${Number((ticket as any).escrowAmount).toFixed(2)}
                        <Badge variant="outline" className={`ml-2 ${
                          (ticket as any).escrowStatus === "funded" ? "text-green-600" :
                          (ticket as any).escrowStatus === "releasing" ? "text-blue-600" :
                          (ticket as any).escrowStatus === "released" ? "text-green-600" : "text-yellow-600"
                        }`}>
                          {(ticket as any).escrowStatus || "not funded"}
                        </Badge>
                      </span>
                    </div>
                  )}
                  {(ticket as any).payoutDate && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Payout date</span>
                      <span className="font-medium text-sm">{new Date((ticket as any).payoutDate).toLocaleDateString()}</span>
                    </div>
                  )}
                  {(ticket as any).budgetCap && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Budget cap</span>
                      <span className="font-medium">${Number((ticket as any).budgetCap).toFixed(2)}</span>
                    </div>
                  )}
                </div>

                {(ticket as any).overageAmount && parseFloat((ticket as any).overageAmount) > 0 && (
                  <div className="border-t mt-3 pt-3 space-y-2">
                    <div className="bg-orange-50 dark:bg-orange-950 rounded-lg p-3">
                      <p className="text-sm font-medium flex items-center gap-2 text-orange-700 dark:text-orange-300">
                        <AlertCircle className="h-4 w-4" /> Overage Detected
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Tech worked {Number((ticket as any).overageHours).toFixed(1)} extra hours beyond the estimate.
                      </p>
                      <p className="text-sm font-bold mt-1">Overage amount: ${Number((ticket as any).overageAmount).toFixed(2)}</p>
                      {!(ticket as any).overageApproved && (
                        <div className="flex gap-2 mt-2">
                          <Button size="sm" variant="default" onClick={() => approveOverage.mutate()} disabled={approveOverage.isPending} data-testid="button-approve-overage">
                            {approveOverage.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <CheckCircle className="h-3 w-3 mr-1" />}
                            Approve Overage (+${Number((ticket as any).overageAmount).toFixed(2)})
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => rejectOverage.mutate()} disabled={rejectOverage.isPending} data-testid="button-reject-overage">
                            Reject
                          </Button>
                        </div>
                      )}
                      {(ticket as any).overageApproved && (
                        <p className="text-xs text-green-600 mt-1 flex items-center gap-1"><CheckCircle className="h-3 w-3" /> Overage approved</p>
                      )}
                    </div>
                  </div>
                )}

                {(ticket as any).escrowStatus === "none" && (ticket as any).escrowAmount && parseFloat((ticket as any).escrowAmount) > 0 && ticket.status === "open" && (
                  <div className="border-t mt-3 pt-3 space-y-2">
                    <p className="text-sm font-medium">Fund Escrow</p>
                    <p className="text-xs text-muted-foreground">Fund ${Number((ticket as any).escrowAmount).toFixed(2)} to hold in escrow. This ensures the tech gets paid when you approve their work.</p>
                    <Button size="sm" onClick={() => fundEscrow.mutate()} disabled={fundEscrow.isPending} data-testid="button-fund-escrow">
                      {fundEscrow.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <DollarSign className="h-3 w-3 mr-1" />}
                      Fund Escrow (${Number((ticket as any).escrowAmount).toFixed(2)})
                    </Button>
                  </div>
                )}

                {(ticket as any).companyApproval === "pending" && (
                  <div className="border-t mt-3 pt-3 space-y-2">
                    <p className="text-sm font-medium">Approve this work?</p>
                    <p className="text-xs text-muted-foreground">Review the proof of work below and approve to authorize payment, or dispute if there are issues.</p>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => approveWork.mutate()} disabled={approveWork.isPending} data-testid="button-approve-work">
                        {approveWork.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <CheckCircle className="h-3 w-3 mr-1" />}
                        Approve & Pay
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => {
                        const reason = prompt("What's the issue with this work?");
                        if (reason) disputeWork.mutate(reason);
                      }} disabled={disputeWork.isPending} data-testid="button-dispute-work">
                        Dispute
                      </Button>
                    </div>
                  </div>
                )}
                {(ticket as any).companyApproval === "approved" && (
                  <div className="border-t mt-3 pt-2">
                    <p className="text-xs text-green-600 flex items-center gap-1"><CheckCircle className="h-3 w-3" /> Work approved {(ticket as any).companyApprovalAt && `on ${new Date((ticket as any).companyApprovalAt).toLocaleDateString()}`}</p>
                  </div>
                )}
                {(ticket as any).companyApproval === "disputed" && (
                  <div className="border-t mt-3 pt-2 space-y-2">
                    <p className="text-xs text-red-600 flex items-center gap-1"><AlertCircle className="h-3 w-3" /> Disputed: {(ticket as any).companyApprovalNotes}</p>
                    {(ticket as any).mediationStatus === "none" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => requestMediation.mutate()}
                        disabled={requestMediation.isPending}
                        data-testid="button-request-mediation"
                      >
                        {requestMediation.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                        Request Admin Mediation
                      </Button>
                    )}
                    {(ticket as any).mediationStatus === "requested" && (
                      <p className="text-xs text-yellow-600 flex items-center gap-1">
                        <Clock className="h-3 w-3" /> Mediation requested - waiting for admin review
                      </p>
                    )}
                    {(ticket as any).mediationStatus === "resolved" && (
                      <div className="bg-blue-50 dark:bg-blue-950 rounded-lg p-2 text-xs">
                        <p className="font-medium text-blue-700 dark:text-blue-300">
                          Mediation resolved: {(ticket as any).mediationResolution?.replace("_", " ")}
                        </p>
                        {(ticket as any).mediationNotes && <p className="text-muted-foreground mt-1">{(ticket as any).mediationNotes}</p>}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {(ticket as any).cancellationFee && (
            <Card className="bg-red-50 dark:bg-red-950">
              <CardContent className="p-4">
                <h4 className="text-sm font-medium mb-2 flex items-center gap-2 text-red-700 dark:text-red-300">
                  <AlertCircle className="h-4 w-4" /> Cancellation
                </h4>
                <div className="text-sm space-y-1">
                  <p>Reason: {(ticket as any).cancellationReason}</p>
                  <p>Cancellation fee: <span className="font-medium">${Number((ticket as any).cancellationFee).toFixed(2)}</span></p>
                </div>
              </CardContent>
            </Card>
          )}

          {deliverables.length > 0 && (
            <Card className="bg-muted/50">
              <CardContent className="p-4">
                <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                  <FileText className="h-4 w-4" /> Proof of Work ({deliverables.length})
                </h4>
                <div className="space-y-2">
                  {deliverables.map((d: any) => (
                    <div key={d.id} className="border rounded p-2 text-sm">
                      <p>{d.description}</p>
                      <p className="text-xs text-muted-foreground mt-1">{new Date(d.addedAt).toLocaleString()}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {ticket.customerRating && (
            <Card className="bg-muted/50">
              <CardContent className="p-4">
                <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                  <Star className="h-4 w-4" /> Your Rating
                </h4>
                <div className="flex items-center gap-1 mb-1">
                  {[1, 2, 3, 4, 5].map(n => (
                    <Star key={n} className={`h-5 w-5 ${n <= (ticket.customerRating || 0) ? "fill-yellow-400 text-yellow-400" : "text-gray-300"}`} />
                  ))}
                </div>
                {ticket.customerReview && <p className="text-sm text-muted-foreground italic">"{ticket.customerReview}"</p>}
              </CardContent>
            </Card>
          )}

          {ticket.techRating && (
            <Card className="bg-muted/50">
              <CardContent className="p-4">
                <h4 className="text-sm font-medium mb-2">Tech's Rating of You</h4>
                <div className="flex items-center gap-1 mb-1">
                  {[1, 2, 3, 4, 5].map(n => (
                    <Star key={n} className={`h-5 w-5 ${n <= (ticket.techRating || 0) ? "fill-yellow-400 text-yellow-400" : "text-gray-300"}`} />
                  ))}
                </div>
                {ticket.techReview && <p className="text-sm text-muted-foreground italic">"{ticket.techReview}"</p>}
              </CardContent>
            </Card>
          )}

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
              Dispatch IT support to your healthcare facility or office. Submit tickets, track progress, and keep your technology running smoothly. This for SMBs and Facilities.
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
                Sign Up / Get Started
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
                          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
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
                            {ticket.payRate && (
                              <span className="flex items-center gap-1 text-green-600 font-medium">
                                <DollarSign className="h-3 w-3" />
                                ${ticket.payRate}/{ticket.payType === "fixed" ? "flat" : "hr"}
                              </span>
                            )}
                            {(ticket as any).paymentTerms && (ticket as any).paymentTerms !== "instant" && (
                              <Badge variant="outline" className="text-xs">
                                {(ticket as any).paymentTerms === "net7" ? "Net 7" : (ticket as any).paymentTerms === "net14" ? "Net 14" : "Net 30"}
                              </Badge>
                            )}
                            {(ticket as any).escrowStatus === "funded" && (
                              <Badge variant="outline" className="text-xs text-green-600">Escrow Funded</Badge>
                            )}
                            {(ticket as any).overageAmount && parseFloat((ticket as any).overageAmount) > 0 && !(ticket as any).overageApproved && (
                              <Badge variant="outline" className="text-xs text-orange-600">Overage Pending</Badge>
                            )}
                            {ticket.etaStatus && ticket.status === "in_progress" && (
                              <Badge className={etaColors[ticket.etaStatus || "none"]} variant="secondary">
                                {etaLabels[ticket.etaStatus || "none"]}
                              </Badge>
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