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
import { LogOut, ClipboardCheck, HeartHandshake, CalendarCheck, Plus, Eye } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const API = `${import.meta.env.BASE_URL}api`;
function fetchApi(url: string, opts?: RequestInit) {
  return fetch(`${API}${url}`, { ...opts, headers: { "Content-Type": "application/json", ...opts?.headers }, credentials: "include" }).then(r => { if (!r.ok) throw new Error(`API error: ${r.status}`); return r.json(); });
}

const statusColors: Record<string, string> = { planning: "bg-blue-100 text-blue-700", ready: "bg-yellow-100 text-yellow-700", completed: "bg-green-100 text-green-700", cancelled: "bg-gray-100 text-gray-700" };

export default function DischargePage() {
  const [tab, setTab] = useState("plans");
  const [showNew, setShowNew] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<any>(null);
  const [form, setForm] = useState({ patientId: "", homeId: "", dischargeType: "planned", plannedDate: "", dischargeReason: "", dischargeTo: "", aftercarePlan: "", medicationTransitionPlan: "", safetyPlan: "", clinicianName: "", notes: "" });
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: plans = [] } = useQuery({ queryKey: ["discharge-plans"], queryFn: () => fetchApi("/discharge/plans") });
  const { data: dashboard } = useQuery({ queryKey: ["discharge-dashboard"], queryFn: () => fetchApi("/discharge/dashboard") });
  const { data: patients = [] } = useQuery({ queryKey: ["patients"], queryFn: () => fetchApi("/patients") });
  const { data: homes = [] } = useQuery({ queryKey: ["homes"], queryFn: () => fetchApi("/homes") });
  const { data: planDetail } = useQuery({ queryKey: ["discharge-plan", selectedPlan?.id], queryFn: () => fetchApi(`/discharge/plans/${selectedPlan.id}`), enabled: !!selectedPlan?.id });

  const createPlan = useMutation({
    mutationFn: (data: any) => fetchApi("/discharge/plans", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["discharge-plans"] }); qc.invalidateQueries({ queryKey: ["discharge-dashboard"] }); setShowNew(false); toast({ title: "Discharge plan created" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) => fetchApi(`/discharge/plans/${id}`, { method: "PATCH", body: JSON.stringify({ status }) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["discharge-plans"] }); qc.invalidateQueries({ queryKey: ["discharge-dashboard"] }); toast({ title: "Status updated" }); },
  });

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><LogOut className="h-7 w-7 text-primary" /> Discharge Planning</h1>
          <p className="text-gray-500 mt-1">Discharge coordination, aftercare planning, and follow-up tracking</p>
        </div>
        <Dialog open={showNew} onOpenChange={setShowNew}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" /> New Discharge Plan</Button></DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Create Discharge Plan</DialogTitle></DialogHeader>
            <div className="space-y-4 mt-4 max-h-[60vh] overflow-y-auto pr-2">
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-sm font-medium">Patient</label>
                  <Select value={form.patientId} onValueChange={v => setForm({ ...form, patientId: v })}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Select patient" /></SelectTrigger>
                    <SelectContent>{patients.map((p: any) => <SelectItem key={p.id} value={String(p.id)}>{p.firstName} {p.lastName}</SelectItem>)}</SelectContent>
                  </Select></div>
                <div><label className="text-sm font-medium">Home</label>
                  <Select value={form.homeId} onValueChange={v => setForm({ ...form, homeId: v })}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Select home" /></SelectTrigger>
                    <SelectContent>{homes.map((h: any) => <SelectItem key={h.id} value={String(h.id)}>{h.name}</SelectItem>)}</SelectContent>
                  </Select></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-sm font-medium">Discharge Type</label>
                  <Select value={form.dischargeType} onValueChange={v => setForm({ ...form, dischargeType: v })}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="planned">Planned</SelectItem><SelectItem value="therapeutic">Therapeutic</SelectItem><SelectItem value="ama">AMA</SelectItem><SelectItem value="administrative">Administrative</SelectItem><SelectItem value="transfer">Transfer</SelectItem></SelectContent>
                  </Select></div>
                <div><label className="text-sm font-medium">Planned Date</label><Input className="mt-1" type="date" value={form.plannedDate} onChange={e => setForm({ ...form, plannedDate: e.target.value })} /></div>
              </div>
              <div><label className="text-sm font-medium">Discharge Reason</label><Input className="mt-1" value={form.dischargeReason} onChange={e => setForm({ ...form, dischargeReason: e.target.value })} /></div>
              <div><label className="text-sm font-medium">Discharge To</label><Input className="mt-1" placeholder="e.g., Independent living, family home, another facility" value={form.dischargeTo} onChange={e => setForm({ ...form, dischargeTo: e.target.value })} /></div>
              <div><label className="text-sm font-medium">Aftercare Plan</label><Textarea className="mt-1" rows={2} value={form.aftercarePlan} onChange={e => setForm({ ...form, aftercarePlan: e.target.value })} /></div>
              <div><label className="text-sm font-medium">Medication Transition</label><Textarea className="mt-1" rows={2} value={form.medicationTransitionPlan} onChange={e => setForm({ ...form, medicationTransitionPlan: e.target.value })} /></div>
              <div><label className="text-sm font-medium">Safety Plan</label><Textarea className="mt-1" rows={2} value={form.safetyPlan} onChange={e => setForm({ ...form, safetyPlan: e.target.value })} /></div>
              <div><label className="text-sm font-medium">Clinician Name</label><Input className="mt-1" value={form.clinicianName} onChange={e => setForm({ ...form, clinicianName: e.target.value })} /></div>
              <div><label className="text-sm font-medium">Notes</label><Textarea className="mt-1" rows={2} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
              <Button className="w-full" disabled={!form.patientId || !form.homeId}
                onClick={() => createPlan.mutate({ ...form, patientId: Number(form.patientId), homeId: Number(form.homeId) })}>Create Plan</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {dashboard && (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
          <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-blue-600">{dashboard.planning}</p><p className="text-xs text-gray-500">Planning</p></CardContent></Card>
          <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-yellow-600">{dashboard.readyForDischarge}</p><p className="text-xs text-gray-500">Ready</p></CardContent></Card>
          <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-green-600">{dashboard.discharged}</p><p className="text-xs text-gray-500">Discharged</p></CardContent></Card>
          <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-amber-600">{dashboard.pendingFollowups}</p><p className="text-xs text-gray-500">Pending Follow-ups</p></CardContent></Card>
          <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-purple-600">{dashboard.completedFollowups}</p><p className="text-xs text-gray-500">Completed Follow-ups</p></CardContent></Card>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card>
            <Tabs value={tab} onValueChange={setTab}>
              <CardHeader><TabsList><TabsTrigger value="plans">All Plans</TabsTrigger><TabsTrigger value="upcoming">Upcoming Discharges</TabsTrigger></TabsList></CardHeader>
              <CardContent>
                <TabsContent value="plans" className="mt-0">
                  <Table>
                    <TableHeader><TableRow><TableHead>Patient</TableHead><TableHead>Home</TableHead><TableHead>Type</TableHead><TableHead>Planned Date</TableHead><TableHead>Follow-ups</TableHead><TableHead>Status</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {plans.length === 0 ? (
                        <TableRow><TableCell colSpan={7} className="text-center py-8 text-gray-500">No discharge plans yet</TableCell></TableRow>
                      ) : plans.map((p: any) => (
                        <TableRow key={p.id} className={selectedPlan?.id === p.id ? "bg-blue-50" : ""}>
                          <TableCell className="font-medium">{p.patientName}</TableCell>
                          <TableCell className="text-sm">{p.homeName}</TableCell>
                          <TableCell><Badge variant="outline" className="capitalize text-xs">{p.dischargeType}</Badge></TableCell>
                          <TableCell className="text-sm">{p.plannedDate ? new Date(p.plannedDate).toLocaleDateString() : "—"}</TableCell>
                          <TableCell>{p.followupCount}</TableCell>
                          <TableCell><Badge variant="outline" className={statusColors[p.status]}>{p.status}</Badge></TableCell>
                          <TableCell className="flex gap-1">
                            <Button variant="ghost" size="sm" onClick={() => setSelectedPlan(p)}><Eye className="h-4 w-4" /></Button>
                            {p.status === "planning" && <Button variant="ghost" size="sm" onClick={() => updateStatus.mutate({ id: p.id, status: "ready" })}><ClipboardCheck className="h-4 w-4 text-yellow-600" /></Button>}
                            {p.status === "ready" && <Button variant="ghost" size="sm" onClick={() => updateStatus.mutate({ id: p.id, status: "completed" })}><CalendarCheck className="h-4 w-4 text-green-600" /></Button>}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TabsContent>
                <TabsContent value="upcoming" className="mt-0">
                  <div className="space-y-3">
                    {dashboard?.upcomingDischarges?.length === 0 ? (
                      <p className="text-center py-8 text-gray-500">No upcoming discharges</p>
                    ) : dashboard?.upcomingDischarges?.map((d: any) => (
                      <Card key={d.id} className="border">
                        <CardContent className="p-4 flex items-center justify-between">
                          <div>
                            <p className="font-medium">{d.patientName}</p>
                            <p className="text-sm text-gray-500">{d.homeName} · {d.dischargeType}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-medium">{d.plannedDate ? new Date(d.plannedDate).toLocaleDateString() : "TBD"}</p>
                            <Badge variant="outline" className={statusColors[d.status]}>{d.status}</Badge>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </TabsContent>
              </CardContent>
            </Tabs>
          </Card>
        </div>

        <div>
          {selectedPlan && planDetail ? (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Discharge Plan</CardTitle>
                  <Badge variant="outline" className={statusColors[planDetail.status]}>{planDetail.status}</Badge>
                </div>
                <p className="text-sm text-gray-500">{planDetail.patientName} · {planDetail.homeName}</p>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div><span className="text-gray-500">Type:</span> <span className="capitalize">{planDetail.dischargeType}</span></div>
                  <div><span className="text-gray-500">Planned:</span> {planDetail.plannedDate ? new Date(planDetail.plannedDate).toLocaleDateString() : "TBD"}</div>
                </div>
                {planDetail.dischargeReason && <div><p className="text-xs text-gray-500">Reason</p><p className="text-sm">{planDetail.dischargeReason}</p></div>}
                {planDetail.dischargeTo && <div><p className="text-xs text-gray-500">Discharge To</p><p className="text-sm">{planDetail.dischargeTo}</p></div>}
                {planDetail.aftercarePlan && <div><p className="text-xs text-gray-500">Aftercare Plan</p><p className="text-sm">{planDetail.aftercarePlan}</p></div>}
                {planDetail.medicationTransitionPlan && <div><p className="text-xs text-gray-500">Medication Transition</p><p className="text-sm">{planDetail.medicationTransitionPlan}</p></div>}
                {planDetail.safetyPlan && <div><p className="text-xs text-gray-500">Safety Plan</p><p className="text-sm">{planDetail.safetyPlan}</p></div>}

                <div className="flex items-center gap-2 flex-wrap border-t pt-3">
                  {planDetail.transportationArranged && <Badge variant="outline" className="bg-green-50 text-xs">Transport Arranged</Badge>}
                  {planDetail.housingSecured && <Badge variant="outline" className="bg-green-50 text-xs">Housing Secured</Badge>}
                  {planDetail.belongingsReturned && <Badge variant="outline" className="bg-green-50 text-xs">Belongings Returned</Badge>}
                  {planDetail.consentForReleaseObtained && <Badge variant="outline" className="bg-green-50 text-xs">Consent Obtained</Badge>}
                </div>

                {planDetail.followups && planDetail.followups.length > 0 && (
                  <div className="border-t pt-3">
                    <h4 className="text-sm font-semibold mb-2 flex items-center gap-1"><HeartHandshake className="h-4 w-4" /> Follow-ups ({planDetail.followups.length})</h4>
                    <div className="space-y-2">
                      {planDetail.followups.map((f: any) => (
                        <div key={f.id} className="p-2 border rounded text-sm">
                          <div className="flex justify-between">
                            <span>{f.followUpType}</span>
                            <Badge variant="outline" className="text-xs">{f.status}</Badge>
                          </div>
                          <p className="text-xs text-gray-500">{f.scheduledDate ? new Date(f.scheduledDate).toLocaleDateString() : ""}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card className="p-8 text-center">
              <LogOut className="h-12 w-12 mx-auto mb-3 text-gray-300" />
              <p className="text-gray-500">Select a plan to view details</p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
