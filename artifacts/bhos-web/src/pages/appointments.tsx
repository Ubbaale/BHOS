import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Calendar, Clock, MapPin, User, Plus, Stethoscope, Car, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const API = `${import.meta.env.BASE_URL}api`;

function fetchApi(url: string, opts?: RequestInit) {
  return fetch(`${API}${url}`, {
    ...opts,
    headers: { "Content-Type": "application/json", ...opts?.headers },
    credentials: "include",
  }).then((r) => {
    if (!r.ok) throw new Error(`API error: ${r.status}`);
    return r.json();
  });
}

const apptTypes = ["Psychiatry", "Primary Care", "Dental", "Therapy", "Lab Work", "Specialist", "Follow-up", "Emergency", "Other"];

export default function AppointmentsPage() {
  const [tab, setTab] = useState("today");
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ patientId: "", appointmentType: "Psychiatry", provider: "", providerPhone: "", location: "", scheduledAt: "", notes: "", transportNeeded: false, assignedStaffId: "" });
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: todayAppts = [] } = useQuery({ queryKey: ["appointments-today"], queryFn: () => fetchApi("/appointments/today") });
  const { data: upcomingAppts = [] } = useQuery({ queryKey: ["appointments-upcoming"], queryFn: () => fetchApi("/appointments/upcoming") });
  const { data: allAppts = [] } = useQuery({ queryKey: ["appointments-all"], queryFn: () => fetchApi("/appointments") });
  const { data: patients = [] } = useQuery({ queryKey: ["patients"], queryFn: () => fetchApi("/patients") });
  const { data: staffList = [] } = useQuery({ queryKey: ["staff"], queryFn: () => fetchApi("/staff") });

  const createMutation = useMutation({
    mutationFn: (data: any) => fetchApi("/appointments", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["appointments-today"] });
      qc.invalidateQueries({ queryKey: ["appointments-upcoming"] });
      qc.invalidateQueries({ queryKey: ["appointments-all"] });
      setShowNew(false);
      setForm({ patientId: "", appointmentType: "Psychiatry", provider: "", providerPhone: "", location: "", scheduledAt: "", notes: "", transportNeeded: false, assignedStaffId: "" });
      toast({ title: "Appointment created" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...data }: any) => fetchApi(`/appointments/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["appointments-today"] });
      qc.invalidateQueries({ queryKey: ["appointments-upcoming"] });
      qc.invalidateQueries({ queryKey: ["appointments-all"] });
      toast({ title: "Appointment updated" });
    },
  });

  const statusBadge = (status: string) => {
    switch (status) {
      case "scheduled": return <Badge className="bg-blue-100 text-blue-700 border-blue-200" variant="outline"><Clock className="h-3 w-3 mr-1" />Scheduled</Badge>;
      case "completed": return <Badge className="bg-green-100 text-green-700 border-green-200" variant="outline"><CheckCircle className="h-3 w-3 mr-1" />Completed</Badge>;
      case "cancelled": return <Badge className="bg-red-100 text-red-700 border-red-200" variant="outline"><XCircle className="h-3 w-3 mr-1" />Cancelled</Badge>;
      case "no_show": return <Badge className="bg-orange-100 text-orange-700 border-orange-200" variant="outline"><AlertCircle className="h-3 w-3 mr-1" />No Show</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getPatientName = (id: number) => {
    const p = patients.find((p: any) => p.id === id);
    return p ? `${p.firstName} ${p.lastName}` : `Patient #${id}`;
  };

  const renderTable = (appointments: any[]) => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Time</TableHead>
          <TableHead>Patient</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Provider</TableHead>
          <TableHead>Location</TableHead>
          <TableHead>Transport</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {appointments.length === 0 ? (
          <TableRow>
            <TableCell colSpan={8} className="text-center py-8 text-gray-500">No appointments found</TableCell>
          </TableRow>
        ) : (
          appointments.map((a: any) => (
            <TableRow key={a.id}>
              <TableCell>
                <div className="flex items-center gap-1">
                  <Clock className="h-3 w-3 text-gray-400" />
                  <span className="text-sm font-medium">{new Date(a.scheduledAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                </div>
                <span className="text-xs text-gray-500">{new Date(a.scheduledAt).toLocaleDateString()}</span>
              </TableCell>
              <TableCell className="font-medium">{getPatientName(a.patientId)}</TableCell>
              <TableCell>
                <div className="flex items-center gap-1">
                  <Stethoscope className="h-3 w-3 text-primary" />
                  {a.appointmentType}
                </div>
              </TableCell>
              <TableCell>{a.provider}</TableCell>
              <TableCell>
                {a.location ? (
                  <div className="flex items-center gap-1 text-sm">
                    <MapPin className="h-3 w-3 text-gray-400" />
                    {a.location}
                  </div>
                ) : "-"}
              </TableCell>
              <TableCell>{a.transportNeeded ? <Badge className="bg-yellow-100 text-yellow-700"><Car className="h-3 w-3 mr-1" />Needed</Badge> : <span className="text-gray-400">No</span>}</TableCell>
              <TableCell>{statusBadge(a.status)}</TableCell>
              <TableCell>
                <div className="flex gap-1">
                  {a.status === "scheduled" && (
                    <>
                      <Button size="sm" variant="outline" onClick={() => updateMutation.mutate({ id: a.id, status: "completed" })}>Complete</Button>
                      <Button size="sm" variant="ghost" onClick={() => updateMutation.mutate({ id: a.id, status: "cancelled" })}>Cancel</Button>
                    </>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Calendar className="h-7 w-7 text-primary" />
            Medical Appointments
          </h1>
          <p className="text-gray-500 mt-1">Track and manage patient medical appointments</p>
        </div>
        <Dialog open={showNew} onOpenChange={setShowNew}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" /> Schedule Appointment</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Schedule New Appointment</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div>
                <label className="text-sm font-medium">Patient</label>
                <Select value={form.patientId} onValueChange={(v) => setForm({ ...form, patientId: v })}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Select patient..." /></SelectTrigger>
                  <SelectContent>
                    {patients.map((p: any) => (
                      <SelectItem key={p.id} value={String(p.id)}>{p.firstName} {p.lastName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium">Appointment Type</label>
                  <Select value={form.appointmentType} onValueChange={(v) => setForm({ ...form, appointmentType: v })}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {apptTypes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium">Date & Time</label>
                  <Input type="datetime-local" className="mt-1" value={form.scheduledAt} onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium">Provider</label>
                  <Input className="mt-1" value={form.provider} onChange={(e) => setForm({ ...form, provider: e.target.value })} placeholder="Dr. Smith" />
                </div>
                <div>
                  <label className="text-sm font-medium">Phone</label>
                  <Input className="mt-1" value={form.providerPhone} onChange={(e) => setForm({ ...form, providerPhone: e.target.value })} placeholder="(555) 123-4567" />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">Location</label>
                <Input className="mt-1" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Clinic address..." />
              </div>
              <div>
                <label className="text-sm font-medium">Assigned Staff</label>
                <Select value={form.assignedStaffId} onValueChange={(v) => setForm({ ...form, assignedStaffId: v })}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Select staff (optional)..." /></SelectTrigger>
                  <SelectContent>
                    {staffList.map((s: any) => (
                      <SelectItem key={s.id} value={String(s.id)}>{s.firstName} {s.lastName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Notes</label>
                <Textarea className="mt-1" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Special instructions..." rows={2} />
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="transport" checked={form.transportNeeded} onChange={(e) => setForm({ ...form, transportNeeded: e.target.checked })} />
                <label htmlFor="transport" className="text-sm font-medium">Transport needed</label>
              </div>
              <Button
                onClick={() => createMutation.mutate({
                  patientId: Number(form.patientId),
                  appointmentType: form.appointmentType,
                  provider: form.provider,
                  providerPhone: form.providerPhone || undefined,
                  location: form.location || undefined,
                  scheduledAt: form.scheduledAt,
                  notes: form.notes || undefined,
                  transportNeeded: form.transportNeeded,
                  assignedStaffId: form.assignedStaffId ? Number(form.assignedStaffId) : undefined,
                })}
                disabled={!form.patientId || !form.provider || !form.scheduledAt}
                className="w-full"
              >
                Schedule Appointment
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center"><Calendar className="h-5 w-5 text-blue-600" /></div>
              <div>
                <p className="text-2xl font-bold">{todayAppts.length}</p>
                <p className="text-xs text-gray-500">Today</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-green-100 flex items-center justify-center"><Clock className="h-5 w-5 text-green-600" /></div>
              <div>
                <p className="text-2xl font-bold">{upcomingAppts.length}</p>
                <p className="text-xs text-gray-500">This Week</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-yellow-100 flex items-center justify-center"><Car className="h-5 w-5 text-yellow-600" /></div>
              <div>
                <p className="text-2xl font-bold">{todayAppts.filter((a: any) => a.transportNeeded).length}</p>
                <p className="text-xs text-gray-500">Need Transport</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-purple-100 flex items-center justify-center"><Stethoscope className="h-5 w-5 text-purple-600" /></div>
              <div>
                <p className="text-2xl font-bold">{allAppts.filter((a: any) => a.status === "completed").length}</p>
                <p className="text-xs text-gray-500">Completed</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <Tabs value={tab} onValueChange={setTab}>
          <CardHeader>
            <TabsList>
              <TabsTrigger value="today">Today ({todayAppts.length})</TabsTrigger>
              <TabsTrigger value="upcoming">Upcoming ({upcomingAppts.length})</TabsTrigger>
              <TabsTrigger value="all">All Appointments</TabsTrigger>
            </TabsList>
          </CardHeader>
          <CardContent>
            <TabsContent value="today" className="mt-0">{renderTable(todayAppts)}</TabsContent>
            <TabsContent value="upcoming" className="mt-0">{renderTable(upcomingAppts)}</TabsContent>
            <TabsContent value="all" className="mt-0">{renderTable(allAppts)}</TabsContent>
          </CardContent>
        </Tabs>
      </Card>
    </div>
  );
}
