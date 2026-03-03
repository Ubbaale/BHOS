import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link } from "wouter";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
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
} from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Users,
  Plus,
  Car,
  Phone,
  Mail,
  Edit,
  Trash2,
  Accessibility,
  FileText,
  Activity,
  Clock,
  CheckCircle2,
  Loader2,
  Heart,
  CalendarDays,
} from "lucide-react";
import type { CaregiverPatient, Ride } from "@shared/schema";

const patientFormSchema = z.object({
  patientName: z.string().min(1, "Patient name is required"),
  patientPhone: z.string().min(10, "Valid phone number is required"),
  patientEmail: z.string().email("Invalid email").optional().or(z.literal("")),
  relationship: z.enum(["spouse", "child", "parent", "sibling", "caregiver", "other"]),
  mobilityNeeds: z.array(z.string()).optional().default([]),
  medicalNotes: z.string().optional().or(z.literal("")),
});

type PatientFormData = z.infer<typeof patientFormSchema>;

const mobilityOptions = [
  { id: "wheelchair", label: "Wheelchair" },
  { id: "stretcher", label: "Stretcher" },
  { id: "walker", label: "Walker/Cane" },
  { id: "oxygen", label: "Oxygen Tank" },
];

const relationshipLabels: Record<string, string> = {
  spouse: "Spouse",
  child: "Child",
  parent: "Parent",
  sibling: "Sibling",
  caregiver: "Caregiver",
  other: "Other",
};

function getStatusColor(status: string) {
  switch (status) {
    case "requested": return "secondary";
    case "accepted": return "default";
    case "driver_enroute": return "default";
    case "arrived": return "default";
    case "in_progress": return "default";
    case "completed": return "secondary";
    case "cancelled": return "destructive";
    default: return "secondary";
  }
}

