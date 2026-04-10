import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { ClipboardList, Users, UserCheck, Clock, Play, Square, Wand2, CheckCircle, AlertCircle } from "lucide-react";
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

export default function DailyAssignmentsPage() {
  const [tab, setTab] = useState("today");
  const [showManual, setShowManual] = useState(false);
  const [autoAssignHome, setAutoAssignHome] = useState("");
  const [manualForm, setManualForm] = useState({ staffId: "", homeId: "", shiftType: "day", patientIds: [] as string[], assignedTasks: "", specialInstructions: "" });
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: todayAssignments = [] } = useQuery({ queryKey: ["assignments-today"], queryFn: () => fetchApi("/assignments/today") });
  const { data: myAssignments = [] } = useQuery({ queryKey: ["assignments-my"], queryFn: () => fetchApi("/assignments/my") });
  const { data: allAssignments = [] } = useQuery({ queryKey: ["assignments-all"], queryFn: () => fetchApi("/assignments") });
  const { data: homes = [] } = useQuery({ queryKey: ["homes"], queryFn: () => fetchApi("/homes") });
  const { data: staffList = [] } = useQuery({ queryKey: ["staff"], queryFn: () => fetchApi("/staff") });
  const { data: patients = [] } = useQuery({ queryKey: ["patients"], queryFn: () => fetchApi("/patients") });

  const autoAssignMutation = useMutation({
    mutationFn: (data: any) => fetchApi("/assignments/auto-assign", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: (data: any) => {
      qc.invalidateQueries({ queryKey: ["assignments-today"] });
      qc.invalidateQueries({ queryKey: ["assignments-all"] });
      toast({ title: "Auto-assignment complete", description: data.message });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => fetchApi("/assignments", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["assignments-today"] });
      qc.invalidateQueries({ queryKey: ["assignments-all"] });
      setShowManual(false);
      toast({ title: "Assignment created" });
    },
  });

  const clockInMutation = useMutation({
    mutationFn: (id: number) => fetchApi(`/assignments/${id}/clock-in`, { method: "PATCH" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["assignments-my"] });
      qc.invalidateQueries({ queryKey: ["assignments-today"] });
      toast({ title: "Clocked in" });
    },
  });

  const clockOutMutation = useMutation({
    mutationFn: (id: number) => fetchApi(`/assignments/${id}/clock-out`, { method: "PATCH" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["assignments-my"] });
      qc.invalidateQueries({ queryKey: ["assignments-today"] });
      toast({ title: "Clocked out" });
    },
  });

  const statusBadge = (status: string) => {
    switch (status) {
      case "active": return <Badge className="bg-blue-100 text-blue-700" variant="outline"><AlertCircle className="h-3 w-3 mr-1" />Pending</Badge>;
      case "in_progress": return <Badge className="bg-green-100 text-green-700" variant="outline"><Play className="h-3 w-3 mr-1" />In Progress</Badge>;
      case "completed": return <Badge className="bg-gray-100 text-gray-700" variant="outline"><CheckCircle className="h-3 w-3 mr-1" />Completed</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getStaffName = (id: number) => {
    const s = staffList.find((s: any) => s.id === id);
    return s ? `${s.firstName} ${s.lastName}` : `Staff #${id}`;
  };

  const getHomeName = (id: number) => {
    const h = homes.find((h: any) => h.id === id);
    return h ? h.name : `Home #${id}`;
  };

  const getPatientNames = (ids: string) => {
    if (!ids) return "-";
    return ids.split(",").map(Number).filter(Boolean).map(id => {
      const p = patients.find((p: any) => p.id === id);
      return p ? `${p.firstName} ${p.lastName}` : `#${id}`;
    }).join(", ");
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <ClipboardList className="h-7 w-7 text-primary" />
            Daily Assignments
          </h1>
          <p className="text-gray-500 mt-1">Manage daily staff-to-patient assignments per shift</p>
        </div>
        <div className="flex gap-2">
          <div className="flex items-center gap-2">
            <Select value={autoAssignHome} onValueChange={setAutoAssignHome}>
              <SelectTrigger className="w-48"><SelectValue placeholder="Select home..." /></SelectTrigger>
              <SelectContent>
                {homes.map((h: any) => <SelectItem key={h.id} value={String(h.id)}>{h.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              onClick={() => autoAssignHome && autoAssignMutation.mutate({ homeId: Number(autoAssignHome) })}
              disabled={!autoAssignHome || autoAssignMutation.isPending}
            >
              <Wand2 className="h-4 w-4 mr-2" /> Auto-Assign
            </Button>
          </div>
          <Dialog open={showManual} onOpenChange={setShowManual}>
            <DialogTrigger asChild>
              <Button><UserCheck className="h-4 w-4 mr-2" /> Manual Assign</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Create Assignment</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div>
                  <label className="text-sm font-medium">Staff Member</label>
                  <Select value={manualForm.staffId} onValueChange={(v) => setManualForm({ ...manualForm, staffId: v })}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Select..." /></SelectTrigger>
                    <SelectContent>
                      {staffList.map((s: any) => <SelectItem key={s.id} value={String(s.id)}>{s.firstName} {s.lastName} ({s.role})</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium">Home</label>
                    <Select value={manualForm.homeId} onValueChange={(v) => setManualForm({ ...manualForm, homeId: v })}>
                      <SelectTrigger className="mt-1"><SelectValue placeholder="Select..." /></SelectTrigger>
                      <SelectContent>
                        {homes.map((h: any) => <SelectItem key={h.id} value={String(h.id)}>{h.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm font-medium">Shift</label>
                    <Select value={manualForm.shiftType} onValueChange={(v) => setManualForm({ ...manualForm, shiftType: v })}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="day">Day (7a-3p)</SelectItem>
                        <SelectItem value="evening">Evening (3p-11p)</SelectItem>
                        <SelectItem value="night">Night (11p-7a)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium">Patients (select from home)</label>
                  <div className="mt-1 max-h-40 overflow-y-auto border rounded-md p-2 space-y-1">
                    {patients
                      .filter((p: any) => !manualForm.homeId || p.homeId === Number(manualForm.homeId))
                      .map((p: any) => (
                        <label key={p.id} className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={manualForm.patientIds.includes(String(p.id))}
                            onChange={(e) => {
                              const id = String(p.id);
                              setManualForm({
                                ...manualForm,
                                patientIds: e.target.checked
                                  ? [...manualForm.patientIds, id]
                                  : manualForm.patientIds.filter(i => i !== id)
                              });
                            }}
                          />
                          {p.firstName} {p.lastName}
                        </label>
                      ))}
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium">Tasks</label>
                  <Textarea
                    className="mt-1"
                    value={manualForm.assignedTasks}
                    onChange={(e) => setManualForm({ ...manualForm, assignedTasks: e.target.value })}
                    placeholder="Medication administration, vitals, etc."
                    rows={2}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Special Instructions</label>
                  <Textarea
                    className="mt-1"
                    value={manualForm.specialInstructions}
                    onChange={(e) => setManualForm({ ...manualForm, specialInstructions: e.target.value })}
                    placeholder="Any special notes for this shift..."
                    rows={2}
                  />
                </div>
                <Button
                  onClick={() => createMutation.mutate({
                    staffId: Number(manualForm.staffId),
                    homeId: Number(manualForm.homeId),
                    assignmentDate: new Date().toISOString(),
                    shiftType: manualForm.shiftType,
                    patientIds: manualForm.patientIds.join(","),
                    assignedTasks: manualForm.assignedTasks || undefined,
                    specialInstructions: manualForm.specialInstructions || undefined,
                  })}
                  disabled={!manualForm.staffId || !manualForm.homeId || manualForm.patientIds.length === 0}
                  className="w-full"
                >
                  Create Assignment
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center"><Users className="h-5 w-5 text-blue-600" /></div>
              <div>
                <p className="text-2xl font-bold">{todayAssignments.length}</p>
                <p className="text-xs text-gray-500">Today's Assignments</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-green-100 flex items-center justify-center"><Play className="h-5 w-5 text-green-600" /></div>
              <div>
                <p className="text-2xl font-bold">{todayAssignments.filter((a: any) => a.status === "in_progress").length}</p>
                <p className="text-xs text-gray-500">In Progress</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-gray-100 flex items-center justify-center"><CheckCircle className="h-5 w-5 text-gray-600" /></div>
              <div>
                <p className="text-2xl font-bold">{todayAssignments.filter((a: any) => a.status === "completed").length}</p>
                <p className="text-xs text-gray-500">Completed</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {myAssignments.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <UserCheck className="h-5 w-5 text-primary" /> My Assignments Today
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4">
              {myAssignments.map((a: any) => (
                <div key={a.id} className="p-4 border rounded-lg bg-blue-50/50">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {statusBadge(a.status)}
                      <span className="text-sm font-medium">{getHomeName(a.homeId)} - {a.shiftType} shift</span>
                    </div>
                    <div className="flex gap-2">
                      {a.status === "active" && (
                        <Button size="sm" onClick={() => clockInMutation.mutate(a.id)}>
                          <Play className="h-3 w-3 mr-1" /> Clock In
                        </Button>
                      )}
                      {a.status === "in_progress" && (
                        <Button size="sm" variant="outline" onClick={() => clockOutMutation.mutate(a.id)}>
                          <Square className="h-3 w-3 mr-1" /> Clock Out
                        </Button>
                      )}
                    </div>
                  </div>
                  <p className="text-sm text-gray-600"><strong>Patients:</strong> {getPatientNames(a.patientIds)}</p>
                  {a.assignedTasks && <p className="text-sm text-gray-600 mt-1"><strong>Tasks:</strong> {a.assignedTasks}</p>}
                  {a.specialInstructions && <p className="text-sm text-amber-600 mt-1"><strong>Special:</strong> {a.specialInstructions}</p>}
                  {a.clockedInAt && <p className="text-xs text-gray-400 mt-1"><Clock className="h-3 w-3 inline mr-1" />Clocked in: {new Date(a.clockedInAt).toLocaleTimeString()}</p>}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <Tabs value={tab} onValueChange={setTab}>
          <CardHeader>
            <TabsList>
              <TabsTrigger value="today">Today ({todayAssignments.length})</TabsTrigger>
              <TabsTrigger value="all">All Assignments</TabsTrigger>
            </TabsList>
          </CardHeader>
          <CardContent>
            <TabsContent value="today" className="mt-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Staff</TableHead>
                    <TableHead>Home</TableHead>
                    <TableHead>Shift</TableHead>
                    <TableHead>Patients</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Clock In/Out</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {todayAssignments.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-gray-500">No assignments for today. Use Auto-Assign or Manual Assign to create them.</TableCell>
                    </TableRow>
                  ) : (
                    todayAssignments.map((a: any) => (
                      <TableRow key={a.id}>
                        <TableCell className="font-medium">{getStaffName(a.staffId)}</TableCell>
                        <TableCell>{getHomeName(a.homeId)}</TableCell>
                        <TableCell><Badge variant="outline">{a.shiftType}</Badge></TableCell>
                        <TableCell className="max-w-[200px] truncate">{getPatientNames(a.patientIds)}</TableCell>
                        <TableCell>{statusBadge(a.status)}</TableCell>
                        <TableCell className="text-xs text-gray-500">
                          {a.clockedInAt && <div>In: {new Date(a.clockedInAt).toLocaleTimeString()}</div>}
                          {a.clockedOutAt && <div>Out: {new Date(a.clockedOutAt).toLocaleTimeString()}</div>}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TabsContent>
            <TabsContent value="all" className="mt-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Staff</TableHead>
                    <TableHead>Home</TableHead>
                    <TableHead>Shift</TableHead>
                    <TableHead>Patients</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allAssignments.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-gray-500">No assignments found</TableCell>
                    </TableRow>
                  ) : (
                    allAssignments.map((a: any) => (
                      <TableRow key={a.id}>
                        <TableCell className="text-sm">{new Date(a.assignmentDate).toLocaleDateString()}</TableCell>
                        <TableCell className="font-medium">{getStaffName(a.staffId)}</TableCell>
                        <TableCell>{getHomeName(a.homeId)}</TableCell>
                        <TableCell><Badge variant="outline">{a.shiftType}</Badge></TableCell>
                        <TableCell className="max-w-[200px] truncate">{getPatientNames(a.patientIds)}</TableCell>
                        <TableCell>{statusBadge(a.status)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TabsContent>
          </CardContent>
        </Tabs>
      </Card>
    </div>
  );
}
