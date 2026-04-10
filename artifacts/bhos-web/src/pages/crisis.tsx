import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertTriangle,
  Shield,
  FileText,
  Plus,
  Clock,
  CheckCircle,
  XCircle,
  Ambulance,
  Users,
} from "lucide-react";
import { useListPatients, useListHomes } from "@workspace/api-client-react";

const BASE = import.meta.env.BASE_URL;
function fetchApi(path: string, opts?: RequestInit) {
  return fetch(`${BASE}api${path}`, { credentials: "include", ...opts }).then(r => {
    if (!r.ok) throw new Error("Request failed");
    return r.json();
  });
}

function SeverityBadge({ severity }: { severity: string }) {
  switch (severity) {
    case "critical":
      return <Badge className="bg-red-100 text-red-800">Critical</Badge>;
    case "high":
      return <Badge className="bg-orange-100 text-orange-800">High</Badge>;
    case "moderate":
      return <Badge className="bg-yellow-100 text-yellow-800">Moderate</Badge>;
    case "low":
      return <Badge className="bg-green-100 text-green-800">Low</Badge>;
    default:
      return <Badge variant="outline">{severity}</Badge>;
  }
}

export default function CrisisPage() {
  const qc = useQueryClient();
  const [showPlanForm, setShowPlanForm] = useState(false);
  const [showEventForm, setShowEventForm] = useState(false);

  const { data: plans = [], isLoading: loadingPlans } = useQuery({
    queryKey: ["crisis-plans"],
    queryFn: () => fetchApi("/crisis/plans"),
  });

  const { data: events = [], isLoading: loadingEvents } = useQuery({
    queryKey: ["crisis-events"],
    queryFn: () => fetchApi("/crisis/events"),
  });

  const { data: patients = [] } = useListPatients();
  const { data: homes = [] } = useListHomes();

  const [planForm, setPlanForm] = useState({
    patientId: "",
    homeId: "",
    triggerWarnings: "",
    deescalationSteps: "",
    preferredHospital: "",
    emergencyContacts: "",
    medicationProtocol: "",
    safetyPrecautions: "",
  });

  const [eventForm, setEventForm] = useState({
    patientId: "",
    homeId: "",
    crisisType: "",
    severity: "moderate",
    description: "",
    interventionsUsed: "",
    restraintUsed: false,
    restraintType: "",
    restraintJustification: "",
    seclusionUsed: false,
    hospitalTransport: false,
    hospitalName: "",
  });

  const createPlan = useMutation({
    mutationFn: (data: any) => fetchApi("/crisis/plans", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["crisis-plans"] }); setShowPlanForm(false); },
  });

  const createEvent = useMutation({
    mutationFn: (data: any) => fetchApi("/crisis/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["crisis-events"] }); setShowEventForm(false); },
  });

  const resolveEvent = useMutation({
    mutationFn: ({ id, outcome }: { id: number; outcome: string }) => fetchApi(`/crisis/events/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "resolved", resolvedAt: new Date().toISOString(), outcome }),
    }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["crisis-events"] }),
  });

  const activeEvents = events.filter((e: any) => e.status === "active");
  const activePlans = plans.filter((p: any) => p.status === "active");

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <AlertTriangle className="h-6 w-6 text-red-500" />
          Crisis Management
        </h1>
        <p className="text-muted-foreground">Manage crisis plans, track crisis events, and document interventions including restraint/seclusion.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="py-3 px-4 text-center">
            <p className="text-2xl font-bold text-red-600">{activeEvents.length}</p>
            <p className="text-xs text-muted-foreground">Active Crises</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3 px-4 text-center">
            <p className="text-2xl font-bold">{events.length}</p>
            <p className="text-xs text-muted-foreground">Total Events</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3 px-4 text-center">
            <p className="text-2xl font-bold text-blue-600">{activePlans.length}</p>
            <p className="text-xs text-muted-foreground">Active Plans</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3 px-4 text-center">
            <p className="text-2xl font-bold text-amber-600">{events.filter((e: any) => e.restraintUsed).length}</p>
            <p className="text-xs text-muted-foreground">Restraint Events</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="events">
        <TabsList>
          <TabsTrigger value="events" className="gap-2"><AlertTriangle className="h-4 w-4" />Crisis Events</TabsTrigger>
          <TabsTrigger value="plans" className="gap-2"><Shield className="h-4 w-4" />Crisis Plans</TabsTrigger>
        </TabsList>

        <TabsContent value="events">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Crisis Events</CardTitle>
              <Button onClick={() => setShowEventForm(true)} className="gap-2"><Plus className="h-4 w-4" />Report Crisis</Button>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Patient</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Severity</TableHead>
                    <TableHead>Home</TableHead>
                    <TableHead>R/S</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingEvents ? (
                    <TableRow><TableCell colSpan={8} className="text-center py-8">Loading...</TableCell></TableRow>
                  ) : events.length === 0 ? (
                    <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No crisis events recorded</TableCell></TableRow>
                  ) : events.map((event: any) => (
                    <TableRow key={event.id}>
                      <TableCell className="font-medium">{event.patientFirstName} {event.patientLastName}</TableCell>
                      <TableCell className="capitalize">{event.crisisType?.replace(/_/g, " ")}</TableCell>
                      <TableCell><SeverityBadge severity={event.severity} /></TableCell>
                      <TableCell className="text-sm text-muted-foreground">{event.homeName}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {event.restraintUsed && <Badge variant="outline" className="text-xs text-red-600 border-red-200">R</Badge>}
                          {event.seclusionUsed && <Badge variant="outline" className="text-xs text-orange-600 border-orange-200">S</Badge>}
                          {event.hospitalTransport && <Ambulance className="h-4 w-4 text-red-500" />}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{new Date(event.occurredAt).toLocaleDateString()}</TableCell>
                      <TableCell>
                        {event.status === "active"
                          ? <Badge className="bg-red-100 text-red-800"><Clock className="h-3 w-3 mr-1" />Active</Badge>
                          : <Badge className="bg-green-100 text-green-800"><CheckCircle className="h-3 w-3 mr-1" />Resolved</Badge>}
                      </TableCell>
                      <TableCell>
                        {event.status === "active" && (
                          <Button size="sm" variant="outline" onClick={() => {
                            const outcome = prompt("Enter resolution outcome:");
                            if (outcome) resolveEvent.mutate({ id: event.id, outcome });
                          }}>Resolve</Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="plans">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Crisis Plans</CardTitle>
              <Button onClick={() => setShowPlanForm(true)} className="gap-2"><Plus className="h-4 w-4" />New Plan</Button>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Patient</TableHead>
                    <TableHead>Home</TableHead>
                    <TableHead>Hospital</TableHead>
                    <TableHead>Created By</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Next Review</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingPlans ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-8">Loading...</TableCell></TableRow>
                  ) : plans.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No crisis plans created</TableCell></TableRow>
                  ) : plans.map((plan: any) => (
                    <TableRow key={plan.id}>
                      <TableCell className="font-medium">{plan.patientFirstName} {plan.patientLastName}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{plan.homeName}</TableCell>
                      <TableCell className="text-sm">{plan.preferredHospital || "—"}</TableCell>
                      <TableCell className="text-sm">{plan.createdByFirstName} {plan.createdByLastName}</TableCell>
                      <TableCell>
                        <Badge className={plan.status === "active" ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"}>
                          {plan.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {plan.nextReviewDate ? new Date(plan.nextReviewDate).toLocaleDateString() : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={showPlanForm} onOpenChange={setShowPlanForm}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Create Crisis Plan</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Patient</label>
                <Select value={planForm.patientId} onValueChange={v => setPlanForm({ ...planForm, patientId: v })}>
                  <SelectTrigger><SelectValue placeholder="Select patient" /></SelectTrigger>
                  <SelectContent>
                    {(patients as any[]).map((p: any) => (
                      <SelectItem key={p.id} value={String(p.id)}>{p.firstName} {p.lastName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Home</label>
                <Select value={planForm.homeId} onValueChange={v => setPlanForm({ ...planForm, homeId: v })}>
                  <SelectTrigger><SelectValue placeholder="Select home" /></SelectTrigger>
                  <SelectContent>
                    {(homes as any[]).map((h: any) => (
                      <SelectItem key={h.id} value={String(h.id)}>{h.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Trigger Warnings</label>
              <textarea className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[60px]"
                value={planForm.triggerWarnings} onChange={e => setPlanForm({ ...planForm, triggerWarnings: e.target.value })}
                placeholder="Known triggers for crisis behavior" />
            </div>
            <div>
              <label className="text-sm font-medium">De-escalation Steps</label>
              <textarea className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[80px]"
                value={planForm.deescalationSteps} onChange={e => setPlanForm({ ...planForm, deescalationSteps: e.target.value })}
                placeholder="Step-by-step de-escalation protocol" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Preferred Hospital</label>
                <Input value={planForm.preferredHospital} onChange={e => setPlanForm({ ...planForm, preferredHospital: e.target.value })} />
              </div>
              <div>
                <label className="text-sm font-medium">Emergency Contacts</label>
                <Input value={planForm.emergencyContacts} onChange={e => setPlanForm({ ...planForm, emergencyContacts: e.target.value })} />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Medication Protocol</label>
              <textarea className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[60px]"
                value={planForm.medicationProtocol} onChange={e => setPlanForm({ ...planForm, medicationProtocol: e.target.value })}
                placeholder="PRN medications and protocols for crisis situations" />
            </div>
            <div>
              <label className="text-sm font-medium">Safety Precautions</label>
              <textarea className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[60px]"
                value={planForm.safetyPrecautions} onChange={e => setPlanForm({ ...planForm, safetyPrecautions: e.target.value })}
                placeholder="Environmental safety measures" />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowPlanForm(false)}>Cancel</Button>
              <Button onClick={() => createPlan.mutate({
                ...planForm,
                patientId: parseInt(planForm.patientId),
                homeId: parseInt(planForm.homeId),
              })} disabled={!planForm.patientId || !planForm.homeId || createPlan.isPending}>
                {createPlan.isPending ? "Creating..." : "Create Plan"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showEventForm} onOpenChange={setShowEventForm}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Report Crisis Event</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Patient</label>
                <Select value={eventForm.patientId} onValueChange={v => setEventForm({ ...eventForm, patientId: v })}>
                  <SelectTrigger><SelectValue placeholder="Select patient" /></SelectTrigger>
                  <SelectContent>
                    {(patients as any[]).map((p: any) => (
                      <SelectItem key={p.id} value={String(p.id)}>{p.firstName} {p.lastName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Home</label>
                <Select value={eventForm.homeId} onValueChange={v => setEventForm({ ...eventForm, homeId: v })}>
                  <SelectTrigger><SelectValue placeholder="Select home" /></SelectTrigger>
                  <SelectContent>
                    {(homes as any[]).map((h: any) => (
                      <SelectItem key={h.id} value={String(h.id)}>{h.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Crisis Type</label>
                <Select value={eventForm.crisisType} onValueChange={v => setEventForm({ ...eventForm, crisisType: v })}>
                  <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="self_harm">Self-Harm</SelectItem>
                    <SelectItem value="suicidal_ideation">Suicidal Ideation</SelectItem>
                    <SelectItem value="aggression">Aggression</SelectItem>
                    <SelectItem value="elopement">Elopement/AWOL</SelectItem>
                    <SelectItem value="psychotic_episode">Psychotic Episode</SelectItem>
                    <SelectItem value="substance_use">Substance Use</SelectItem>
                    <SelectItem value="medical_emergency">Medical Emergency</SelectItem>
                    <SelectItem value="panic_attack">Panic/Anxiety Attack</SelectItem>
                    <SelectItem value="property_destruction">Property Destruction</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Severity</label>
                <Select value={eventForm.severity} onValueChange={v => setEventForm({ ...eventForm, severity: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="moderate">Moderate</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Description</label>
              <textarea className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[80px]"
                value={eventForm.description} onChange={e => setEventForm({ ...eventForm, description: e.target.value })}
                placeholder="Detailed description of the crisis event" />
            </div>
            <div>
              <label className="text-sm font-medium">Interventions Used</label>
              <textarea className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[60px]"
                value={eventForm.interventionsUsed} onChange={e => setEventForm({ ...eventForm, interventionsUsed: e.target.value })}
                placeholder="De-escalation techniques, verbal interventions, etc." />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={eventForm.restraintUsed}
                  onChange={e => setEventForm({ ...eventForm, restraintUsed: e.target.checked })} />
                Restraint Used
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={eventForm.seclusionUsed}
                  onChange={e => setEventForm({ ...eventForm, seclusionUsed: e.target.checked })} />
                Seclusion Used
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={eventForm.hospitalTransport}
                  onChange={e => setEventForm({ ...eventForm, hospitalTransport: e.target.checked })} />
                Hospital Transport
              </label>
            </div>
            {eventForm.restraintUsed && (
              <div className="grid grid-cols-2 gap-4 p-3 bg-red-50 rounded-lg">
                <div>
                  <label className="text-sm font-medium">Restraint Type</label>
                  <Input value={eventForm.restraintType} onChange={e => setEventForm({ ...eventForm, restraintType: e.target.value })} placeholder="Physical, mechanical, etc." />
                </div>
                <div>
                  <label className="text-sm font-medium">Justification</label>
                  <Input value={eventForm.restraintJustification} onChange={e => setEventForm({ ...eventForm, restraintJustification: e.target.value })} placeholder="Clinical justification" />
                </div>
              </div>
            )}
            {eventForm.hospitalTransport && (
              <div className="p-3 bg-amber-50 rounded-lg">
                <label className="text-sm font-medium">Hospital Name</label>
                <Input value={eventForm.hospitalName} onChange={e => setEventForm({ ...eventForm, hospitalName: e.target.value })} placeholder="Receiving hospital" />
              </div>
            )}
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowEventForm(false)}>Cancel</Button>
              <Button variant="destructive" onClick={() => createEvent.mutate({
                ...eventForm,
                patientId: parseInt(eventForm.patientId),
                homeId: parseInt(eventForm.homeId),
              })} disabled={!eventForm.patientId || !eventForm.homeId || !eventForm.crisisType || !eventForm.description || createEvent.isPending}>
                {createEvent.isPending ? "Reporting..." : "Report Crisis Event"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