function PatientFormDialog({
  patient,
  open,
  onOpenChange,
}: {
  patient?: CaregiverPatient;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { toast } = useToast();
  const [selectedNeeds, setSelectedNeeds] = useState<string[]>(
    patient?.mobilityNeeds || []
  );

  const form = useForm<PatientFormData>({
    resolver: zodResolver(patientFormSchema),
    defaultValues: {
      patientName: patient?.patientName || "",
      patientPhone: patient?.patientPhone || "",
      patientEmail: patient?.patientEmail || "",
      relationship: (patient?.relationship as PatientFormData["relationship"]) || "caregiver",
      mobilityNeeds: patient?.mobilityNeeds || [],
      medicalNotes: patient?.medicalNotes || "",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: PatientFormData) => {
      const response = await apiRequest("POST", "/api/caregiver/patients", {
        ...data,
        patientEmail: data.patientEmail || undefined,
        medicalNotes: data.medicalNotes || undefined,
        mobilityNeeds: selectedNeeds,
      });
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Patient Added", description: "Patient has been added to your list." });
      queryClient.invalidateQueries({ queryKey: ["/api/caregiver/patients"] });
      queryClient.invalidateQueries({ queryKey: ["/api/caregiver/dashboard"] });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: PatientFormData) => {
      const response = await apiRequest("PUT", `/api/caregiver/patients/${patient!.id}`, {
        ...data,
        patientEmail: data.patientEmail || undefined,
        medicalNotes: data.medicalNotes || undefined,
        mobilityNeeds: selectedNeeds,
      });
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Patient Updated", description: "Patient information has been updated." });
      queryClient.invalidateQueries({ queryKey: ["/api/caregiver/patients"] });
      queryClient.invalidateQueries({ queryKey: ["/api/caregiver/dashboard"] });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const onSubmit = (data: PatientFormData) => {
    if (patient) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle data-testid="text-patient-dialog-title">
            {patient ? "Edit Patient" : "Add Patient"}
          </DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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

            <FormField
              control={form.control}
              name="patientPhone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone Number</FormLabel>
                  <FormControl>
                    <Input placeholder="(555) 123-4567" {...field} data-testid="input-patient-phone" />
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

            <FormField
              control={form.control}
              name="relationship"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Your Relationship</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-relationship">
                        <SelectValue placeholder="Select relationship" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="spouse">Spouse</SelectItem>
                      <SelectItem value="child">Child</SelectItem>
                      <SelectItem value="parent">Parent</SelectItem>
                      <SelectItem value="sibling">Sibling</SelectItem>
                      <SelectItem value="caregiver">Caregiver</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-2">
              <Label>Mobility Needs</Label>
              <div className="grid grid-cols-2 gap-2">
                {mobilityOptions.map((option) => (
                  <div key={option.id} className="flex items-center gap-2">
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
                    <Label htmlFor={`mobility-${option.id}`} className="text-sm">
                      {option.label}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            <FormField
              control={form.control}
              name="medicalNotes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Medical Notes (Optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Any medical conditions or special instructions..."
                      {...field}
                      data-testid="input-medical-notes"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter className="gap-2">
              <DialogClose asChild>
                <Button type="button" variant="outline" data-testid="button-cancel-patient">
                  Cancel
                </Button>
              </DialogClose>
              <Button type="submit" disabled={isPending} data-testid="button-save-patient">
                {isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : patient ? (
                  "Update Patient"
                ) : (
                  "Add Patient"
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

export default function CaregiverDashboard() {
  const { toast } = useToast();
  const [addPatientOpen, setAddPatientOpen] = useState(false);
  const [editPatient, setEditPatient] = useState<CaregiverPatient | null>(null);

  const dashboardQuery = useQuery<{ patients: CaregiverPatient[]; rides: Ride[] }>({
    queryKey: ["/api/caregiver/dashboard"],
  });

  const patientsQuery = useQuery<CaregiverPatient[]>({
    queryKey: ["/api/caregiver/patients"],
  });

  const removeMutation = useMutation({
    mutationFn: async (patientId: number) => {
      await apiRequest("DELETE", `/api/caregiver/patients/${patientId}`);
    },
    onSuccess: () => {
      toast({ title: "Patient Removed", description: "Patient has been removed from your list." });
      queryClient.invalidateQueries({ queryKey: ["/api/caregiver/patients"] });
      queryClient.invalidateQueries({ queryKey: ["/api/caregiver/dashboard"] });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const patients = patientsQuery.data || dashboardQuery.data?.patients || [];
  const rides = dashboardQuery.data?.rides || [];

  const activeRides = rides.filter(
    (r) => ["requested", "accepted", "driver_enroute", "arrived", "in_progress"].includes(r.status)
  );
  const completedRides = rides.filter((r) => r.status === "completed");
  const upcomingRides = rides.filter(
    (r) =>
      ["requested", "accepted"].includes(r.status) &&
      new Date(r.appointmentTime) > new Date()
  );

  const isLoading = dashboardQuery.isLoading || patientsQuery.isLoading;

  return (
    <div className="min-h-screen bg-background">
      <Header title="Family Portal" showBack />
      <main className="container mx-auto px-4 py-6 max-w-5xl">
        <div className="flex items-center justify-between gap-4 flex-wrap mb-6">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-page-title">
              <Heart className="w-6 h-6 text-primary" />
              Family Portal
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Manage rides for your loved ones
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-md bg-primary/10">
                <Car className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold" data-testid="text-total-rides">{rides.length}</p>
                <p className="text-xs text-muted-foreground">Total Rides</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-md bg-green-500/10">
                <Activity className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold" data-testid="text-active-rides">{activeRides.length}</p>
                <p className="text-xs text-muted-foreground">Active Rides</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-md bg-blue-500/10">
                <CalendarDays className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold" data-testid="text-upcoming-rides">{upcomingRides.length}</p>
                <p className="text-xs text-muted-foreground">Upcoming</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="mb-8">
          <div className="flex items-center justify-between gap-4 flex-wrap mb-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Users className="w-5 h-5" />
              My Patients
            </h2>
            <Button onClick={() => setAddPatientOpen(true)} data-testid="button-add-patient">
              <Plus className="w-4 h-4 mr-2" />
              Add Patient
            </Button>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[1, 2].map((i) => (
                <Card key={i}>
                  <CardContent className="p-4 space-y-3">
                    <Skeleton className="h-6 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                    <Skeleton className="h-4 w-2/3" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : patients.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Users className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                <h3 className="font-semibold mb-1">No Patients Yet</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Add a patient to start managing their rides.
                </p>
                <Button onClick={() => setAddPatientOpen(true)} data-testid="button-add-patient-empty">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Your First Patient
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {patients.map((patient) => (
                <Card key={patient.id} data-testid={`card-patient-${patient.id}`}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div>
                        <h3 className="font-semibold" data-testid={`text-patient-name-${patient.id}`}>
                          {patient.patientName}
                        </h3>
                        <Badge variant="secondary" className="mt-1">
                          {relationshipLabels[patient.relationship] || patient.relationship}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => setEditPatient(patient)}
                          data-testid={`button-edit-patient-${patient.id}`}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              size="icon"
                              variant="ghost"
                              data-testid={`button-remove-patient-${patient.id}`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Remove Patient</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to remove {patient.patientName} from your patient list?
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel data-testid="button-cancel-remove">Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => removeMutation.mutate(patient.id)}
                                data-testid="button-confirm-remove"
                              >
                                Remove
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>

                    <div className="space-y-1 text-sm text-muted-foreground mb-3">
                      <div className="flex items-center gap-2">
                        <Phone className="w-3.5 h-3.5" />
                        <span data-testid={`text-patient-phone-${patient.id}`}>{patient.patientPhone}</span>
                      </div>
                      {patient.patientEmail && (
                        <div className="flex items-center gap-2">
                          <Mail className="w-3.5 h-3.5" />
                          <span>{patient.patientEmail}</span>
                        </div>
                      )}
                      {patient.mobilityNeeds && patient.mobilityNeeds.length > 0 && (
                        <div className="flex items-center gap-2 flex-wrap">
                          <Accessibility className="w-3.5 h-3.5" />
                          {patient.mobilityNeeds.map((need) => (
                            <Badge key={need} variant="outline" className="text-xs">
                              {need}
                            </Badge>
                          ))}
                        </div>
                      )}
                      {patient.medicalNotes && (
                        <div className="flex items-start gap-2">
                          <FileText className="w-3.5 h-3.5 mt-0.5" />
                          <span className="line-clamp-2">{patient.medicalNotes}</span>
                        </div>
                      )}
                    </div>

                    <Button asChild variant="outline" className="w-full" data-testid={`button-book-ride-${patient.id}`}>
                      <Link href={`/caregiver/book-ride/${patient.id}`}>
                        <Car className="w-4 h-4 mr-2" />
                        Book Ride
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
            <Clock className="w-5 h-5" />
            Recent Rides
          </h2>

          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Card key={i}>
                  <CardContent className="p-4">
                    <Skeleton className="h-5 w-1/3 mb-2" />
                    <Skeleton className="h-4 w-2/3" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : rides.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Car className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                <h3 className="font-semibold mb-1">No Rides Yet</h3>
                <p className="text-sm text-muted-foreground">
                  Book a ride for one of your patients to see it here.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {rides
                .sort((a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime())
                .slice(0, 20)
                .map((ride) => (
                  <Card key={ride.id} data-testid={`card-ride-${ride.id}`}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-2 flex-wrap mb-2">
                        <div>
                          <span className="font-medium" data-testid={`text-ride-patient-${ride.id}`}>
                            {ride.patientName}
                          </span>
                          <span className="text-muted-foreground text-sm ml-2">
                            #{ride.id}
                          </span>
                        </div>
                        <Badge variant={getStatusColor(ride.status)} data-testid={`badge-ride-status-${ride.id}`}>
                          {ride.status.replace(/_/g, " ")}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-muted-foreground">
                        <div>
                          <span className="text-xs uppercase tracking-wide">Pickup</span>
                          <p className="truncate">{ride.pickupAddress}</p>
                        </div>
                        <div>
                          <span className="text-xs uppercase tracking-wide">Dropoff</span>
                          <p className="truncate">{ride.dropoffAddress}</p>
                        </div>
                        <div>
                          <span className="text-xs uppercase tracking-wide">Time</span>
                          <p>{new Date(ride.appointmentTime).toLocaleString()}</p>
                        </div>
                        {ride.estimatedFare && (
                          <div>
                            <span className="text-xs uppercase tracking-wide">Fare</span>
                            <p className="font-medium text-foreground">
                              ${parseFloat(ride.estimatedFare).toFixed(2)}
                            </p>
                          </div>
                        )}
                      </div>
                      {ride.status !== "completed" && ride.status !== "cancelled" && (
                        <div className="mt-3">
                          <Button asChild variant="outline" size="sm" data-testid={`button-track-ride-${ride.id}`}>
                            <Link href={`/track/${ride.id}`}>
                              <Activity className="w-3.5 h-3.5 mr-1" />
                              Track
                            </Link>
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
            </div>
          )}
        </div>
      </main>
      <Footer />

      <PatientFormDialog
        open={addPatientOpen}
        onOpenChange={setAddPatientOpen}
      />

      {editPatient && (
        <PatientFormDialog
          patient={editPatient}
          open={!!editPatient}
          onOpenChange={(open) => {
            if (!open) setEditPatient(null);
          }}
        />
      )}
    </div>
  );
}
